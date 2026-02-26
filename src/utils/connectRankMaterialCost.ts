import connectRankMaterialCostMaster from "../data/connectRankMaterialCost.json";
import type { CharacterProgress, Role } from "../domain/types";

export type ConnectRankMaterialCost = {
  arts: number;
  soul: number;
  guard: number;
};

const CONNECT_RANK_MAX = 15;

// 素材不足数の初期値を返す。
function createEmptyCost(): ConnectRankMaterialCost {
  return { arts: 0, soul: 0, guard: 0 };
}

// 2つの素材不足数を加算した結果を返す。
export function sumConnectRankMaterialCost(
  left: ConnectRankMaterialCost,
  right: ConnectRankMaterialCost,
): ConnectRankMaterialCost {
  return {
    arts: left.arts + right.arts,
    soul: left.soul + right.soul,
    guard: left.guard + right.guard,
  };
}

// 現在のコネクトRANKからRANK15までに必要な素材数を計算する。
export function getConnectRankRemainingMaterialCost(
  role: Role,
  connectRank: CharacterProgress["connectRank"],
): ConnectRankMaterialCost {
  const roleTable = (connectRankMaterialCostMaster as Record<string, Record<string, ConnectRankMaterialCost>>)[role];
  if (!roleTable) {
    return createEmptyCost();
  }

  let total = createEmptyCost();
  for (let rank = connectRank + 1; rank <= CONNECT_RANK_MAX; rank += 1) {
    const nextCost = roleTable[String(rank)];
    if (!nextCost) {
      continue;
    }
    total = sumConnectRankMaterialCost(total, nextCost);
  }
  return total;
}
