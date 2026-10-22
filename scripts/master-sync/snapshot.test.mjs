// 保存した実ページ（非公開のスナップショット用リポジトリ）を使う解析器のテスト。
// 公開リポジトリに本文を置かないため、環境変数 MASTER_SYNC_SNAPSHOT_DIR に latest/ のパスを指定したときだけ実行する。
// 例: MASTER_SYNC_SNAPSHOT_DIR=../pcre-tracker-snapshots/latest npx vitest run --project scripts
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ATTRIBUTES, ROLES, parseCategoryPage, parseEventPieces, parseFormation, parseImplementationDates, parseQuestPage } from "./parsers.mjs";
import { buildReport } from "./report.mjs";

const snapshotDir = process.env.MASTER_SYNC_SNAPSHOT_DIR ? resolve(process.env.MASTER_SYNC_SNAPSHOT_DIR) : null;
const enabled = Boolean(snapshotDir && existsSync(join(snapshotDir, "manifest.json")));
const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

// スナップショットのページ本文を読む。
function read(id) {
  return readFileSync(join(/** @type {string} */ (snapshotDir), `${id}.html`), "utf8");
}

describe.skipIf(!enabled)("実ページのスナップショット", () => {
  it("実装日一覧は 1 キャラ 1 行で、列がそろっている", () => {
    const { rows } = parseImplementationDates(read("implementation-dates"));
    expect(rows.length).toBeGreaterThanOrEqual(350);
    expect(rows.every((row) => ATTRIBUTES.includes(row.attribute) && ROLES.includes(row.role))).toBe(true);
  });

  it("編成順は掲載方向（←後方 前方→）を反転して先頭をリマにし、折り畳みの旧版（中衛）を読まない", () => {
    const { ordered, sections } = parseFormation(read("formation"));
    expect(ordered[0]).toBe("リマ");
    expect(sections.every((section) => section.direction === "back-to-front")).toBe(true);
    expect(new Set(ordered).size).toBe(ordered.length);
    // 旧版の表を混ぜると重複が出るか件数が増える。実装日一覧の実装済みキャラ数と一致することで確かめる。
    const released = parseImplementationDates(read("implementation-dates")).rows.filter((row) => row.linkName).length;
    expect(ordered.length).toBe(released);
  });

  it("属性別・ロール別のキャラ数の合計が編成順の人数と一致する（ロールのアイコンを数えない）", () => {
    const total = parseFormation(read("formation")).ordered.length;
    for (const [id, categories] of /** @type {const} */ ([
      ["attribute", ATTRIBUTES],
      ["role", ROLES],
    ])) {
      expect([...parseCategoryPage(read(id), categories).byCategory.values()].flat().length).toBe(total);
    }
  });

  it("HARD のページはメモリーピース、VH のページはピュアメモリーピースだけを返す", () => {
    for (const id of ["hard-h81", "hard-h82"]) {
      const { stages } = parseQuestPage(read(id));
      expect(stages.length).toBeGreaterThan(0);
      expect(stages.every((stage) => stage.pieceKind === "memory" && stage.stagePrefix === "H")).toBe(true);
    }
    const { stages } = parseQuestPage(read("very-hard-vh68"));
    expect(stages.length).toBeGreaterThan(0);
    expect(stages.every((stage) => stage.pieceKind === "pure" && stage.stagePrefix === "VH")).toBe(true);
  });

  it("イベントのピースは結合セルを展開して、各行がイベント名と 2 人のピースを持つ", () => {
    const { events } = parseEventPieces(read("event-pieces"));
    expect(events.length).toBeGreaterThanOrEqual(80);
    expect(events.every((event) => event.event.length > 0 && event.pieces.length === 2)).toBe(true);
    // 前編・後編に分かれたイベントは、分割名ごとに 1 行になる。
    expect(events.filter((event) => event.part === "後編").length).toBeGreaterThan(0);
  });

  it("報告に false 化・削除の変更候補が含まれない", () => {
    const report = buildReport({ snapshotDir: /** @type {string} */ (snapshotDir), repoRoot, today: "2026-10-21" });
    expect(report.globalHoldReasons).toEqual([]);
    expect(report.proposals.some((proposal) => proposal.after === false || /削除/.test(proposal.kind))).toBe(false);
  });
});
