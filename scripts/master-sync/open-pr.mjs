// マスターデータ同期の段階4: 合格した候補だけを PR にする準備と、保留台帳（GitHub Issue）の本文作り。
// PR の作成と Issue の更新そのものは、このスクリプトの出力（pr.json・ledger.md）をもとに Claude が GitHub 連携で行う
// （クラウド環境のシェルからは GitHub API を直接呼べないため）。手順は RUNBOOK.md を参照。
//
// prepare: 次をすべて満たすときだけ候補ブランチを push し、PR の内容を pr.json に書く（draft・main 宛て）
//   - 候補のゲート判定が合格で、npm run verify が成功している（verify を省いた候補は不可）
//   - AI レビュー（review.json）が、スナップショットから作り直したページで再検証しても合格する
//   - 候補ブランチの先頭コミットが来歴チェック（provenance.mjs と同じ検査）に合格し、作業ツリーに未コミットの変更がない
//   - 同じ名前のブランチが origin にまだない（重複防止）
// ledger: 報告の保留・確認済みの差分・参照整合性と今回の候補の結果から、保留台帳の Issue 本文を ledger.md に書く
//
// 使い方:
//   node scripts/master-sync/open-pr.mjs prepare --candidate-dir <候補の出力先> --snapshot <スナップショット> [--dry-run]
//   node scripts/master-sync/open-pr.mjs ledger --candidate-dir <候補の出力先> [--skip-reason <PR を作らなかった理由>]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkProvenance, loadMasterFromGit } from "./provenance.mjs";
import { loadReviewTexts, verifyReview } from "./review.mjs";

export const PR_BASE = "main";
export const LEDGER_TITLE = "マスターデータ同期: 保留台帳";
export const LEDGER_MARKER = "<!-- master-sync-ledger -->";

// git コマンドを実行して結果を返す（失敗しても例外にしない）。
function git(cwd, args) {
  return spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
}

// PR・Issue の本文に入れる外部由来の文字列を、メンションやリンクとして解釈されないようにする。
export function neutralize(text) {
  return String(text ?? "")
    .replace(/@/g, "＠")
    .replace(/</g, "＜")
    .replace(/>/g, "＞")
    .replace(/\r?\n/g, " ");
}

// 引用をコードとして表示する（バッククォートは全角にして閉じ忘れを防ぐ）。
function codeSpan(text) {
  return `\`${String(text ?? "").replace(/`/g, "｀").replace(/\r?\n/g, " ")}\``;
}

// Markdown の表のセルに入れる文字列を整える。
function cell(text) {
  return neutralize(text).replace(/\|/g, "\\|");
}

/**
 * PR の本文を作る。
 * @param {{ candidate: any, report: any, review: any, reviewCheck: { warnings: string[] }, snapshotCommit: string | null }} input
 */
export function buildPrBody({ candidate, report, review, reviewCheck, snapshotCommit }) {
  const reviewById = new Map(review.items.map((item) => [item.proposalId, item]));
  const lines = [
    "## 目的",
    "",
    "公開 wiki の更新に合わせて、マスターデータを更新する（マスターデータ同期の自動候補）。",
    "スクリプトのゲート判定・`npm run verify`・AI レビューと、その引用の機械的な検証をすべて通った候補です。**マージするかは確認のうえで判断してください。**",
    "",
    "## 変更概要",
    "",
    ...candidate.gate.changes.map((change) => `- ${neutralize(change)}`),
    "",
    "## AI レビュー",
    "",
    `全体の判定: **${review.verdict}**（別文脈のサブエージェントによる。引用は保存したページに実在することをスクリプトで確認済み）`,
    "",
    "| # | 変更 | 判定 | 理由 | 根拠（wiki からの引用） |",
    "|---|---|---|---|---|",
    ...report.proposals.map((proposal, index) => {
      const item = reviewById.get(`p${index + 1}`);
      const quote = item?.evidence?.[0]?.quote ?? "";
      return `| p${index + 1} | ${cell(`${proposal.kind}: ${proposal.target}`)} | ${cell(item?.verdict)} | ${cell(item?.reason)} | ${codeSpan(quote.length > 120 ? `${quote.slice(0, 120)}…` : quote).replace(/\|/g, "\\|")} |`;
    }),
    "",
    ...(reviewCheck.warnings.length > 0 ? ["AI レビューの参考（不足の指摘など。合否には影響しない）:", "", ...reviewCheck.warnings.map((warning) => `- ${neutralize(warning)}`), ""] : []),
    "## 出典",
    "",
    "| 取得元 | 取得時刻 | sha256(先頭12桁) |",
    "|---|---|---|",
    ...report.snapshot.sources
      .filter((source) => report.proposals.some((proposal) => proposal.sources.includes(source.url)))
      .map((source) => `| ${decodeURI(source.url)} | ${source.fetchedAt} | ${source.sha256 ? source.sha256.slice(0, 12) : "-"} |`),
    "",
    "## 来歴",
    "",
    `- 候補ハッシュ: \`${candidate.hash}\`（ブランチ名・コミットの trailer と一致することを PR Check の来歴チェックで確認する）`,
    `- 基準: \`${candidate.base.sha}\`（${candidate.base.ref}）`,
    `- スナップショット: ${report.snapshot.startedAt}${snapshotCommit ? `（eioh/pcre-tracker-snapshots \`${snapshotCommit.slice(0, 12)}\`）` : ""}`,
    `- 保留: ${report.holds.length} 件（自動では反映しない。保留台帳の Issue を参照）`,
    "",
    "## 実施した確認",
    "",
    "- ゲート判定: 合格（削除・true→false・並び替え・既存値の変更・報告にない変更がない、新キャラの形式・参照整合性）",
    `- \`npm run verify\`: 成功（${Math.round(candidate.verify.durationMs / 1000)} 秒）`,
    "- AI レビュー: 全件 ok、引用の検証に合格",
    "",
    "## マージ後",
    "",
    "- AGENTS.md の規約どおり、main を develop にマージしてください。",
    "",
  ];
  return lines.join("\n");
}

/**
 * PR 作成の準備をする。合格しなければ理由を返し、push しない。
 * @param {{ candidateDir: string, snapshotDir: string, dryRun: boolean }} options
 */
export function preparePr({ candidateDir, snapshotDir, dryRun }) {
  /** @type {string[]} */
  const failures = [];
  const read = (file) => JSON.parse(readFileSync(join(candidateDir, file), "utf8"));
  const candidate = read("candidate.json");
  const report = read("report.json");

  if (!candidate.branch || !candidate.worktree || !existsSync(candidate.worktree)) {
    return { ok: false, failures: [`候補ブランチがない（${candidate.status}）`] };
  }
  if (!candidate.gate?.ok) {
    failures.push("ゲート判定が合格していない");
  }
  if (!candidate.verify?.ok) {
    failures.push(candidate.verify ? "npm run verify が失敗している" : "npm run verify を実施していない（--skip-verify の候補は PR にしない）");
  }

  // AI レビューを、スナップショットから作り直したページで再検証する（保存された検証結果は信用しない）。
  const packet = JSON.parse(readFileSync(join(candidateDir, "review-packet/packet.json"), "utf8"));
  /** @type {any} */
  let review = null;
  try {
    review = read("review.json");
  } catch {
    failures.push("review.json がない、または JSON として読めない");
  }
  const reviewCheck = verifyReview({ packet, review, pageTexts: loadReviewTexts(snapshotDir) });
  failures.push(...reviewCheck.failures.map((failure) => `AI レビュー: ${failure}`));
  if (packet.candidateHash !== candidate.hash) {
    failures.push("レビュー用パケットの候補ハッシュが候補と一致しない");
  }

  // 候補ブランチの状態と来歴を確かめる。
  const worktree = candidate.worktree;
  const branch = git(worktree, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (branch !== candidate.branch) {
    failures.push(`作業ツリーのブランチ（${branch}）が候補（${candidate.branch}）と一致しない`);
  }
  if (git(worktree, ["status", "--porcelain", "--untracked-files=no"]).stdout.trim() !== "") {
    failures.push("作業ツリーに未コミットの変更がある");
  }
  const provenance = checkProvenance({
    branch: candidate.branch,
    headMessage: git(worktree, ["log", "-1", "--format=%B", "HEAD"]).stdout,
    changedFiles: git(worktree, ["diff", "--name-only", candidate.base.sha, "HEAD"]).stdout.split("\n").filter(Boolean),
    base: loadMasterFromGit(worktree, candidate.base.sha),
    merged: loadMasterFromGit(worktree, "HEAD"),
  });
  failures.push(...provenance.failures.map((failure) => `来歴: ${failure}`));

  // 同じ候補のブランチが既に origin にあれば作らない。
  const remote = git(worktree, ["ls-remote", "--heads", "origin", candidate.branch]);
  if (remote.status !== 0) {
    failures.push(`origin のブランチを確認できない: ${remote.stderr.trim()}`);
  } else if (remote.stdout.trim() !== "") {
    failures.push(`同じ候補のブランチ ${candidate.branch} が既に origin にある（重複のため作らない）`);
  }
  if (failures.length > 0) {
    return { ok: false, failures };
  }

  const snapshotCommit = git(snapshotDir, ["rev-parse", "HEAD"]);
  const pr = {
    title: `feat: マスターデータ同期の候補を反映（${candidate.hash}）`,
    head: candidate.branch,
    base: PR_BASE,
    draft: true,
    body: buildPrBody({ candidate, report, review, reviewCheck, snapshotCommit: snapshotCommit.status === 0 ? snapshotCommit.stdout.trim() : null }),
  };
  if (!dryRun) {
    const push = git(worktree, ["push", "origin", `${candidate.branch}:refs/heads/${candidate.branch}`]);
    if (push.status !== 0) {
      return { ok: false, failures: [`push に失敗した: ${push.stderr.trim()}`] };
    }
  }
  writeFileSync(join(candidateDir, "pr.json"), `${JSON.stringify(pr, null, 2)}\n`, "utf8");
  return { ok: true, failures: [], pushed: !dryRun, pr };
}

/**
 * 保留台帳の Issue 本文を作る。毎回全体を作り直し、Issue の本文を置き換えて使う。
 * skipReason は、prepare より前に PR を見送ったとき（未マージの同期 PR があるなど）の理由。
 * @param {{ report: any, candidate: any | null, prepare: { ok: boolean, failures: string[] } | null, skipReason?: string | null }} input
 */
export function buildLedger({ report, candidate, prepare, skipReason = null }) {
  const acknowledged = report.notes.filter((note) => /確認済みの差分/.test(note.kind));
  const lines = [
    LEDGER_MARKER,
    "マスターデータ同期が自動では反映しなかった項目の一覧です。実行のたびに全体を作り直します（手で編集しても上書きされます）。",
    "",
    `- 更新: ${report.generatedAt}（判定の基準日 ${report.today}）`,
    `- スナップショット: ${report.snapshot.startedAt}`,
    `- 今回の候補: ${candidate ? `${neutralize(candidate.status)}${candidate.hash ? `（${candidate.hash}）` : ""}` : "なし"}`,
    ...(skipReason ? [`- PR を見送った理由: ${neutralize(skipReason)}`] : []),
    ...(prepare && !prepare.ok ? ["- PR にしなかった理由:", ...prepare.failures.map((failure) => `  - ${neutralize(failure)}`)] : []),
    "",
    "## 全体保留",
    "",
    report.globalHoldReasons.length > 0 ? report.globalHoldReasons.map((reason) => `- ${neutralize(reason)}`).join("\n") : "なし",
    "",
    `## 保留（${report.holds.length} 件）`,
    "",
    "マスターを正とする場合は `scripts/master-sync/acknowledged.json` に記録すると、次回から保留に出なくなります（限定区分・編成順のみ）。",
    "",
    ...(report.holds.length > 0
      ? ["| 区分 | 対象 | 内容 | 詳細 |", "|---|---|---|---|", ...report.holds.map((hold) => `| ${cell(hold.area)} | ${cell(hold.target)} | ${cell(hold.kind)} | ${cell(hold.detail)} |`)]
      : ["なし"]),
    "",
    `## 確認済みの差分（${acknowledged.length} 件）`,
    "",
    ...(acknowledged.length > 0 ? acknowledged.map((note) => `- ${cell(note.area)}: ${cell(note.target)}（${cell(note.detail)}）`) : ["なし"]),
    "",
    "## 既存データの参照整合性",
    "",
    report.integrityIssues.length > 0
      ? report.integrityIssues.map((issue) => `- ${cell(issue.file)} [${cell(issue.location)}] ${cell(issue.name)}: ${cell(issue.problem)}`).join("\n")
      : "問題なし",
    "",
  ];
  return lines.join("\n");
}

// コマンドライン引数を解析する。
function parseArgs(argv) {
  const [command, ...rest] = argv;
  /** @type {{ command: string, candidateDir: string | null, snapshot: string | null, dryRun: boolean, skipReason: string | null }} */
  const options = { command, candidateDir: null, snapshot: null, dryRun: false, skipReason: null };
  for (let index = 0; index < rest.length; index += 1) {
    const [arg, value] = [rest[index], rest[index + 1]];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--candidate-dir" && value) {
      options.candidateDir = value;
      index += 1;
    } else if (arg === "--snapshot" && value) {
      options.snapshot = value;
      index += 1;
    } else if (arg === "--skip-reason" && value) {
      options.skipReason = value;
      index += 1;
    } else {
      throw new Error(`不明な引数です: ${arg}`);
    }
  }
  if (!options.candidateDir || (command === "prepare" && !options.snapshot) || (command !== "prepare" && command !== "ledger")) {
    throw new Error("使い方: open-pr.mjs prepare --candidate-dir <dir> --snapshot <dir> [--dry-run] / open-pr.mjs ledger --candidate-dir <dir>");
  }
  return options;
}

// CLI の入口。
function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidateDir = resolve(/** @type {string} */ (options.candidateDir));
  if (options.command === "prepare") {
    const result = preparePr({ candidateDir, snapshotDir: resolve(/** @type {string} */ (options.snapshot)), dryRun: options.dryRun });
    writeFileSync(join(candidateDir, "prepare.json"), `${JSON.stringify({ ok: result.ok, failures: result.failures, pushed: result.pushed ?? false }, null, 2)}\n`, "utf8");
    console.log(
      result.ok
        ? `PR の準備: 合格${result.pushed ? `（${result.pr?.head} を push 済み）` : "（--dry-run のため push していない）"}\nPR の内容: ${join(candidateDir, "pr.json")}`
        : `PR の準備: 不合格\n${result.failures.map((failure) => `- ${failure}`).join("\n")}`,
    );
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }
  const report = JSON.parse(readFileSync(join(candidateDir, "report.json"), "utf8"));
  const candidatePath = join(candidateDir, "candidate.json");
  const preparePath = join(candidateDir, "prepare.json");
  const ledger = buildLedger({
    report,
    candidate: existsSync(candidatePath) ? JSON.parse(readFileSync(candidatePath, "utf8")) : null,
    prepare: existsSync(preparePath) ? JSON.parse(readFileSync(preparePath, "utf8")) : null,
    skipReason: options.skipReason,
  });
  writeFileSync(join(candidateDir, "ledger.md"), ledger, "utf8");
  console.log(`保留台帳の本文: ${join(candidateDir, "ledger.md")}（Issue「${LEDGER_TITLE}」の本文を置き換える）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}

