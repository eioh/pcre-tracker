// マスターデータ同期の段階3: AI レビューの材料（レビュー用パケット）を作り、AI が書いた review.json を機械的に検証する。
// - pack: 候補の変更一覧と、保存したページを読みやすいテキストにしたものを書き出す（レビュー担当はこれだけを読む）
// - verify: review.json の形式・候補ハッシュ・全変更への判定・出典 URL・引用が保存したページに実在するかを検査する
// 取得したページは信頼しない入力なので、引用は「保存したページのテキストに文字どおり含まれるか」で確かめる。
//
// 使い方:
//   node scripts/master-sync/review.mjs pack --candidate-dir <候補の出力先> --snapshot <スナップショット>
//   node scripts/master-sync/review.mjs verify --candidate-dir <候補の出力先> --snapshot <スナップショット>
// verify はレビュー担当が触れたパケットのファイルを信用せず、スナップショットからページのテキストを作り直して照合する。
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cellText, expandTable, getContent, parseHtml } from "./html.mjs";

export const REVIEW_SCHEMA_VERSION = 1;
// 引用として認める最短の文字数（空白をまとめた後）。短すぎる引用は根拠にならない。
export const MIN_QUOTE_LENGTH = 6;
const PACKET_DIR = "review-packet";
const BLOCK_TAGS = new Set(["P", "DIV", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "TR", "PRE", "BLOCKQUOTE", "DT", "DD"]);

// 空白（全角スペースを含む）の連続を 1 つの半角スペースにし、照合用に正規化する。
export function normalizeForQuote(text) {
  return text.normalize("NFC").replace(/[\s　]+/g, " ").trim();
}

/**
 * ページの HTML から、レビュー用のテキストを作る。
 * - 画像は [alt] にする（キャラのアイコンはここでキャラ名になる）
 * - 表は結合セルを展開し、1 行を「| セル | セル |」の 1 行にする
 * - 折り畳みの中は〔折り畳み開始〕〜〔折り畳み終了〕で囲む（旧版の表などを区別するため）
 */
export function pageToReviewText(html) {
  const document = parseHtml(html);
  const content = getContent(document);
  for (const element of content.querySelectorAll("script, style, noscript")) {
    element.remove();
  }
  for (const image of content.querySelectorAll("img")) {
    const alt = image.getAttribute("alt");
    image.replaceWith(document.createTextNode(alt ? ` [${alt}] ` : " "));
  }
  for (const fold of content.querySelectorAll(".fold-content")) {
    fold.prepend(document.createTextNode("\n〔折り畳み開始〕\n"));
    fold.append(document.createTextNode("\n〔折り畳み終了〕\n"));
  }
  // 内側の表から順に、展開した行のテキストに置き換える。
  for (const table of [...content.querySelectorAll("table")].reverse()) {
    const lines = expandTable(table).map((row) => `| ${row.map(({ cell }) => cellText(cell)).join(" | ")} |`);
    const block = document.createElement("pre");
    block.textContent = `\n${lines.join("\n")}\n`;
    table.replaceWith(block);
  }
  for (const br of content.querySelectorAll("br")) {
    br.replaceWith(document.createTextNode("\n"));
  }
  for (const element of content.querySelectorAll("*")) {
    if (BLOCK_TAGS.has(element.tagName)) {
      element.append(document.createTextNode("\n"));
    }
  }
  return (content.textContent ?? "")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

// キャラ名から、ページ上に現れうる表記（全角カッコ・半角カッコ・実装日一覧の「名前 | 衣装」）を作る。
function nameForms(name) {
  const forms = [name, name.replace(/（/g, "(").replace(/）/g, ")")];
  const match = /^(.+?)（(.+)）$/.exec(name);
  if (match) {
    forms.push(`${match[1]} | ${match[2]}`);
  }
  return forms;
}

/**
 * 変更候補ごとに、引用に含まれているべき文字列（どれか 1 つ）を決める。引用が変更の対象に触れていることを確かめるため。
 * @param {import("./compare.mjs").Finding} proposal
 */
export function quoteKeys(proposal) {
  if (proposal.kind === "HARD ステージを追加") {
    return [`H${proposal.target}`, ...nameForms(String(proposal.after))];
  }
  if (proposal.kind === "サイドストーリーを追加") {
    // イベント名は改行の位置で区切られて表示されることがあるので、最初の区切りまでを使う。
    return [normalizeForQuote(proposal.target).split(" ")[0]];
  }
  return nameForms(proposal.target);
}

// レビューに使うページの種類（解析器が読む wiki のページ。利用規約や、本文を JavaScript で描く公式ニュースは除く）。
const REVIEW_PAGE_KINDS = ["implementation-dates", "formation", "attribute", "role", "hard-quest", "very-hard-quest", "event-pieces"];

// レビューに使うページ（取得に成功したもの）を返す。
function reviewPages(manifest) {
  return manifest.entries.filter((entry) => entry.outcome === "ok" && REVIEW_PAGE_KINDS.includes(entry.kind));
}

/**
 * スナップショットからレビュー用テキストを作り直す（URL → テキスト）。保存したページのハッシュが manifest と一致することも確かめる。
 * @returns {Record<string, string>}
 */
export function loadReviewTexts(snapshotDir) {
  const manifest = JSON.parse(readFileSync(join(snapshotDir, "manifest.json"), "utf8"));
  return Object.fromEntries(
    reviewPages(manifest).map((entry) => {
      const bytes = readFileSync(join(snapshotDir, entry.file));
      if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
        throw new Error(`保存したページ ${entry.file} のハッシュが manifest と一致しません`);
      }
      return [entry.url, pageToReviewText(bytes.toString("utf8"))];
    }),
  );
}

/**
 * レビュー用パケットを書き出す。
 * @param {{ candidateDir: string, snapshotDir: string }} options
 */
export function writeReviewPacket({ candidateDir, snapshotDir }) {
  const report = JSON.parse(readFileSync(join(candidateDir, "report.json"), "utf8"));
  const candidate = JSON.parse(readFileSync(join(candidateDir, "candidate.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(snapshotDir, "manifest.json"), "utf8"));
  if (manifest.startedAt !== report.snapshot.startedAt) {
    throw new Error("スナップショットが報告を作ったときのものと異なります");
  }
  const packetDir = join(candidateDir, PACKET_DIR);
  mkdirSync(join(packetDir, "pages"), { recursive: true });
  const pages = reviewPages(manifest).map((entry) => {
    const file = `pages/${entry.id}.txt`;
    writeFileSync(join(packetDir, file), `${pageToReviewText(readFileSync(join(snapshotDir, entry.file), "utf8"))}\n`, "utf8");
    return { id: entry.id, url: entry.url, file, sha256: entry.sha256, fetchedAt: entry.fetchedAt };
  });
  const packet = {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    candidateHash: candidate.hash,
    branch: candidate.branch,
    today: report.today,
    snapshotStartedAt: report.snapshot.startedAt,
    pages,
    proposals: report.proposals.map((proposal, index) => ({
      id: `p${index + 1}`,
      kind: proposal.kind,
      target: proposal.target,
      detail: proposal.detail,
      before: proposal.before,
      after: proposal.after,
      sources: proposal.sources,
      quoteMustContainOneOf: quoteKeys(proposal),
    })),
    changes: candidate.gate?.changes ?? [],
  };
  writeFileSync(join(packetDir, "packet.json"), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  return { packetDir, packet };
}

/**
 * review.json を検査する。引用は保存したページのテキスト（空白を正規化）に部分文字列として含まれる必要がある。
 * すべての変更が ok で、全体の判定が approve のときだけ合格にする。
 * @param {{ packet: any, review: any, pageTexts: Record<string, string> }} input pageTexts は URL → レビュー用テキスト（スナップショットから作り直したもの）
 * @returns {{ ok: boolean, failures: string[], warnings: string[] }}
 */
export function verifyReview({ packet, review, pageTexts }) {
  const failures = [];
  const warnings = [];
  const normalizedPages = Object.fromEntries(Object.entries(pageTexts).map(([url, text]) => [url, normalizeForQuote(text)]));

  // 1 件の引用を検査し、問題があれば failures に記録する。問題がなければ true を返す。
  const checkQuote = (label, url, quote) => {
    if (typeof quote !== "string") {
      failures.push(`${label}: 引用が文字列でない`);
      return false;
    }
    const normalized = normalizeForQuote(quote);
    if (normalized.length < MIN_QUOTE_LENGTH) {
      failures.push(`${label}: 引用が短すぎる（「${quote}」）`);
      return false;
    }
    const page = normalizedPages[url];
    if (page === undefined) {
      failures.push(`${label}: 出典 URL のページが保存されていない（${url}）`);
      return false;
    }
    if (!page.includes(normalized)) {
      failures.push(`${label}: 引用が保存したページに見つからない（「${quote.slice(0, 80)}」）`);
      return false;
    }
    return true;
  };

  if (!review || typeof review !== "object") {
    return { ok: false, failures: ["review.json が JSON オブジェクトでない"], warnings };
  }
  if (review.schemaVersion !== REVIEW_SCHEMA_VERSION) {
    failures.push(`schemaVersion が ${REVIEW_SCHEMA_VERSION} でない`);
  }
  if (review.candidateHash !== packet.candidateHash) {
    failures.push(`候補ハッシュが一致しない（review: ${review.candidateHash} / 候補: ${packet.candidateHash}）`);
  }
  if (review.verdict !== "approve" && review.verdict !== "reject") {
    failures.push("verdict が approve / reject でない");
  }
  const items = Array.isArray(review.items) ? review.items : [];
  if (!Array.isArray(review.items)) {
    failures.push("items が配列でない");
  }
  for (const proposal of packet.proposals) {
    const matched = items.filter((item) => item?.proposalId === proposal.id);
    if (matched.length !== 1) {
      failures.push(`${proposal.id}（${proposal.kind}: ${proposal.target}）への判定が ${matched.length} 件（1 件であるべき）`);
      continue;
    }
    const item = matched[0];
    const label = `${proposal.id}（${proposal.kind}: ${proposal.target}）`;
    if (item.verdict !== "ok") {
      failures.push(`${label}: 判定が ok でない（${item.verdict}）: ${item.reason ?? ""}`);
    }
    if (typeof item.reason !== "string" || item.reason.trim() === "") {
      failures.push(`${label}: reason が空`);
    }
    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    if (evidence.length === 0) {
      failures.push(`${label}: 根拠（evidence）がない`);
      continue;
    }
    // 検査に通った根拠だけを、変更の対象に触れているかの判定に使う。
    const validQuotes = [];
    evidence.forEach((entry, index) => {
      if (!proposal.sources.includes(entry?.sourceUrl)) {
        failures.push(`${label} 根拠${index + 1}: sourceUrl がこの変更の出典に含まれない（${entry?.sourceUrl}）`);
        return;
      }
      if (checkQuote(`${label} 根拠${index + 1}`, entry.sourceUrl, entry.quote)) {
        validQuotes.push(normalizeForQuote(entry.quote));
      }
    });
    // 少なくとも 1 つの有効な根拠は、変更の対象（キャラ名・ステージ・イベント名）に触れていなければならない。
    const keys = proposal.quoteMustContainOneOf.map(normalizeForQuote);
    if (!validQuotes.some((quote) => keys.some((key) => quote.includes(key)))) {
      failures.push(`${label}: 変更の対象（${proposal.quoteMustContainOneOf.join(" / ")}）を含む根拠がない`);
    }
  }
  const knownIds = new Set(packet.proposals.map((proposal) => proposal.id));
  for (const item of items) {
    if (!knownIds.has(item?.proposalId)) {
      failures.push(`存在しない変更への判定がある（${item?.proposalId}）`);
    }
  }
  // 不足の指摘は合否に影響させないが、引用は実在しなければならない（根拠のない指摘を残さない）。
  const missing = Array.isArray(review.missing) ? review.missing : [];
  const savedUrls = new Set(Object.keys(normalizedPages));
  missing.forEach((entry, index) => {
    const evidence = Array.isArray(entry?.evidence) ? entry.evidence : [];
    if (evidence.length === 0) {
      failures.push(`不足の指摘${index + 1}: 根拠（evidence）がない`);
    }
    evidence.forEach((item, itemIndex) => {
      if (!savedUrls.has(item?.sourceUrl)) {
        failures.push(`不足の指摘${index + 1} 根拠${itemIndex + 1}: 保存したページの URL でない（${item?.sourceUrl}）`);
        return;
      }
      checkQuote(`不足の指摘${index + 1} 根拠${itemIndex + 1}`, item.sourceUrl, item.quote);
    });
    warnings.push(`不足の指摘: ${entry?.description ?? "(説明なし)"}`);
  });
  if (review.verdict !== "approve") {
    failures.push(`全体の判定が approve でない（${review.verdict}）`);
  }
  return { ok: failures.length === 0, failures, warnings };
}

// 検査結果を Markdown にする。
function formatVerification(result, packet) {
  return [
    "# AI レビューの検証（段階3）",
    "",
    `- 候補ハッシュ: ${packet.candidateHash}`,
    `- 結果: **${result.ok ? "合格" : "不合格"}**`,
    "",
    "## 不合格の理由",
    "",
    result.failures.length > 0 ? result.failures.map((failure) => `- ${failure}`).join("\n") : "なし",
    "",
    "## 参考（不足の指摘など）",
    "",
    result.warnings.length > 0 ? result.warnings.map((warning) => `- ${warning}`).join("\n") : "なし",
    "",
  ].join("\n");
}

// コマンドライン引数を解析する。
function parseArgs(argv) {
  const [command, ...rest] = argv;
  /** @type {{ command: string, candidateDir: string | null, snapshot: string | null }} */
  const options = { command, candidateDir: null, snapshot: null };
  for (let index = 0; index < rest.length; index += 2) {
    const [arg, value] = [rest[index], rest[index + 1]];
    if (arg === "--candidate-dir" && value) {
      options.candidateDir = value;
    } else if (arg === "--snapshot" && value) {
      options.snapshot = value;
    } else {
      throw new Error(`不明な引数です: ${arg}`);
    }
  }
  if ((command !== "pack" && command !== "verify") || !options.candidateDir || !options.snapshot) {
    throw new Error("使い方: review.mjs pack|verify --candidate-dir <dir> --snapshot <dir>");
  }
  return options;
}

// CLI の入口。
function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidateDir = resolve(/** @type {string} */ (options.candidateDir));
  if (options.command === "pack") {
    const { packetDir, packet } = writeReviewPacket({ candidateDir, snapshotDir: resolve(/** @type {string} */ (options.snapshot)) });
    console.log(`レビュー用パケット: ${packetDir}（変更 ${packet.proposals.length} 件、ページ ${packet.pages.length} 件）`);
    return;
  }
  const packetDir = join(candidateDir, PACKET_DIR);
  const packet = JSON.parse(readFileSync(join(packetDir, "packet.json"), "utf8"));
  /** @type {any} */
  let review;
  try {
    review = JSON.parse(readFileSync(join(candidateDir, "review.json"), "utf8"));
  } catch (error) {
    review = null;
  }
  const pageTexts = loadReviewTexts(resolve(/** @type {string} */ (options.snapshot)));
  const result = verifyReview({ packet, review, pageTexts });
  writeFileSync(join(candidateDir, "review-check.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  writeFileSync(join(candidateDir, "review-check.md"), formatVerification(result, packet), "utf8");
  console.log(`AI レビューの検証: ${result.ok ? "合格" : "不合格"}（不合格の理由 ${result.failures.length} 件）`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
