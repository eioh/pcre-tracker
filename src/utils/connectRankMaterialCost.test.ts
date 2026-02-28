import { describe, expect, it } from "vitest";
import { getConnectRankRemainingMaterialCost } from "./connectRankMaterialCost";
import type { CharacterProgress, Role } from "../domain/types";

// 進捗とロールから必要素材数を取得するための補助関数。
function getCost(role: Role, connectRank: CharacterProgress["connectRank"]) {
  return getConnectRankRemainingMaterialCost(role, connectRank);
}

describe("getConnectRankRemainingMaterialCost", () => {
  it("アタッカーの未開放(0)はRANK1を含むRANK15までの残素材を計算できる", () => {
    expect(getCost("アタッカー", 0)).toEqual({ arts: 126, soul: 270, guard: 66 });
  });

  it("アタッカーのRANK1はRANK15までの残素材を計算できる", () => {
    expect(getCost("アタッカー", 1)).toEqual({ arts: 120, soul: 256, guard: 66 });
  });

  it("タンクのRANK7は残素材を計算できる", () => {
    expect(getCost("タンク", 7)).toEqual({ arts: 41, soul: 82, guard: 162 });
  });

  it("バッファーのRANK10は残素材を計算できる", () => {
    expect(getCost("バッファー", 10)).toEqual({ arts: 106, soul: 28, guard: 66 });
  });

  it("ブースターのRANK15は残素材が0になる", () => {
    expect(getCost("ブースター", 15)).toEqual({ arts: 0, soul: 0, guard: 0 });
  });
});
