import { describe, expect, it } from "vitest";
import { getStarRemainingMemoryPieceCount } from "./starMemoryCost";
import type { CharacterProgress, MasterCharacter } from "../domain/types";

function createCharacter(params: {
  limited: boolean;
  implemented: MasterCharacter["implemented"];
}): MasterCharacter {
  // テスト用のマスターキャラを生成する。
  return {
    name: "ヒヨリ",
    limited: params.limited,
    attribute: "火",
    role: "アタッカー",
    implemented: params.implemented,
    memoryPieceSources: [],
  };
}

function createProgress(partial: Partial<CharacterProgress>): CharacterProgress {
  // テスト用の進捗データを生成する。
  return {
    owned: true,
    limitBreak: false,
    star: 1,
    connectRank: 1,
    ue1Level: 0,
    ue1SpEquipped: false,
    ue2Level: null,
    updatedAt: "2026-02-22T00:00:00.000Z",
    ...partial,
  };
}

describe("getStarRemainingMemoryPieceCount", () => {
  it("恒常キャラは☆1から☆6まで450になる", () => {
    const character = createCharacter({
      limited: false,
      implemented: { star6: true, ue1: false, ue1Sp: false, ue2: false },
    });
    const progress = createProgress({ star: 1 });

    const result = getStarRemainingMemoryPieceCount(character, progress, "implemented_max");
    expect(result).toBe(450);
  });

  it("限定キャラは☆1から☆6まで425になる", () => {
    const character = createCharacter({
      limited: true,
      implemented: { star6: true, ue1: false, ue1Sp: false, ue2: false },
    });
    const progress = createProgress({ star: 1 });

    const result = getStarRemainingMemoryPieceCount(character, progress, "implemented_max");
    expect(result).toBe(425);
  });

  it("☆6未実装キャラは実装段階モードで☆5が上限になる", () => {
    const character = createCharacter({
      limited: false,
      implemented: { star6: false, ue1: false, ue1Sp: false, ue2: false },
    });
    const progress = createProgress({ star: 5 });

    const result = getStarRemainingMemoryPieceCount(character, progress, "implemented_max");
    expect(result).toBe(0);
  });

  it("☆6最大モードなら☆6未実装でも☆5から☆6分を計算する", () => {
    const character = createCharacter({
      limited: false,
      implemented: { star6: false, ue1: false, ue1Sp: false, ue2: false },
    });
    const progress = createProgress({ star: 5 });

    const result = getStarRemainingMemoryPieceCount(character, progress, "star6_max");
    expect(result).toBe(50);
  });

  it("限定キャラの☆5から☆6は25になる", () => {
    const character = createCharacter({
      limited: true,
      implemented: { star6: false, ue1: false, ue1Sp: false, ue2: false },
    });
    const progress = createProgress({ star: 5 });

    const result = getStarRemainingMemoryPieceCount(character, progress, "star6_max");
    expect(result).toBe(25);
  });

  it("現在☆6なら常に0になる", () => {
    const character = createCharacter({
      limited: false,
      implemented: { star6: true, ue1: true, ue1Sp: true, ue2: true },
    });
    const progress = createProgress({ star: 6 });

    const implementedResult = getStarRemainingMemoryPieceCount(character, progress, "implemented_max");
    const star6Result = getStarRemainingMemoryPieceCount(character, progress, "star6_max");
    expect(implementedResult).toBe(0);
    expect(star6Result).toBe(0);
  });
});
