import connectRankMaterialCostMaster from "../data/connectRankMaterialCost.json";
import type { CharacterProgress, Role } from "../domain/types";

export type ConnectRankMaterialCost = {
  arts: number;
  soul: number;
  guard: number;
  bronzeRegalia: number;
  silverRegalia: number;
  goldRegalia: number;
};

const CONNECT_RANK_MAX = 15;

// ランクアップ時に必要なレガリア数（ロール非依存）。キーはランクアップ先のランク。
const CONNECT_RANK_REGALIA_COST: Record<number, { bronze: number; silver: number; gold: number }> = {
  4: { bronze: 50, silver: 5, gold: 0 },
  7: { bronze: 40, silver: 20, gold: 0 },
  10: { bronze: 30, silver: 25, gold: 0 },
  13: { bronze: 20, silver: 30, gold: 20 },
};

// 素材不足数の初期値を返す。
function createEmptyCost(): ConnectRankMaterialCost {
  return { arts: 0, soul: 0, guard: 0, bronzeRegalia: 0, silverRegalia: 0, goldRegalia: 0 };
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
    bronzeRegalia: left.bronzeRegalia + right.bronzeRegalia,
    silverRegalia: left.silverRegalia + right.silverRegalia,
    goldRegalia: left.goldRegalia + right.goldRegalia,
  };
}

// 現在のコネクトRANKからRANK15までに必要な素材数を計算する。
export function getConnectRankRemainingMaterialCost(
  role: Role,
  connectRank: CharacterProgress["connectRank"],
): ConnectRankMaterialCost {
  type RoleMaterialCost = { arts: number; soul: number; guard: number };
  const roleTable = (connectRankMaterialCostMaster as Record<string, Record<string, RoleMaterialCost>>)[role];
  if (!roleTable) {
    return createEmptyCost();
  }

  let total = createEmptyCost();
  for (let rank = connectRank + 1; rank <= CONNECT_RANK_MAX; rank += 1) {
    const nextCost = roleTable[String(rank)];
    if (nextCost) {
      total.arts += nextCost.arts;
      total.soul += nextCost.soul;
      total.guard += nextCost.guard;
    }
    const regalia = CONNECT_RANK_REGALIA_COST[rank];
    if (regalia) {
      total.bronzeRegalia += regalia.bronze;
      total.silverRegalia += regalia.silver;
      total.goldRegalia += regalia.gold;
    }
  }
  return total;
}
