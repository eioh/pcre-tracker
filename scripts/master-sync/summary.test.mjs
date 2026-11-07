// summary.mjs（報告の件数だけの要約）のテスト。
import { describe, expect, it } from "vitest";
import { summarizeReport } from "./summary.mjs";

// テスト用の報告を作る。各項目には、公開してはいけない取得元由来の文字列を入れておく。
function buildReport({ globalHoldReasons = [], proposals = [], holds = [], notes = [] } = {}) {
  return { globalHoldReasons, proposals, holds, notes };
}

const SECRET = "取得元由来の文字列";

describe("summarizeReport", () => {
  it("差分がなければ知らせず、件数だけを書く", () => {
    const { markdown, needsAttention } = summarizeReport(buildReport({ holds: [{ target: SECRET }], notes: [{ detail: SECRET }] }));
    expect(needsAttention).toBe(false);
    expect(markdown).toContain("全体保留: なし / 変更候補 0 件 / 保留 1 件 / 参考 1 件");
  });

  it("変更候補があれば知らせる", () => {
    const { needsAttention } = summarizeReport(buildReport({ proposals: [{ target: SECRET }] }));
    expect(needsAttention).toBe(true);
  });

  it("全体保留なら知らせる", () => {
    const { markdown, needsAttention } = summarizeReport(buildReport({ globalHoldReasons: [SECRET] }));
    expect(needsAttention).toBe(true);
    expect(markdown).toContain("全体保留: あり（1 件）");
  });

  // 公開の画面に出るので、キャラ名や保留の理由などの文字列は件数以外に一切含めない。
  it("取得元由来の文字列を含めない", () => {
    const item = { kind: SECRET, target: SECRET, detail: SECRET, sources: [SECRET] };
    const { markdown } = summarizeReport(
      buildReport({ globalHoldReasons: [SECRET], proposals: [item], holds: [item], notes: [item] }),
    );
    expect(markdown).not.toContain(SECRET);
  });
});
