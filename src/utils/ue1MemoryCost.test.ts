import { describe, expect, it } from "vitest";
import { getUe1RemainingMemoryPieceCount } from "./ue1MemoryCost";
import type { CharacterProgress, MasterCharacter } from "../domain/types";

function createCharacter(implemented: MasterCharacter["implemented"]): MasterCharacter {
  // テスト用のマスターキャラを生成する。
  return {
    name: "ヒヨリ",
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented,
    memoryPieceSources: [],
  };
}

function createProgress(partial: Partial<CharacterProgress>): CharacterProgress {
  // テスト用の進捗データを生成する。
  return {
    owned: true,
    limitBreak: false,
    star: 1,
    ue1Level: 0,
    ue1SpEquipped: false,
    ue2Level: null,
    updatedAt: "2026-02-22T00:00:00.000Z",
    ...partial,
  };
}

describe("getUe1RemainingMemoryPieceCount", () => {
  it("実装段階モードでは専用1未実装キャラは0になる", () => {
    const character = createCharacter({ star6: true, ue1: false, ue1Sp: false, ue2: false });
    const progress = createProgress({ ue1Level: null });

    const result = getUe1RemainingMemoryPieceCount(character, progress, "implemented_max");
    expect(result).toBe(0);
  });

  it("SP最大モードでは専用1未実装でも0からSPまでを計算する", () => {
    const character = createCharacter({ star6: true, ue1: false, ue1Sp: false, ue2: false });
    const progress = createProgress({ ue1Level: null });

    const result = getUe1RemainingMemoryPieceCount(character, progress, "sp_max");
    expect(result).toBe(620);
  });

  it("実装段階モードで専用1SP未実装キャラは370までの残必要数を計算する", () => {
    const character = createCharacter({ star6: true, ue1: true, ue1Sp: false, ue2: false });
    const progress = createProgress({ ue1Level: 50, ue1SpEquipped: false });

    const result = getUe1RemainingMemoryPieceCount(character, progress, "implemented_max");
    expect(result).toBe(260);
  });

  it("実装段階モードで専用1SP実装キャラはSPまでを計算する", () => {
    const character = createCharacter({ star6: true, ue1: true, ue1Sp: true, ue2: false });
    const progress = createProgress({ ue1Level: 370, ue1SpEquipped: false });

    const result = getUe1RemainingMemoryPieceCount(character, progress, "implemented_max");
    expect(result).toBe(300);
  });

  it("現在SPの場合は常に0になる", () => {
    const character = createCharacter({ star6: true, ue1: true, ue1Sp: true, ue2: false });
    const progress = createProgress({ ue1Level: 370, ue1SpEquipped: true });

    const implementedResult = getUe1RemainingMemoryPieceCount(character, progress, "implemented_max");
    const spResult = getUe1RemainingMemoryPieceCount(character, progress, "sp_max");

    expect(implementedResult).toBe(0);
    expect(spResult).toBe(0);
  });
});
