// 段階4（来歴チェックと PR・保留台帳の本文作り）のテスト。
import { describe, expect, it } from "vitest";
import { applyProposals } from "./apply.mjs";
import { changesDigest, gateCandidate } from "./gate.mjs";
import { LEDGER_MARKER, buildLedger, buildPrBody, neutralize } from "./open-pr.mjs";
import { checkProvenance, parseTrailers } from "./provenance.mjs";

// マスターのキャラを作る。
function character(name) {
  return { name, baseName: name, limited: false, attribute: "火", role: "アタッカー", implemented: { star6: false, ue1: false, ue1Sp: false, ue2: false } };
}

// 検証用の基準のマスター一式を作る。
function baseMaster() {
  return {
    characters: [character("A"), character("B")],
    formationOrder: ["A", "B"],
    hardQuest: { "1-1": "A" },
    sideStory: [{ event: "古い", characters: ["A", "B"] }],
    coinShop: { arena_coin: ["A"] },
  };
}

const PROPOSALS = [{ area: "実装状況", target: "A", kind: "★6を実装済みにする", detail: "", before: false, after: true, sources: ["https://wiki/impl"] }];
const BRANCH = "feature/master-sync-0123456789ab";

// 基準に候補を当てはめた結果と、その変更の要約ハッシュを trailer に持つコミットメッセージを作る。
function candidateFixture() {
  const base = baseMaster();
  const merged = applyProposals(base, PROPOSALS);
  const digest = changesDigest(gateCandidate({ base, candidate: merged }).changes);
  const headMessage = `feat: 候補\n\n- 変更\n\nMaster-Sync-Candidate: 0123456789ab\nMaster-Sync-Changes-Digest: ${digest}\nMaster-Sync-Base: abc\n`;
  return { base, merged, headMessage };
}

describe("parseTrailers", () => {
  it("Master-Sync- で始まる trailer だけを読む", () => {
    expect(parseTrailers("件名\n\nMaster-Sync-Candidate: abc\nCo-Authored-By: x\n  Master-Sync-Base:  def ")).toEqual({
      "Master-Sync-Candidate": "abc",
      "Master-Sync-Base": "def",
    });
  });
});

describe("checkProvenance", () => {
  it("ブランチ名・trailer・変更ファイル・ゲート・要約ハッシュがそろえば合格する", () => {
    const { base, merged, headMessage } = candidateFixture();
    const result = checkProvenance({ branch: BRANCH, headMessage, changedFiles: ["src/data/characterMaster.json", "src/data/characterMaster.generated.json"], base, merged });
    expect(result).toEqual({ ok: true, failures: [], changes: ["実装状況: A の ★6を実装済みにする"] });
  });

  it("レビュー後に中身が変わった（要約ハッシュの不一致）・対象外のファイル・ハッシュ違いのブランチを不合格にする", () => {
    const { base, merged, headMessage } = candidateFixture();
    merged.characters[1].implemented.ue1 = true;
    const result = checkProvenance({
      branch: "feature/master-sync-ffffffffffff",
      headMessage,
      changedFiles: ["src/data/characterMaster.json", "scripts/master-sync/gate.mjs"],
      base,
      merged,
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      "先頭コミットの Master-Sync-Candidate（0123456789ab）がブランチ名の候補ハッシュ（ffffffffffff）と一致しない",
      "同期の対象外のファイルが変更されている: scripts/master-sync/gate.mjs",
      expect.stringContaining("Master-Sync-Changes-Digest"),
    ]);
  });

  it("構造のゲート（true→false・コインショップの変更など）を報告なしでも適用する", () => {
    const { base, headMessage } = candidateFixture();
    const merged = applyProposals(base, PROPOSALS);
    merged.coinShop.arena_coin.push("B");
    const result = checkProvenance({ branch: BRANCH, headMessage, changedFiles: ["src/data/coinShopMemoryPiece.json"], base, merged });
    expect(result.failures).toEqual(
      expect.arrayContaining(["同期の対象外のファイルが変更されている: src/data/coinShopMemoryPiece.json", "ゲート: コインショップのデータが変わっている（同期の対象外）"]),
    );
  });

  it("候補ブランチの形でない名前は検査しない（不合格）", () => {
    const { base, merged, headMessage } = candidateFixture();
    expect(checkProvenance({ branch: "feature/master-sync", headMessage, changedFiles: [], base, merged }).failures[0]).toMatch(/ブランチ名が/);
  });
});

// PR・台帳の本文作りに使う報告と候補を作る。
function reportFixture() {
  return {
    generatedAt: "2026-10-22T09:00:00+09:00",
    today: "2026-10-22",
    snapshot: { startedAt: "2026-10-22T08:00:00+09:00", sources: [{ id: "impl", url: "https://wiki/impl", fetchedAt: "2026-10-22T08:00:10+09:00", sha256: "a".repeat(64) }] },
    globalHoldReasons: [],
    proposals: PROPOSALS,
    holds: [{ area: "限定区分", target: "B", kind: "限定区分の不一致", detail: "<script>|@someone", sources: [] }],
    notes: [{ area: "編成順", target: "C", kind: "確認済みの差分（マスターの位置を正とする）", detail: "確認済み", sources: [] }],
    integrityIssues: [],
  };
}

describe("PR と保留台帳の本文", () => {
  it("外部由来の文字列のメンション・タグを無効にする", () => {
    expect(neutralize("@user <b>x</b>\n次")).toBe("＠user ＜b＞x＜/b＞ 次");
  });

  it("PR の本文に、変更・AI レビューの判定と引用・出典・来歴を入れ、引用はコードとして表示する", () => {
    const body = buildPrBody({
      candidate: { hash: "0123456789ab", base: { ref: "origin/main", sha: "b".repeat(40) }, gate: { changes: ["実装状況: A の ★6を実装済みにする"] }, verify: { durationMs: 90000 } },
      report: reportFixture(),
      review: { verdict: "approve", items: [{ proposalId: "p1", verdict: "ok", reason: "★6追加日が今日より前 @evil", evidence: [{ sourceUrl: "https://wiki/impl", quote: "| A | 2026/10/01 `x` |" }] }] },
      reviewCheck: { warnings: [] },
      snapshotCommit: "c".repeat(40),
    });
    expect(body).toContain("- 実装状況: A の ★6を実装済みにする");
    expect(body).toContain("| p1 | ★6を実装済みにする: A | ok | ★6追加日が今日より前 ＠evil | `\\| A \\| 2026/10/01 ｀x｀ \\|` |");
    expect(body).toContain("- 候補ハッシュ: `0123456789ab`");
    expect(body).toContain("eioh/pcre-tracker-snapshots `cccccccccccc`");
    expect(body).toContain("| https://wiki/impl | 2026-10-22T08:00:10+09:00 | aaaaaaaaaaaa |");
  });

  it("保留台帳に目印・保留・確認済みの差分・PR にしなかった理由を入れる", () => {
    const ledger = buildLedger({
      report: reportFixture(),
      candidate: { status: "ゲート不合格（ブランチを作らない）", hash: "0123456789ab" },
      prepare: { ok: false, failures: ["AI レビュー: p1 の判定が ok でない"] },
    });
    expect(ledger.startsWith(LEDGER_MARKER)).toBe(true);
    expect(ledger).toContain("| 限定区分 | B | 限定区分の不一致 | ＜script＞\\|＠someone |");
    expect(ledger).toContain("- 編成順: C（確認済み）");
    expect(ledger).toContain("  - AI レビュー: p1 の判定が ok でない");
  });

  it("PR を見送った理由を保留台帳に入れる", () => {
    const ledger = buildLedger({ report: reportFixture(), candidate: null, prepare: null, skipReason: "未マージの同期 PR #70 があるため見送り" });
    expect(ledger).toContain("- PR を見送った理由: 未マージの同期 PR #70 があるため見送り");
    expect(ledger).toContain("- 今回の候補: なし");
  });
});
