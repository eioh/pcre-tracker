import type { CharacterProgress, MasterCharacter } from "../domain/types";
import { UE1_LEVEL_VALUES } from "../domain/levels";

export type Ue1MemoryCalcMode = "implemented_max" | "sp_max";

const UE1_NEXT_COST_BY_LEVEL: Record<number, number> = {
  0: 50,
  30: 10,
  50: 10,
  70: 10,
  90: 10,
  110: 10,
  130: 15,
  140: 15,
  150: 15,
  160: 15,
  170: 15,
  180: 15,
  190: 15,
  200: 15,
  210: 15,
  220: 15,
  230: 5,
  240: 5,
  250: 5,
  260: 5,
  270: 5,
  280: 5,
  290: 5,
  300: 5,
  310: 5,
  320: 5,
  330: 5,
  340: 5,
  350: 5,
  360: 5,
};

const UE1_SP_COST = 300;

// 専用1の現在状態から目標状態までに必要なメモピ数を計算する。
export function getUe1RemainingMemoryPieceCount(
  character: MasterCharacter,
  progress: CharacterProgress,
  mode: Ue1MemoryCalcMode,
): number {
  if (mode === "implemented_max" && !character.implemented.ue1) {
    return 0;
  }

  const currentLevel = progress.ue1Level ?? 0;
  const isCurrentSp = progress.ue1SpEquipped;
  const shouldTargetSp = mode === "sp_max" || (mode === "implemented_max" && character.implemented.ue1Sp);

  if (isCurrentSp) {
    return 0;
  }

  let totalCost = 0;

  for (const level of UE1_LEVEL_VALUES) {
    if (level < currentLevel || level >= 370) {
      continue;
    }
    const nextCost = UE1_NEXT_COST_BY_LEVEL[level];
    if (nextCost) {
      totalCost += nextCost;
    }
  }

  if (shouldTargetSp) {
    totalCost += UE1_SP_COST;
  }

  return totalCost;
}
