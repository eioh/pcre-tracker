// マスターデータ同期の自動候補 PR の来歴チェック（段階4。PR Check から実行する）。
// feature/master-sync-<候補ハッシュ> からの PR について、次をすべて満たすことを確かめる。
//   - 先頭コミットの trailer（Master-Sync-Candidate）がブランチ名の候補ハッシュと一致する
//   - 変更されたファイルがマスターデータ（同期の対象）と生成物だけである
//   - 基準とのデータの差分が、構造のゲート（追加と false→true だけ、参照整合性）を通る
//   - 差分から作り直した変更の要約ハッシュが、trailer の Master-Sync-Changes-Digest と一致する
//     （AI レビューを通った候補から、後で中身が変わっていないことの確認）
//
// 使い方: node scripts/master-sync/provenance.mjs --branch <PR の head ブランチ名> --head-commit <PR の head コミット> --base <基準> --merged <検査するコミット>
//   --merged は PR を基準に重ねた結果（PR Check で checkout されるマージコミット）。
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { changesDigest, gateCandidate } from "./gate.mjs";

export const CANDIDATE_BRANCH_PATTERN = /^feature\/master-sync-([0-9a-f]{12})$/;

// 自動候補が変更してよいファイル（コインショップは同期の対象外）。
export const ALLOWED_FILES = [
  "src/data/characterMaster.json",
  "src/data/formationOrder.json",
  "src/data/hardQuestMemoryPiece.json",
  "src/data/sideStoryMemoryPiece.json",
  "src/data/characterMaster.generated.json",
];

const MASTER_FILES = {
  characters: "src/data/characterMaster.json",
  formationOrder: "src/data/formationOrder.json",
  hardQuest: "src/data/hardQuestMemoryPiece.json",
  sideStory: "src/data/sideStoryMemoryPiece.json",
  coinShop: "src/data/coinShopMemoryPiece.json",
};

// git コマンドを実行して標準出力を返す。失敗したら例外にする。
function git(repoRoot, args) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} が失敗しました: ${result.stderr}`);
  }
  return result.stdout;
}

// 指定したコミット時点のマスターデータを git から読む。
/** @returns {import("./integrity.mjs").ExistingMaster} */
export function loadMasterFromGit(repoRoot, ref) {
  return /** @type {any} */ (Object.fromEntries(Object.entries(MASTER_FILES).map(([key, file]) => [key, JSON.parse(git(repoRoot, ["show", `${ref}:${file}`]))])));
}

// コミットメッセージの trailer（「キー: 値」の行）を読み取る。
export function parseTrailers(message) {
  /** @type {Record<string, string>} */
  const trailers = {};
  for (const line of message.split("\n")) {
    const match = /^(Master-Sync-[A-Za-z-]+):\s*(.+)$/.exec(line.trim());
    if (match) {
      trailers[match[1]] = match[2].trim();
    }
  }
  return trailers;
}

/**
 * 来歴を検査する。git の操作は呼び出し側で済ませ、ここには材料だけを渡す。
 * @param {{ branch: string, headMessage: string, changedFiles: string[], base: any, merged: any }} input
 * @returns {{ ok: boolean, failures: string[], changes: string[] }}
 */
export function checkProvenance({ branch, headMessage, changedFiles, base, merged }) {
  const failures = [];
  const match = CANDIDATE_BRANCH_PATTERN.exec(branch);
  if (!match) {
    return { ok: false, failures: [`ブランチ名が feature/master-sync-<12 桁の候補ハッシュ> の形でない（${branch}）`], changes: [] };
  }
  const trailers = parseTrailers(headMessage);
  if (trailers["Master-Sync-Candidate"] !== match[1]) {
    failures.push(`先頭コミットの Master-Sync-Candidate（${trailers["Master-Sync-Candidate"] ?? "なし"}）がブランチ名の候補ハッシュ（${match[1]}）と一致しない`);
  }
  const outside = changedFiles.filter((file) => !ALLOWED_FILES.includes(file));
  if (outside.length > 0) {
    failures.push(`同期の対象外のファイルが変更されている: ${outside.join(", ")}`);
  }
  const gate = gateCandidate({ base, candidate: merged });
  failures.push(...gate.failures.map((failure) => `ゲート: ${failure}`));
  if (gate.changes.length === 0) {
    failures.push("マスターデータの変更がない");
  }
  const digest = changesDigest(gate.changes);
  if (trailers["Master-Sync-Changes-Digest"] !== digest) {
    failures.push(
      `差分から作り直した変更の要約ハッシュ（${digest.slice(0, 12)}）が、コミットの Master-Sync-Changes-Digest（${(trailers["Master-Sync-Changes-Digest"] ?? "なし").slice(0, 12)}）と一致しない。レビュー後に中身が変わったか、基準が進んで差分が変わった可能性がある`,
    );
  }
  return { ok: failures.length === 0, failures, changes: gate.changes };
}

// コマンドライン引数を解析する。
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const [arg, value] = [argv[index], argv[index + 1]];
    if (!["--branch", "--head-commit", "--base", "--merged"].includes(arg) || !value) {
      throw new Error(`不明な引数です: ${arg}`);
    }
    options[arg.slice(2)] = value;
  }
  for (const key of ["branch", "head-commit", "base", "merged"]) {
    if (!options[key]) {
      throw new Error(`--${key} を指定してください`);
    }
  }
  return options;
}

// CLI の入口。結果を標準出力（と GitHub Actions のジョブ概要）に出し、不合格なら終了コード 1 にする。
function main() {
  // 検査するのは作業ディレクトリのリポジトリ（PR Check では checkout したリポジトリ）。
  const repoRoot = process.cwd();
  const options = parseArgs(process.argv.slice(2));
  const result = checkProvenance({
    branch: options.branch,
    headMessage: git(repoRoot, ["log", "-1", "--format=%B", options["head-commit"]]),
    changedFiles: git(repoRoot, ["diff", "--name-only", options.base, options.merged]).split("\n").filter(Boolean),
    base: loadMasterFromGit(repoRoot, options.base),
    merged: loadMasterFromGit(repoRoot, options.merged),
  });
  const lines = [
    `## マスターデータ同期の来歴チェック: ${result.ok ? "合格" : "不合格"}`,
    "",
    ...(result.failures.length > 0 ? ["### 不合格の理由", "", ...result.failures.map((failure) => `- ${failure}`), ""] : []),
    "### 変更",
    "",
    ...(result.changes.length > 0 ? result.changes.map((change) => `- ${change}`) : ["なし"]),
    "",
  ];
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
