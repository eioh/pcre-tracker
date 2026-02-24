import type { CharacterProgress } from "../domain/types";

const CONNECT_RANK_MEMORY_COST_BY_UNLOCK_RANK: Record<number, number> = {
  6: 5,
  9: 5,
  12: 10,
};

const CONNECT_RANK_MAX = 15;

// 現在のコネクトRANKからRANK15までに必要なメモピ数を計算する。
export function getConnectRankRemainingMemoryPieceCount(progress: CharacterProgress): number {
  let totalCost = 0;

  for (const [unlockRankText, cost] of Object.entries(CONNECT_RANK_MEMORY_COST_BY_UNLOCK_RANK)) {
    const unlockRank = Number(unlockRankText);
    if (progress.connectRank <= unlockRank && unlockRank < CONNECT_RANK_MAX) {
      totalCost += cost;
    }
  }

  return totalCost;
}
