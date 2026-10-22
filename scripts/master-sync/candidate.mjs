// マスターデータ同期の段階2: 作業ブランチに更新候補を作り、ゲート判定・参照整合性チェック・verify を行う。
// PR は作らず、ブランチも push しない。
//
// 手順:
//   1. 基準（既定は origin/main。マスターデータだけの更新は main から切って main へ統合するため）の作業ツリーを .master-sync/worktrees/ に作り、そのマスターと比較して報告を作る
//   2. 全体保留・変更候補なしなら、ブランチを作らずに終える
//   3. 変更候補を当てはめ、元データとの差分をゲート判定する
//   4. 合格なら、マスターを書き換えて生成物を作り直し（参照整合性チェックを含む）、feature/master-sync-<候補ハッシュ> に commit する
//   5. その作業ツリーで npm run verify を実行する（--skip-verify で省略）
//
// 候補ブランチを作ったときは、出力先に段階3の AI レビュー用パケット（review-packet/）も書き出す。
//
// 使い方: node scripts/master-sync/candidate.mjs --snapshot <スナップショット> [--base <git の参照>] [--today YYYY-MM-DD] [--out <出力先>] [--skip-verify]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyProposals } from "./apply.mjs";
import { todayInJst } from "./compare.mjs";
import { changesDigest, gateCandidate } from "./gate.mjs";
import { loadExistingMaster } from "./integrity.mjs";
import { buildReport, formatReportMarkdown } from "./report.mjs";
import { writeReviewPacket } from "./review.mjs";

// 書き換えの対象になるマスターデータのファイル（キーは ExistingMaster の項目）。
const MASTER_FILES = {
  characters: "src/data/characterMaster.json",
  formationOrder: "src/data/formationOrder.json",
  hardQuest: "src/data/hardQuestMemoryPiece.json",
  sideStory: "src/data/sideStoryMemoryPiece.json",
  coinShop: "src/data/coinShopMemoryPiece.json",
};
const GENERATED_FILE = "src/data/characterMaster.generated.json";
export const BRANCH_PREFIX = "feature/master-sync-";

/**
 * 変更候補の内容から候補ハッシュを作る。同じ変更の組なら基準のコミットが進んでも同じ値になり、重複の判定に使える。
 * @param {import("./compare.mjs").Finding[]} proposals
 */
export function candidateHash(proposals) {
  const canonical = proposals
    .map((proposal) => JSON.stringify([proposal.kind, proposal.target, proposal.after ?? null]))
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 12);
}

// コマンドを実行し、失敗したら標準エラーを含めて例外にする。
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} が失敗しました（終了コード ${result.status}）\n${result.stderr ?? ""}`);
  }
  return result.stdout.trim();
}

// git の参照が（ローカルまたは origin に）存在するかを返す。
function refExists(repoRoot, ref) {
  return spawnSync("git", ["-C", repoRoot, "rev-parse", "--verify", "--quiet", ref], { encoding: "utf8" }).status === 0;
}

// マスターデータを既存ファイルと同じ形式（2 スペースの JSON、末尾改行）で書き出す。
function writeMaster(root, data) {
  for (const [key, file] of Object.entries(MASTER_FILES)) {
    writeFileSync(join(root, file), `${JSON.stringify(data[/** @type {keyof typeof data} */ (key)], null, 2)}\n`, "utf8");
  }
}

// 段階2の結果を Markdown にする。
export function formatCandidateMarkdown(result) {
  const lines = [
    "# マスターデータ同期 候補（段階2）",
    "",
    `- 結果: **${result.status}**`,
    `- 基準: ${result.base.ref}（${result.base.sha.slice(0, 12)}）`,
    `- 候補ハッシュ: ${result.hash ?? "-"}`,
    `- ブランチ: ${result.branch ?? "-"}（push していない）`,
    `- 作業ツリー: ${result.worktree ?? "-"}`,
    "",
    "## ゲート判定",
    "",
    result.gate ? (result.gate.ok ? "合格" : `**不合格**\n\n${result.gate.failures.map((failure) => `- ${failure}`).join("\n")}`) : "実施していない",
    "",
    "## 反映した変更",
    "",
    result.gate && result.gate.changes.length > 0 ? result.gate.changes.map((change) => `- ${change}`).join("\n") : "なし",
    "",
    "## verify",
    "",
    result.verify ? `${result.verify.ok ? "成功" : "**失敗**"}（${result.verify.command}、${Math.round(result.verify.durationMs / 1000)} 秒）${result.verify.ok ? "" : `\n\n\`\`\`\n${result.verify.outputTail}\n\`\`\``}` : "実施していない",
    "",
  ];
  return lines.join("\n");
}

/**
 * 段階2を実行して結果を返す。
 * @param {{ repoRoot: string, snapshotDir: string, baseRef: string, today: string, skipVerify: boolean }} options
 */
export function createCandidate({ repoRoot, snapshotDir, baseRef, today, skipVerify }) {
  const baseSha = run("git", ["-C", repoRoot, "rev-parse", `${baseRef}^{commit}`]);
  const worktree = join(repoRoot, ".master-sync/worktrees", baseSha.slice(0, 12));
  if (existsSync(worktree)) {
    throw new Error(`作業ツリーが既にあります: ${worktree}（前回の候補を確認してから git worktree remove で消してください）`);
  }
  run("git", ["-C", repoRoot, "worktree", "add", "--detach", worktree, baseSha]);
  // 作業ツリーを片付ける（ブランチを作らなかった場合）。
  const removeWorktree = () => run("git", ["-C", repoRoot, "worktree", "remove", "--force", worktree]);

  const report = buildReport({ snapshotDir, repoRoot: worktree, today });
  /** @type {any} */
  const result = { status: "", base: { ref: baseRef, sha: baseSha }, hash: null, branch: null, worktree: null, report, gate: null, verify: null };
  if (report.globalHoldReasons.length > 0) {
    removeWorktree();
    return { ...result, status: "全体保留（候補を作らない）" };
  }
  if (report.proposals.length === 0) {
    removeWorktree();
    return { ...result, status: "変更候補なし" };
  }

  const hash = candidateHash(report.proposals);
  const branch = `${BRANCH_PREFIX}${hash}`;
  if (refExists(repoRoot, `refs/heads/${branch}`) || refExists(repoRoot, `refs/remotes/origin/${branch}`)) {
    removeWorktree();
    return { ...result, hash, branch, status: "同じ候補のブランチが既にある（作らない）" };
  }

  const base = loadExistingMaster(worktree);
  const candidate = applyProposals(base, report.proposals);
  const gate = gateCandidate({ base, candidate, report });
  if (!gate.ok) {
    removeWorktree();
    return { ...result, hash, gate, status: "ゲート不合格（ブランチを作らない）" };
  }

  // マスターを書き換え、このスクリプトと同じ版の生成スクリプト（参照整合性チェックを含む）で生成物を作り直す。
  writeMaster(worktree, candidate);
  run(process.execPath, [join(repoRoot, "scripts/generate-search-tokens.mjs")], { cwd: worktree });
  run("git", ["-C", worktree, "switch", "--quiet", "-c", branch]);
  run("git", ["-C", worktree, "add", ...Object.values(MASTER_FILES), GENERATED_FILE]);
  const message = [
    `feat: マスターデータ同期の候補を反映（${hash}）`,
    "",
    ...gate.changes.map((change) => `- ${change}`),
    "",
    `Master-Sync-Candidate: ${hash}`,
    `Master-Sync-Changes-Digest: ${changesDigest(gate.changes)}`,
    `Master-Sync-Base: ${baseSha}`,
    `Master-Sync-Snapshot: ${report.snapshot.startedAt}`,
  ].join("\n");
  run("git", ["-C", worktree, "commit", "--quiet", "-F", "-"], { input: message });
  const committed = { ...result, hash, branch, worktree, gate, status: "候補を作成（verify 未実施）" };
  if (skipVerify) {
    return committed;
  }

  // verify には依存パッケージが要る。基準の package-lock.json が同じなら元の node_modules を参照させ、違えば npm ci で入れる。
  const startedAt = Date.now();
  const sameLock = readFileSync(join(repoRoot, "package-lock.json"), "utf8") === readFileSync(join(worktree, "package-lock.json"), "utf8");
  if (sameLock && !existsSync(join(worktree, "node_modules"))) {
    symlinkSync(join(repoRoot, "node_modules"), join(worktree, "node_modules"), "dir");
  } else if (!sameLock) {
    run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: worktree });
  }
  // 標準出力と標準エラーを混ぜた順のまま残すため、シェル経由で 2>&1 にまとめる。
  const verify = spawnSync("sh", ["-c", "npm run verify 2>&1"], { cwd: worktree, encoding: "utf8", env: { ...process.env, TMPDIR: "/tmp" } });
  const output = verify.stdout ?? "";
  return {
    ...committed,
    verify: {
      ok: verify.status === 0,
      command: "npm run verify",
      durationMs: Date.now() - startedAt,
      // jsdom の未実装 API の警告は失敗の原因を埋もれさせるので除く。
      outputTail: output
        .split("\n")
        .filter((line) => !line.startsWith("Not implemented:"))
        .slice(-40)
        .join("\n"),
    },
    status: verify.status === 0 ? "候補を作成（ゲート合格・verify 成功）" : "候補を作成したが verify 失敗",
  };
}

// コマンドライン引数を解析する。
function parseArgs(argv) {
  /** @type {{ snapshot: string | null, base: string, today: string | null, out: string | null, skipVerify: boolean }} */
  const options = { snapshot: null, base: "origin/main", today: null, out: null, skipVerify: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--skip-verify") {
      options.skipVerify = true;
    } else if ((arg === "--snapshot" || arg === "--base" || arg === "--today" || arg === "--out") && value) {
      options[/** @type {"snapshot" | "base" | "today" | "out"} */ (arg.slice(2))] = value;
      index += 1;
    } else {
      throw new Error(`不明な引数です: ${arg}`);
    }
  }
  if (!options.snapshot) {
    throw new Error("--snapshot <スナップショットのディレクトリ> を指定してください");
  }
  return options;
}

// CLI の入口。報告と段階2の結果を出力先に書き、要約を標準出力に出す。verify 失敗・ゲート不合格は終了コード 1 にする。
function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const options = parseArgs(process.argv.slice(2));
  const result = createCandidate({
    repoRoot,
    snapshotDir: resolve(/** @type {string} */ (options.snapshot)),
    baseRef: options.base,
    today: options.today ?? todayInJst(),
    skipVerify: options.skipVerify,
  });
  const stamp = result.report.generatedAt.slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const outDir = resolve(options.out ?? join(repoRoot, ".master-sync/candidates", stamp));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "report.json"), `${JSON.stringify(result.report, null, 2)}\n`, "utf8");
  writeFileSync(join(outDir, "report.md"), formatReportMarkdown(result.report), "utf8");
  const { report: _report, ...summary } = result;
  writeFileSync(join(outDir, "candidate.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  writeFileSync(join(outDir, "candidate.md"), formatCandidateMarkdown(result), "utf8");
  // 候補ブランチを作ったときは、段階3の AI レビュー用のパケットも書き出す。
  const packet = result.worktree ? writeReviewPacket({ candidateDir: outDir, snapshotDir: resolve(/** @type {string} */ (options.snapshot)) }) : null;
  console.log(
    `結果: ${result.status}\n出力: ${outDir}${result.branch ? `\nブランチ: ${result.branch}` : ""}${packet ? `\nレビュー用パケット: ${packet.packetDir}` : ""}`,
  );
  if ((result.gate && !result.gate.ok) || (result.verify && !result.verify.ok)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
