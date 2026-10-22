import { describe, expect, it } from "vitest";
import { checkReferenceIntegrity } from "./integrity.mjs";

// 検査用の最小限のキャラ定義を作る。
function character(name) {
  return {
    name,
    baseName: name,
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: { star6: false, ue1: false, ue1Sp: false, ue2: false },
  };
}

describe("checkReferenceIntegrity", () => {
  it("マスターにない名前（表記揺れを含む）と重複を検出する", () => {
    const issues = checkReferenceIntegrity({
      characters: [character("ペコリーヌ"), character("コッコロ")],
      formationOrder: ["ペコリーヌ", "コッコロ"],
      hardQuest: { "1-1": "コッコロ", "1-2": "キャル" },
      sideStory: [
        { event: "A", characters: ["ぺコリーヌ"] },
        { event: "A", characters: ["コッコロ"] },
      ],
      coinShop: { arena_coin: ["コッコロ", "コッコロ"] },
    });
    expect(issues).toEqual([
      { file: "hardQuestMemoryPiece.json", location: "1-2", name: "キャル", problem: "characterMaster.json に存在しない名前" },
      { file: "sideStoryMemoryPiece.json", location: "A", name: "ぺコリーヌ", problem: "characterMaster.json に存在しない名前" },
      { file: "sideStoryMemoryPiece.json", location: "A", name: "", problem: "イベント名の重複" },
      { file: "coinShopMemoryPiece.json", location: "arena_coin", name: "コッコロ", problem: "同じコイン種別内での重複" },
    ]);
  });

  it("問題がなければ空配列を返す", () => {
    expect(
      checkReferenceIntegrity({
        characters: [character("コッコロ")],
        formationOrder: ["コッコロ"],
        hardQuest: { "1-1": "コッコロ" },
        sideStory: [{ event: "A", characters: ["コッコロ"] }],
        coinShop: { arena_coin: ["コッコロ"] },
      }),
    ).toEqual([]);
  });
});
