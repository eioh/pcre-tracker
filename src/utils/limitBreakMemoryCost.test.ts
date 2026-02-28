import { describe, expect, it } from "vitest";
import { getLimitBreakRemainingMemoryPieceCount } from "./limitBreakMemoryCost";
import type { CharacterProgress, MasterCharacter } from "../domain/types";

// テスト用のマスターキャラを生成する。
function createCharacter(limited: boolean): MasterCharacter {
  return {
    name: "ヒヨリ",
    limited,
    attribute: "火",
    role: "アタッカー",
    implemented: { star6: true, ue1: true, ue1Sp: true, ue2: true },
    memoryPieceSources: [],
  };
}

// テスト用の進捗データを生成する。
function createProgress(partial: Partial<CharacterProgress>): CharacterProgress {
  return {
    owned: true,
    limitBreak: false,
    star: 1,
    connectRank: 1,
    ue1Level: 0,
    ue1SpEquipped: false,
    ue2Level: null,
    ownedMemoryPiece: 0,
    obtainedDate: null,
    gachaPullCount: 0,
    ...partial,
  };
}

describe("getLimitBreakRemainingMemoryPieceCount", () => {
  it("恒常かつ未限界突破なら120になる", () => {
    const character = createCharacter(false);
    const progress = createProgress({ limitBreak: false });

    expect(getLimitBreakRemainingMemoryPieceCount(character, progress)).toBe(120);
  });

  it("限定かつ未限界突破なら40になる", () => {
    const character = createCharacter(true);
    const progress = createProgress({ limitBreak: false });

    expect(getLimitBreakRemainingMemoryPieceCount(character, progress)).toBe(40);
  });

  it("恒常でも限界突破済みなら0になる", () => {
    const character = createCharacter(false);
    const progress = createProgress({ limitBreak: true });

    expect(getLimitBreakRemainingMemoryPieceCount(character, progress)).toBe(0);
  });

  it("限定でも限界突破済みなら0になる", () => {
    const character = createCharacter(true);
    const progress = createProgress({ limitBreak: true });

    expect(getLimitBreakRemainingMemoryPieceCount(character, progress)).toBe(0);
  });

  it("未所持でも未限界突破ならキャラ種別に応じた値になる", () => {
    const normalCharacter = createCharacter(false);
    const limitedCharacter = createCharacter(true);
    const progress = createProgress({ owned: false, limitBreak: false });

    expect(getLimitBreakRemainingMemoryPieceCount(normalCharacter, progress)).toBe(120);
    expect(getLimitBreakRemainingMemoryPieceCount(limitedCharacter, progress)).toBe(40);
  });
});
