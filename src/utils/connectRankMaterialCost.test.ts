import { describe, expect, it } from "vitest";
import { getConnectRankRemainingMaterialCost, getConnectRankRangeMaterialCost } from "./connectRankMaterialCost";
import type { CharacterProgress, Role } from "../domain/types";

// 進捗とロールから必要素材数を取得するための補助関数。
function getCost(role: Role, connectRank: CharacterProgress["connectRank"]) {
  return getConnectRankRemainingMaterialCost(role, connectRank);
}

describe("getConnectRankRemainingMaterialCost", () => {
  it("アタッカーの未開放(0)はRANK1を含むRANK15までの残素材を計算できる", () => {
    expect(getCost("アタッカー", 0)).toEqual({ arts: 126, soul: 270, guard: 66, bronzeRegalia: 140, silverRegalia: 80, goldRegalia: 20 });
  });

  it("アタッカーのRANK1はRANK15までの残素材を計算できる", () => {
    expect(getCost("アタッカー", 1)).toEqual({ arts: 120, soul: 256, guard: 66, bronzeRegalia: 140, silverRegalia: 80, goldRegalia: 20 });
  });

  it("タンクのRANK7は残素材を計算できる", () => {
    expect(getCost("タンク", 7)).toEqual({ arts: 41, soul: 82, guard: 162, bronzeRegalia: 50, silverRegalia: 55, goldRegalia: 20 });
  });

  it("バッファーのRANK10は残素材を計算できる", () => {
    expect(getCost("バッファー", 10)).toEqual({ arts: 106, soul: 28, guard: 66, bronzeRegalia: 20, silverRegalia: 30, goldRegalia: 20 });
  });

  it("ブースターのRANK15は残素材が0になる", () => {
    expect(getCost("ブースター", 15)).toEqual({ arts: 0, soul: 0, guard: 0, bronzeRegalia: 0, silverRegalia: 0, goldRegalia: 0 });
  });
});

// 範囲指定とRANK15指定の結果が一致することを確認するための補助関数。
function getRangeCost(role: Role, currentRank: CharacterProgress["connectRank"], targetRank: CharacterProgress["connectRank"]) {
  return getConnectRankRangeMaterialCost(role, currentRank, targetRank);
}

describe("getConnectRankRangeMaterialCost", () => {
  it("targetRank=15の場合はgetConnectRankRemainingMaterialCostと同じ結果になる", () => {
    expect(getRangeCost("アタッカー", 0, 15)).toEqual(getCost("アタッカー", 0));
    expect(getRangeCost("タンク", 7, 15)).toEqual(getCost("タンク", 7));
  });

  it("targetRank <= currentRankの場合は素材0を返す", () => {
    expect(getRangeCost("アタッカー", 5, 5)).toEqual({ arts: 0, soul: 0, guard: 0, bronzeRegalia: 0, silverRegalia: 0, goldRegalia: 0 });
    expect(getRangeCost("アタッカー", 10, 3)).toEqual({ arts: 0, soul: 0, guard: 0, bronzeRegalia: 0, silverRegalia: 0, goldRegalia: 0 });
  });

  it("部分範囲の素材を正しく計算できる", () => {
    const rank0to5 = getRangeCost("アタッカー", 0, 5);
    const rank5to10 = getRangeCost("アタッカー", 5, 10);
    const rank10to15 = getRangeCost("アタッカー", 10, 15);
    const rank0to15 = getRangeCost("アタッカー", 0, 15);

    // 3区間の合計がRANK0→15の合計と一致する。
    expect(rank0to5.arts + rank5to10.arts + rank10to15.arts).toBe(rank0to15.arts);
    expect(rank0to5.soul + rank5to10.soul + rank10to15.soul).toBe(rank0to15.soul);
    expect(rank0to5.guard + rank5to10.guard + rank10to15.guard).toBe(rank0to15.guard);
    expect(rank0to5.bronzeRegalia + rank5to10.bronzeRegalia + rank10to15.bronzeRegalia).toBe(rank0to15.bronzeRegalia);
    expect(rank0to5.silverRegalia + rank5to10.silverRegalia + rank10to15.silverRegalia).toBe(rank0to15.silverRegalia);
    expect(rank0to5.goldRegalia + rank5to10.goldRegalia + rank10to15.goldRegalia).toBe(rank0to15.goldRegalia);
  });
});
