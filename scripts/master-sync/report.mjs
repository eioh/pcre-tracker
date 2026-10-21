// マスターデータ同期（段階1: 読み取り専用）の報告を作る。
// スナップショット（fetch.mjs の出力）を解析し、既存マスター全件と比較して、差分・不足・保留理由を Markdown と JSON で出力する。
// マスターデータは書き換えない。
//
// 使い方: node scripts/master-sync/report.mjs --snapshot <スナップショットのディレクトリ> [--out <出力先>] [--today YYYY-MM-DD]
//   --out を省略すると .master-sync/reports/<日本時間の日時>/ に report.md と report.json を書く。
//   --today を省略すると日本時間の今日を使う。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareWithMaster, todayInJst } from "./compare.mjs";
import { toJstIsoString } from "./fetch.mjs";
import { checkReferenceIntegrity, loadExistingMaster } from "./integrity.mjs";
import { ATTRIBUTES, ROLES, parseCategoryPage, parseEventPieces, parseFormation, parseImplementationDates, parseQuestPage } from "./parsers.mjs";

// 報告の形式の版。項目を変えたら上げる。
export const REPORT_SCHEMA_VERSION = 1;

/**
 * スナップショットと既存マスターから報告を作る。
 * 解析に失敗した取得元があれば、その理由を全体保留の理由に加え、比較は行わない。
 * @param {{ snapshotDir: string, repoRoot: string, today: string }} options
 */
export function buildReport({ snapshotDir, repoRoot, today }) {
  const manifest = JSON.parse(readFileSync(join(snapshotDir, "manifest.json"), "utf8"));
  const master = loadExistingMaster(repoRoot);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const aliases = JSON.parse(readFileSync(join(scriptDir, "aliases.json"), "utf8")).aliases;
  const { limited, formationOrder } = JSON.parse(readFileSync(join(scriptDir, "acknowledged.json"), "utf8"));
  const acknowledged = { limited, formationOrder };
  /** @type {Record<string, string>} */
  const urls = Object.fromEntries(manifest.entries.map((entry) => [entry.id, entry.url]));
  /** @type {string[]} */
  const globalHoldReasons = [...manifest.overall.holdReasons];

  // 取得に成功した取得元の本文を読む。成功していなければ null。
  const readSource = (id) => {
    const entry = manifest.entries.find((candidate) => candidate.id === id);
    return entry && entry.outcome === "ok" ? readFileSync(join(snapshotDir, entry.file), "utf8") : null;
  };
  // 解析器を実行し、失敗したら全体保留の理由に記録して null を返す。
  const parseSource = (id, parser) => {
    const html = readSource(id);
    if (html === null) {
      return null;
    }
    try {
      return parser(html);
    } catch (error) {
      globalHoldReasons.push(`「${id}」の解析に失敗しました（${error instanceof Error ? error.message : String(error)}）`);
      return null;
    }
  };

  const questSources = (kind) =>
    manifest.entries
      .filter((entry) => entry.kind === kind && entry.outcome === "ok")
      .map((entry) => ({ sourceId: entry.id, page: parseSource(entry.id, parseQuestPage) }))
      .filter((quest) => quest.page !== null);
  const parsed = {
    implementation: parseSource("implementation-dates", parseImplementationDates),
    formation: parseSource("formation", parseFormation),
    attribute: parseSource("attribute", (html) => parseCategoryPage(html, ATTRIBUTES)),
    role: parseSource("role", (html) => parseCategoryPage(html, ROLES)),
    hardQuests: questSources("hard-quest"),
    veryHardQuests: questSources("very-hard-quest"),
    eventPieces: parseSource("event-pieces", parseEventPieces),
  };

  const integrityIssues = checkReferenceIntegrity(master);
  const canCompare =
    globalHoldReasons.length === 0 &&
    parsed.implementation &&
    parsed.formation &&
    parsed.attribute &&
    parsed.role &&
    parsed.eventPieces;
  const comparison = canCompare
    ? compareWithMaster({ master, parsed: /** @type {any} */ (parsed), urls, aliases, acknowledged, today })
    : { globalHoldReasons: [], proposals: [], holds: [], notes: [] };

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: toJstIsoString(new Date()),
    today,
    snapshot: {
      startedAt: manifest.startedAt,
      finishedAt: manifest.finishedAt,
      sources: manifest.entries.map((entry) => ({
        id: entry.id,
        url: entry.url,
        outcome: entry.outcome,
        sha256: entry.sha256 ?? null,
        fetchedAt: entry.fetchedAt,
      })),
    },
    lastModified: {
      implementation: parsed.implementation?.lastModified ?? null,
      formation: parsed.formation?.lastModified ?? null,
      attribute: parsed.attribute?.lastModified ?? null,
      role: parsed.role?.lastModified ?? null,
      eventPieces: parsed.eventPieces?.lastModified ?? null,
    },
    counts: {
      masterCharacters: master.characters.length,
      implementationRows: parsed.implementation?.rows.length ?? null,
      formation: parsed.formation?.ordered.length ?? null,
      events: parsed.eventPieces?.events.length ?? null,
    },
    globalHoldReasons: [...globalHoldReasons, ...comparison.globalHoldReasons],
    proposals: comparison.proposals,
    holds: comparison.holds,
    notes: comparison.notes,
    integrityIssues,
  };
}

// Markdown の表のセルに入れる文字列を整える（| と改行を逃がす）。
function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// 比較結果の一覧を Markdown の表にする。
function findingsTable(findings) {
  if (findings.length === 0) {
    return "なし\n";
  }
  const lines = ["| 区分 | 対象 | 内容 | 詳細 |", "|---|---|---|---|"];
  for (const finding of findings) {
    lines.push(`| ${escapeCell(finding.area)} | ${escapeCell(finding.target)} | ${escapeCell(finding.kind)} | ${escapeCell(finding.detail)} |`);
  }
  return `${lines.join("\n")}\n`;
}

// 報告を Markdown にする。
export function formatReportMarkdown(report) {
  const sections = [
    "# マスターデータ同期 報告（段階1・読み取り専用）",
    "",
    `- 作成: ${report.generatedAt}（判定の基準日: ${report.today}）`,
    `- スナップショット取得: ${report.snapshot.startedAt} 〜 ${report.snapshot.finishedAt}`,
    `- wiki の最終更新: 実装日一覧 ${report.lastModified.implementation ?? "-"} / 編成順 ${report.lastModified.formation ?? "-"} / イベントのピース ${report.lastModified.eventPieces ?? "-"}`,
    `- 件数: マスター ${report.counts.masterCharacters} / 実装日一覧 ${report.counts.implementationRows ?? "-"} / 編成順 ${report.counts.formation ?? "-"} / イベント ${report.counts.events ?? "-"}`,
    "",
    "## 全体の判定",
    "",
    report.globalHoldReasons.length === 0
      ? `全体保留なし。変更候補 ${report.proposals.length} 件 / 保留 ${report.holds.length} 件 / 参考 ${report.notes.length} 件`
      : `**全体保留**\n\n${report.globalHoldReasons.map((reason) => `- ${reason}`).join("\n")}`,
    "",
    "## 変更候補（判定規則を満たしたもの）",
    "",
    findingsTable(report.proposals),
    "## 保留（自動反映しないもの）",
    "",
    findingsTable(report.holds),
    "## 参考（予定・照合のみ）",
    "",
    findingsTable(report.notes),
    "## 既存データの参照整合性",
    "",
    report.integrityIssues.length === 0
      ? "問題なし\n"
      : `| ファイル | 位置 | 名前 | 問題 |\n|---|---|---|---|\n${report.integrityIssues
          .map((issue) => `| ${escapeCell(issue.file)} | ${escapeCell(issue.location)} | ${escapeCell(issue.name)} | ${escapeCell(issue.problem)} |`)
          .join("\n")}\n`,
    "## 取得元",
    "",
    "| id | 結果 | 取得時刻 | sha256(先頭12桁) | URL |",
    "|---|---|---|---|---|",
    ...report.snapshot.sources.map(
      (source) =>
        `| ${source.id} | ${source.outcome} | ${source.fetchedAt ?? "-"} | ${source.sha256 ? source.sha256.slice(0, 12) : "-"} | ${decodeURI(source.url)} |`,
    ),
    "",
  ];
  return sections.join("\n");
}

// コマンドライン引数を解析する。
function parseArgs(argv) {
  /** @type {{ snapshot: string | null, out: string | null, today: string | null }} */
  const options = { snapshot: null, out: null, today: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if ((arg === "--snapshot" || arg === "--out" || arg === "--today") && value) {
      options[/** @type {"snapshot" | "out" | "today"} */ (arg.slice(2))] = value;
      index += 1;
    } else {
      throw new Error(`不明な引数です: ${arg}`);
    }
  }
  if (!options.snapshot) {
    throw new Error("--snapshot <スナップショットのディレクトリ> を指定してください");
  }
  if (options.today && !/^\d{4}-\d{2}-\d{2}$/.test(options.today)) {
    throw new Error("--today は YYYY-MM-DD 形式で指定してください");
  }
  return options;
}

// CLI の入口。報告を書き出し、要約を標準出力に出す。
function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const options = parseArgs(process.argv.slice(2));
  const today = options.today ?? todayInJst();
  const report = buildReport({ snapshotDir: resolve(/** @type {string} */ (options.snapshot)), repoRoot, today });
  const stamp = report.generatedAt.slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const outDir = resolve(options.out ?? join(repoRoot, ".master-sync/reports", stamp));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(join(outDir, "report.md"), formatReportMarkdown(report), "utf8");
  console.log(
    `報告: ${join(outDir, "report.md")}\n全体保留: ${report.globalHoldReasons.length > 0 ? "あり" : "なし"} / 変更候補 ${report.proposals.length} / 保留 ${report.holds.length} / 参考 ${report.notes.length} / 参照整合性の問題 ${report.integrityIssues.length}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
