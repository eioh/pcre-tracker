// マスターデータ同期の報告（report.json）から件数だけを取り出し、GitHub Actions のジョブ概要に書く。
// 公開リポジトリの Actions の画面は誰でも見られるため、取得元由来の文字列（キャラ名・保留の理由など）は出さない。
// 変更候補があるか全体保留のときは終了コード 1 にして、ワークフローの失敗として利用者にメールで知らせる。
//
// 使い方: node scripts/master-sync/summary.mjs --report <report.json のパス>
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 報告から公開してよい件数の要約を作る。
 * @param {{ globalHoldReasons: unknown[], proposals: unknown[], holds: unknown[], notes: unknown[] }} report
 * @returns {{ markdown: string, needsAttention: boolean }} ジョブ概要に書く Markdown と、利用者に知らせる必要があるか
 */
export function summarizeReport(report) {
  const globalHold = report.globalHoldReasons.length > 0;
  const needsAttention = globalHold || report.proposals.length > 0;
  const markdown = [
    "## master-sync 報告",
    "",
    `全体保留: ${globalHold ? `あり（${report.globalHoldReasons.length} 件）` : "なし"} / 変更候補 ${report.proposals.length} 件 / 保留 ${report.holds.length} 件 / 参考 ${report.notes.length} 件`,
    "",
    needsAttention
      ? "対応が必要です。手元でスナップショット用リポジトリを取得し、report.mjs で報告を作って内容を確認してください。"
      : "対応が必要な差分はありません。",
    "",
  ].join("\n");
  return { markdown, needsAttention };
}

// コマンドライン引数から report.json のパスを取り出す。
function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--report") {
    throw new Error("使い方: node scripts/master-sync/summary.mjs --report <report.json のパス>");
  }
  return { report: argv[1] };
}

// CLI の入口。要約を標準出力とジョブ概要に書き、知らせる必要があれば終了コード 1 にする。
function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = JSON.parse(readFileSync(resolve(options.report), "utf8"));
  const { markdown, needsAttention } = summarizeReport(report);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
  if (needsAttention) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
