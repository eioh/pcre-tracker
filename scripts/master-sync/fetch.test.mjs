import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { classifyResponse, extractTitle, fetchSnapshots, formatManifestMarkdown, toJstIsoString } from "./fetch.mjs";
import { USER_AGENT, wikiPageUrl } from "./sources.mjs";

// Cloudflare の遮断ページの要点だけを残した本文。
const BLOCK_PAGE = `<!DOCTYPE html><html><head><title>Attention Required! | Cloudflare</title></head>
<body><div id="cf-error-details"><h1>Sorry, you have been blocked</h1></div></body></html>`;

const createdDirs = [];

// テスト用の一時ディレクトリを作る（後片付けのため記録する）。
function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "master-sync-fetch-"));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// URL ごとに決めた応答を返す偽の fetch を作り、呼び出し履歴も記録する。
function fakeFetch(routes) {
  const calls = [];
  // 偽の fetch 本体。登録のない URL は 404 を返す。
  async function impl(url, init) {
    calls.push({ url, userAgent: init.headers["user-agent"] });
    const route = routes[url];
    if (route instanceof Error) {
      throw route;
    }
    const [status, body, contentType = "text/html; charset=UTF-8"] = route ?? [404, "not found"];
    return new Response(body, { status, headers: { "content-type": contentType } });
  }
  return { impl, calls };
}

// 時刻を進める偽の時計と、待ち時間を記録する偽の sleep を作る。
function fakeClock() {
  let current = Date.parse("2026-10-20T00:00:00Z");
  const sleeps = [];
  return {
    now: () => new Date(current),
    // 待った分だけ偽の時計を進める。
    sleepImpl: async (ms) => {
      sleeps.push(ms);
      current += ms;
    },
    sleeps,
  };
}

const ROBOTS = ["https://wikiwiki.jp/robots.txt", [200, "User-Agent: *\nDisallow: /*?\n", "text/plain"]];

describe("fetchSnapshots", () => {
  it("識別可能な User-Agent で取得し、同じホストへの要求の間隔を空け、本文と manifest を保存する", async () => {
    const outDir = makeTempDir();
    const page = wikiPageUrl("隊列");
    const { impl, calls } = fakeFetch(Object.fromEntries([ROBOTS, [page, [200, "<html><head><title>隊列 - wiki</title></head></html>"]]]));
    const clock = fakeClock();
    const manifest = await fetchSnapshots({
      sources: [{ id: "formation", kind: "formation", url: page, title: "隊列", required: true }],
      outDir,
      fetchImpl: /** @type {typeof fetch} */ (impl),
      sleepImpl: clock.sleepImpl,
      now: clock.now,
      intervalMs: 5000,
    });
    expect(calls.map((call) => call.url)).toEqual(["https://wikiwiki.jp/robots.txt", page]);
    expect(calls.every((call) => call.userAgent === USER_AGENT)).toBe(true);
    expect(clock.sleeps).toEqual([5000]);
    expect(manifest.overall).toEqual({ ok: true, holdReasons: [] });
    expect(manifest.entries[0]).toMatchObject({ outcome: "ok", status: 200, pageTitle: "隊列 - wiki", fetchedAt: "2026-10-20T09:00:05+09:00" });
    expect(readFileSync(join(outDir, "formation.html"), "utf8")).toContain("隊列 - wiki");
    expect(JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8")).entries).toHaveLength(1);
  });

  it("必須の取得元が遮断されたら全体を保留にし、同じオリジンへの以降の要求をやめる", async () => {
    const outDir = makeTempDir();
    const required = wikiPageUrl("隊列");
    const optional = wikiPageUrl("ステージ攻略/H83");
    const { impl, calls } = fakeFetch(Object.fromEntries([ROBOTS, [required, [429, "<title>アクセス確認中 - WIKIWIKI</title>"]]]));
    const clock = fakeClock();
    const manifest = await fetchSnapshots({
      sources: [
        { id: "formation", kind: "formation", url: required, title: "隊列", required: true },
        { id: "hard-h83", kind: "hard-quest", url: optional, title: "ステージ攻略/H83", required: false },
      ],
      outDir,
      fetchImpl: /** @type {typeof fetch} */ (impl),
      sleepImpl: clock.sleepImpl,
      now: clock.now,
    });
    expect(manifest.entries.map((entry) => entry.outcome)).toEqual(["blocked", "skipped-after-block"]);
    expect(manifest.overall.ok).toBe(false);
    // 遮断を受けたオリジンには、それ以降の要求を送らない。
    expect(calls.map((call) => call.url)).toEqual(["https://wikiwiki.jp/robots.txt", required]);
    expect(manifest.overall.holdReasons).toEqual(["必須の取得元「隊列」を取得できませんでした（blocked / HTTP 429）"]);
    expect(formatManifestMarkdown(manifest)).toContain("全体: 保留");
  });

  it("robots.txt で不許可のパスは取得しない", async () => {
    const outDir = makeTempDir();
    const page = "https://wikiwiki.jp/yabaidesune/?cmd=list";
    const { impl, calls } = fakeFetch(Object.fromEntries([ROBOTS]));
    const clock = fakeClock();
    const manifest = await fetchSnapshots({
      sources: [{ id: "list", kind: "x", url: page, title: "一覧", required: true }],
      outDir,
      fetchImpl: /** @type {typeof fetch} */ (impl),
      sleepImpl: clock.sleepImpl,
      now: clock.now,
    });
    expect(calls.map((call) => call.url)).toEqual(["https://wikiwiki.jp/robots.txt"]);
    expect(manifest.entries[0].outcome).toBe("robots-disallowed");
    expect(existsSync(join(outDir, "list.html"))).toBe(false);
    expect(manifest.overall.ok).toBe(false);
  });

  it("通信失敗は network-error として記録し、例外で止まらない", async () => {
    const outDir = makeTempDir();
    const page = wikiPageUrl("属性");
    const { impl } = fakeFetch(Object.fromEntries([ROBOTS, [page, new TypeError("fetch failed")]]));
    const clock = fakeClock();
    const manifest = await fetchSnapshots({
      sources: [{ id: "attribute", kind: "attribute", url: page, title: "属性", required: true }],
      outDir,
      fetchImpl: /** @type {typeof fetch} */ (impl),
      sleepImpl: clock.sleepImpl,
      now: clock.now,
    });
    expect(manifest.entries[0]).toMatchObject({ outcome: "network-error", status: null });
    expect(manifest.overall.ok).toBe(false);
  });
});

describe("取得結果の補助関数", () => {
  it("200 で返る遮断・チャレンジページも blocked と判定する", () => {
    expect(classifyResponse(200, BLOCK_PAGE)).toBe("blocked");
    expect(classifyResponse(200, "<title>Just a moment...</title>")).toBe("blocked");
    expect(classifyResponse(200, "<title>ok</title>")).toBe("ok");
    expect(classifyResponse(500, "")).toBe("http-error");
  });

  it("日時を日本時間で表し、title を取り出す", () => {
    expect(toJstIsoString(new Date("2026-10-20T15:30:00Z"))).toBe("2026-10-21T00:30:00+09:00");
    expect(extractTitle("<title>\n  隊列 -  wiki\n</title>")).toBe("隊列 - wiki");
    expect(extractTitle("<html></html>")).toBeNull();
  });

  it("wiki のページ名をパス区切りを残してエンコードする", () => {
    expect(wikiPageUrl("ステージ攻略/H81")).toBe(`https://wikiwiki.jp/yabaidesune/${encodeURIComponent("ステージ攻略")}/H81`);
  });
});
