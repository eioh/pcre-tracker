import { describe, expect, it } from "vitest";
import type { CharacterProgress, MasterCharacter } from "../domain/types";
import {
  getUe1RemainingHeartFragmentCount,
  getUe1RemainingHeartFragmentCountToMaxAssumed,
} from "./ue1HeartFragmentCost";

// テスト用のマスターキャラを生成する。
function createCharacter(implemented: MasterCharacter["implemented"]): MasterCharacter {
  return {
    name: "ヒヨリ",
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented,
    memoryPieceSources: [],
  };
}

// テスト用の進捗データを生成する。
function createProgress(partial: Partial<CharacterProgress>): CharacterProgress {
  return {
    owned: true,
    limitBreak: false,
    star: 1,
    ue1Level: 0,
    ue1SpEquipped: false,
    ue2Level: null,
    ownedMemoryPiece: 0,
    updatedAt: "2026-02-23T00:00:00.000Z",
    ...partial,
  };
}

describe("ue1HeartFragmentCost", () => {
  it("専用1実装キャラは現在レベルからLv370までの必要数を計算できる", () => {
    const character = createCharacter({ star6: true, ue1: true, ue1Sp: false, ue2: false });
    const progress = createProgress({ ue1Level: 70 });

    const result = getUe1RemainingHeartFragmentCount(character, progress);
    expect(result).toBe(278);
  });

  it("専用1未実装キャラは実装キャラ分集計では0になる", () => {
    const character = createCharacter({ star6: true, ue1: false, ue1Sp: false, ue2: false });
    const progress = createProgress({ ue1Level: null });

    const result = getUe1RemainingHeartFragmentCount(character, progress);
    expect(result).toBe(0);
  });

  it("専用1未実装キャラでも最大想定集計ではLv0起点で計算できる", () => {
    const progress = createProgress({ ue1Level: null });

    const result = getUe1RemainingHeartFragmentCountToMaxAssumed(progress);
    expect(result).toBe(318);
  });

  it("専用1Lv370またはSP装備済みは必要数0になる", () => {
    const character = createCharacter({ star6: true, ue1: true, ue1Sp: true, ue2: false });
    const maxLevelProgress = createProgress({ ue1Level: 370 });
    const spProgress = createProgress({ ue1Level: 370, ue1SpEquipped: true });

    expect(getUe1RemainingHeartFragmentCount(character, maxLevelProgress)).toBe(0);
    expect(getUe1RemainingHeartFragmentCount(character, spProgress)).toBe(0);
    expect(getUe1RemainingHeartFragmentCountToMaxAssumed(spProgress)).toBe(0);
  });
});
