// 段階2の当てはめ（apply.mjs）とゲート判定（gate.mjs）、候補ハッシュのテスト。
import { describe, expect, it } from "vitest";
import { applyProposals } from "./apply.mjs";
import { candidateHash } from "./candidate.mjs";
import { gateCandidate } from "./gate.mjs";

// マスターのキャラを作る。
function character(name, implemented = {}) {
  return {
    name,
    baseName: name,
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: { star6: false, ue1: false, ue1Sp: false, ue2: false, ...implemented },
  };
}

// 検証用の既存マスター一式を作る。
function baseMaster() {
  return {
    characters: [character("A"), character("B", { ue1: true })],
    formationOrder: ["A", "B"],
    hardQuest: { "1-1": "A", "10-1": "B" },
    sideStory: [
      { event: "古い", characters: ["A", "B"] },
      { event: "新しい", characters: ["B", "A"] },
    ],
    coinShop: { arena_coin: ["A"] },
  };
}

// 新キャラ C の追加と、それに伴う変更一式の候補を作る。
function proposals() {
  return [
    {
      area: "キャラ",
      target: "C",
      kind: "新キャラ追加",
      detail: "",
      after: { name: "C", baseName: "C", limited: true, attribute: "水", role: "ヒーラー", implemented: { ue1: true, ue1Sp: false, ue2: false, star6: false } },
      sources: [],
    },
    { area: "キャラ", target: "D", kind: "新キャラ追加", detail: "", after: { name: "D", baseName: "D", limited: false, attribute: "光", role: "タンク", implemented: { ue1: false, ue1Sp: false, ue2: false, star6: false } }, sources: [] },
    { area: "実装状況", target: "A", kind: "★6を実装済みにする", detail: "", before: false, after: true, sources: [] },
    { area: "編成順", target: "C", kind: "編成順に挿入", detail: "", after: { insertAfter: "A", insertBefore: "B" }, sources: [] },
    { area: "編成順", target: "D", kind: "編成順に挿入", detail: "", after: { insertAfter: "A", insertBefore: "B" }, sources: [] },
    { area: "HARD", target: "2-1", kind: "HARD ステージを追加", detail: "", after: "C", sources: [] },
    {
      area: "サイドストーリー",
      target: "中間",
      kind: "サイドストーリーを追加",
      detail: "",
      after: { event: "中間", characters: ["A", "C"], sideStoryAdded: "2025-01-01", insertBefore: "新しい" },
      sources: [],
    },
  ];
}

const REPORT = { globalHoldReasons: [], proposals: proposals() };

describe("applyProposals", () => {
  it("候補を当てはめ、元データは変えない", () => {
    const base = baseMaster();
    const candidate = applyProposals(base, proposals());
    expect(base).toEqual(baseMaster());
    expect(candidate.characters.map((entry) => entry.name)).toEqual(["A", "B", "C", "D"]);
    expect(candidate.characters[2]).toEqual({
      name: "C",
      baseName: "C",
      limited: true,
      attribute: "水",
      role: "ヒーラー",
      implemented: { star6: false, ue1: true, ue1Sp: false, ue2: false },
      memoryPieceSources: [],
    });
    expect(candidate.characters[0].implemented.star6).toBe(true);
    // 同じ基準の後ろに続く新キャラは、wiki の並び順（C→D）を保つ。
    expect(candidate.formationOrder).toEqual(["A", "C", "D", "B"]);
    expect(Object.keys(candidate.hardQuest)).toEqual(["1-1", "2-1", "10-1"]);
    expect(candidate.sideStory.map((entry) => entry.event)).toEqual(["古い", "中間", "新しい"]);
  });

  it("当てはめられない種類の候補や、既に true の項目への候補は例外にする", () => {
    expect(() => applyProposals(baseMaster(), [{ area: "属性", target: "A", kind: "属性を変更する", detail: "", sources: [] }])).toThrow(/当てはめられない種類/);
    expect(() => applyProposals(baseMaster(), [{ area: "実装状況", target: "B", kind: "専用1を実装済みにする", detail: "", sources: [] }])).toThrow(/false→true にできる状態ではありません/);
  });
});

describe("gateCandidate", () => {
  it("報告どおりの候補は合格し、変更の一覧を返す", () => {
    const base = baseMaster();
    const result = gateCandidate({ base, candidate: applyProposals(base, proposals()), report: REPORT });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.changes).toHaveLength(proposals().length);
  });

  it("true→false・既存値の変更・削除・並び替え・報告にない追加・コインショップの変更を不合格にする", () => {
    const base = baseMaster();
    const candidate = applyProposals(base, proposals());
    candidate.characters[1].implemented.ue1 = false;
    candidate.characters[0].attribute = "闇";
    candidate.formationOrder = ["C", "D", "B", "A"];
    candidate.hardQuest["1-1"] = "B";
    candidate.hardQuest["3-1"] = "A";
    candidate.sideStory = candidate.sideStory.slice(1);
    candidate.coinShop.arena_coin.push("B");
    const { ok, failures } = gateCandidate({ base, candidate, report: REPORT });
    expect(ok).toBe(false);
    expect(failures).toEqual(
      expect.arrayContaining([
        "既存キャラ「A」の attribute が変わっている（\"火\" → \"闇\"）",
        "既存キャラ「B」の ue1 が true から変わっている",
        "編成順で既存キャラの削除または並び替えがある",
        "既存の HARD 1-1 が変わっている（A → B）",
        "報告にない HARD 3-1 がある",
        "既存のサイドストーリーの変更・削除・並び替えがある",
        "コインショップのデータが変わっている（同期の対象外）",
      ]),
    );
  });

  it("キャラの削除・形式の誤り・参照整合性の誤り・全体保留を不合格にする", () => {
    const base = baseMaster();
    const candidate = applyProposals(base, proposals());
    candidate.characters = candidate.characters.filter((entry) => entry.name !== "B");
    candidate.characters[1].role = "なにか";
    candidate.sideStory[1].characters = ["A", "存在しない"];
    const { failures } = gateCandidate({ base, candidate, report: { ...REPORT, globalHoldReasons: ["取得失敗"] } });
    expect(failures).toEqual(
      expect.arrayContaining([
        "報告が全体保留になっている（取得失敗）",
        "既存キャラの削除または並び替えがある",
        "新キャラ「C」の形式: role が不正（なにか）",
        "編成順と characterMaster のキャラ集合が一致しない",
        "参照整合性: sideStoryMemoryPiece.json [中間] 存在しない characterMaster.json に存在しない名前",
      ]),
    );
  });

  it("報告の候補が反映されていなければ不合格にする", () => {
    const base = baseMaster();
    const { ok, failures } = gateCandidate({ base, candidate: base, report: REPORT });
    expect(ok).toBe(false);
    expect(failures).toContain(`報告の変更候補 ${proposals().length} 件に対し、反映された変更が 0 件`);
  });
});

describe("candidateHash", () => {
  it("候補の並びに依存せず、内容が変われば変わる", () => {
    const list = proposals();
    expect(candidateHash([...list].reverse())).toBe(candidateHash(list));
    expect(candidateHash(list.slice(1))).not.toBe(candidateHash(list));
    expect(candidateHash(list)).toMatch(/^[0-9a-f]{12}$/);
  });
});
