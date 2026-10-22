// マスターデータ同期（段階1: 読み取り専用）の取得処理。
// 取得元のページを識別可能な User-Agent で低頻度に取得し、本文と取得結果の一覧（manifest.json）をスナップショットとして保存する。
// robots.txt で許可されていないパスは取得しない。マスターデータは読み込みも書き換えもしない（HARD の最大エリアの参照を除く）。
//
// 使い方: node scripts/master-sync/fetch.mjs [--out <保存先>] [--interval-ms <ミリ秒>] [--only <id,id,...>]
//   --out を省略すると .master-sync/snapshots/<日本時間の日時> に保存する。
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { interpretRobotsResponse, isPathAllowed } from "./robots.mjs";
import { DEFAULT_REQUEST_INTERVAL_MS, DEFAULT_TIMEOUT_MS, USER_AGENT, buildSources } from "./sources.mjs";

// manifest.json の形式の版。項目を変えたら上げる。
export const MANIFEST_SCHEMA_VERSION = 1;

// robots.txt の User-agent 照合に使う製品名トークン。
const PRODUCT_TOKEN = USER_AGENT.split("/")[0];

// 日時を日本時間（+09:00）の ISO 8601 文字列にする。
export function toJstIsoString(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.toISOString().slice(0, 19)}+09:00`;
}

// HTML から <title> の文字列を取り出す（報告用。見つからなければ null）。
export function extractTitle(html) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

// 応答がアクセス遮断・チャレンジページかを判定する。Cloudflare の遮断ページは 200 で返ることもあるため本文も見る。
export function detectBlockPage(status, body) {
  const markers = ["Attention Required! | Cloudflare", "cf-error-details", "Just a moment...", "cf-chl-", "challenge-platform"];
  const marker = markers.find((candidate) => body.includes(candidate));
  if (marker) {
    return `遮断ページを検出（${marker}）`;
  }
  if (status === 403 || status === 429) {
    return `HTTP ${status}`;
  }
  return null;
}

// HTTP ステータスと本文から取得結果の分類を決める。
/** @returns {"ok" | "blocked" | "not-found" | "http-error"} */
export function classifyResponse(status, body) {
  if (detectBlockPage(status, body)) {
    return "blocked";
  }
  if (status === 404 || status === 410) {
    return "not-found";
  }
  if (status < 200 || status >= 300) {
    return "http-error";
  }
  return "ok";
}

// 指定ミリ秒だけ待つ。
function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

// タイムアウト付きで 1 件取得し、ステータス・Content-Type・本文のバイト列を返す。通信失敗は error に入れて返す。
async function fetchOnce(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
      redirect: "follow",
      signal: controller.signal,
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      finalUrl: response.url || url,
      bytes,
      error: null,
    };
  } catch (error) {
    return { status: null, contentType: null, finalUrl: url, bytes: new Uint8Array(), error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 取得元を順番に取得し、スナップショットを outDir に保存して manifest を返す。
 * 同じホストへの要求の間は intervalMs だけ空ける。fetchImpl・sleepImpl・now はテストで差し替える。
 * @param {{ sources: import("./sources.mjs").SyncSource[], outDir: string, fetchImpl?: typeof fetch,
 *   sleepImpl?: (ms: number) => Promise<void>, now?: () => Date, intervalMs?: number, timeoutMs?: number }} options
 */
export async function fetchSnapshots({
  sources,
  outDir,
  fetchImpl = fetch,
  sleepImpl = sleep,
  now = () => new Date(),
  intervalMs = DEFAULT_REQUEST_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  mkdirSync(outDir, { recursive: true });
  const startedAt = toJstIsoString(now());
  /** @type {Map<string, number>} ホストごとの最後の要求時刻 */
  const lastRequestAt = new Map();

  // 同じホストへの直前の要求から intervalMs 経つまで待ってから取得し、要求した時刻（日本時間）も返す。
  async function politeFetch(url) {
    const host = new URL(url).host;
    const last = lastRequestAt.get(host);
    if (last !== undefined) {
      const waitMs = last + intervalMs - now().getTime();
      if (waitMs > 0) {
        await sleepImpl(waitMs);
      }
    }
    const requestedAt = toJstIsoString(now());
    const result = await fetchOnce(fetchImpl, url, timeoutMs);
    lastRequestAt.set(host, now().getTime());
    return { ...result, requestedAt };
  }

  // オリジンごとに robots.txt を 1 回だけ取得して解釈する。
  /** @type {Map<string, ReturnType<typeof interpretRobotsResponse>>} */
  const robotsByOrigin = new Map();
  for (const origin of new Set(sources.map((source) => new URL(source.url).origin))) {
    const result = await politeFetch(`${origin}/robots.txt`);
    const body = new TextDecoder("utf-8").decode(result.bytes);
    robotsByOrigin.set(origin, interpretRobotsResponse({ status: result.status, contentType: result.contentType, body }, PRODUCT_TOKEN));
  }

  const entries = [];
  // 遮断・アクセス制限を受けたオリジン。以降はそのオリジンへ要求を送らない（制限中に再要求を重ねないため）。
  /** @type {Set<string>} */
  const blockedOrigins = new Set();
  for (const source of sources) {
    const url = new URL(source.url);
    const robots = robotsByOrigin.get(url.origin);
    const allowed = robots && !robots.disallowAll && isPathAllowed(robots.rules, `${url.pathname}${url.search}`);
    if (!allowed) {
      entries.push({ ...source, outcome: "robots-disallowed", status: null, fetchedAt: null, file: null });
      continue;
    }
    if (blockedOrigins.has(url.origin)) {
      entries.push({ ...source, outcome: "skipped-after-block", status: null, fetchedAt: null, file: null });
      continue;
    }
    const result = await politeFetch(source.url);
    const body = new TextDecoder("utf-8").decode(result.bytes);
    const file = `${source.id}.html`;
    writeFileSync(join(outDir, file), result.bytes);
    const outcome = result.error ? "network-error" : classifyResponse(/** @type {number} */ (result.status), body);
    if (outcome === "blocked") {
      blockedOrigins.add(url.origin);
    }
    entries.push({
      ...source,
      outcome,
      status: result.status,
      error: result.error,
      blockReason: result.status === null ? null : detectBlockPage(result.status, body),
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      bytes: result.bytes.length,
      sha256: createHash("sha256").update(result.bytes).digest("hex"),
      pageTitle: extractTitle(body),
      fetchedAt: result.requestedAt,
      file,
    });
  }

  // 必須の取得元が 1 件でも取れなければ、取得失敗またはページ構造の変化とみなして全体を保留にする。
  const holdReasons = entries
    .filter((entry) => entry.required && entry.outcome !== "ok")
    .map((entry) => `必須の取得元「${entry.title}」を取得できませんでした（${entry.outcome}${entry.status ? ` / HTTP ${entry.status}` : ""}）`);

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    userAgent: USER_AGENT,
    startedAt,
    finishedAt: toJstIsoString(now()),
    robots: Object.fromEntries([...robotsByOrigin].map(([origin, robots]) => [origin, robots.state])),
    entries,
    overall: { ok: holdReasons.length === 0, holdReasons },
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

// manifest を Markdown の表にする（標準出力と GitHub Actions のジョブ概要で使う）。
export function formatManifestMarkdown(manifest) {
  const lines = [
    `取得開始: ${manifest.startedAt} / 終了: ${manifest.finishedAt}`,
    "",
    `robots.txt: ${Object.entries(manifest.robots)
      .map(([origin, state]) => `${origin} = ${state}`)
      .join(", ")}`,
    "",
    "| id | 必須 | 結果 | HTTP | バイト数 | sha256(先頭12桁) | title |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const entry of manifest.entries) {
    const pageTitle = (entry.pageTitle ?? "").replace(/\|/g, "\\|");
    lines.push(
      `| ${entry.id} | ${entry.required ? "○" : ""} | ${entry.outcome} | ${entry.status ?? "-"} | ${entry.bytes ?? "-"} | ${entry.sha256 ? entry.sha256.slice(0, 12) : "-"} | ${pageTitle} |`,
    );
  }
  lines.push("", manifest.overall.ok ? "全体: 取得成功" : `全体: 保留\n${manifest.overall.holdReasons.map((reason) => `- ${reason}`).join("\n")}`);
  return lines.join("\n");
}

// コマンドライン引数を解析する。
function parseArgs(argv) {
  /** @type {{ out: string | null, intervalMs: number, only: string[] | null }} */
  const options = { out: null, intervalMs: DEFAULT_REQUEST_INTERVAL_MS, only: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--out" && value) {
      options.out = value;
      index += 1;
    } else if (arg === "--interval-ms" && value) {
      options.intervalMs = Number(value);
      index += 1;
    } else if (arg === "--only" && value) {
      options.only = value.split(",");
      index += 1;
    } else {
      throw new Error(`不明な引数です: ${arg}`);
    }
  }
  if (!Number.isFinite(options.intervalMs) || options.intervalMs < 1000) {
    throw new Error("--interval-ms は 1000 以上を指定してください（低頻度での取得を守るため）");
  }
  return options;
}

// 既存の HARD データから最大エリア番号を読む（取得する HARD ページの範囲を決めるためだけに使う）。
function readMaxHardArea(repoRoot) {
  const hardQuest = JSON.parse(readFileSync(join(repoRoot, "src/data/hardQuestMemoryPiece.json"), "utf8"));
  return Math.max(...Object.keys(hardQuest).map((stage) => Number(stage.split("-")[0])));
}

// CLI の入口。取得結果は manifest.json に残し、必須の取得元が取れなくても異常終了はしない（全体保留として報告する）。
async function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const options = parseArgs(process.argv.slice(2));
  const stamp = toJstIsoString(new Date()).slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const outDir = resolve(options.out ?? join(repoRoot, ".master-sync/snapshots", stamp));
  const allSources = buildSources({ maxHardArea: readMaxHardArea(repoRoot) });
  const sources = options.only ? allSources.filter((source) => options.only?.includes(source.id)) : allSources;
  const manifest = await fetchSnapshots({ sources, outDir, intervalMs: options.intervalMs });
  const markdown = formatManifestMarkdown(manifest);
  console.log(`保存先: ${outDir}\n\n${markdown}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## master-sync 取得結果\n\n${markdown}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
