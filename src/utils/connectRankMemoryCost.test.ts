import { describe, expect, it } from "vitest";
import type { CharacterProgress } from "../domain/types";
import { getConnectRankRemainingMemoryPieceCount } from "./connectRankMemoryCost";

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
    updatedAt: "2026-02-24T00:00:00.000Z",
    ...partial,
  };
}

describe("getConnectRankRemainingMemoryPieceCount", () => {
  it("RANK1からRANK15までの必要メモピは20になる", () => {
    const progress = createProgress({ connectRank: 1 });
    expect(getConnectRankRemainingMemoryPieceCount(progress)).toBe(20);
  });

  it("RANK7は6→7解放済みなので残り15になる", () => {
    const progress = createProgress({ connectRank: 7 });
    expect(getConnectRankRemainingMemoryPieceCount(progress)).toBe(15);
  });

  it("RANK10は6→7と9→10解放済みなので残り10になる", () => {
    const progress = createProgress({ connectRank: 10 });
    expect(getConnectRankRemainingMemoryPieceCount(progress)).toBe(10);
  });

  it("RANK13以降は必要メモピが0になる", () => {
    expect(getConnectRankRemainingMemoryPieceCount(createProgress({ connectRank: 13 }))).toBe(0);
    expect(getConnectRankRemainingMemoryPieceCount(createProgress({ connectRank: 15 }))).toBe(0);
  });
});
