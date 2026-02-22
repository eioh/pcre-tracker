import type { CharacterProgress, MasterCharacter } from "../domain/types";

export type StarMemoryCalcMode = "implemented_max" | "star6_max";

type StarStepCost = {
  from: CharacterProgress["star"];
  to: CharacterProgress["star"];
  normal: number;
  limited: number;
};

const STAR_STEP_COSTS: StarStepCost[] = [
  { from: 1, to: 2, normal: 30, limited: 30 },
  { from: 2, to: 3, normal: 100, limited: 100 },
  { from: 3, to: 4, normal: 120, limited: 120 },
  { from: 4, to: 5, normal: 150, limited: 150 },
  { from: 5, to: 6, normal: 50, limited: 25 },
];

export const STAR_MEMORY_FILTER_VALUES = [0, 25, 50, 150, 175, 200, 270, 295, 320, 370, 395, 400, 420, 425, 450];

// ☆の現在状態から目標状態までに必要なメモピ数を計算する。
export function getStarRemainingMemoryPieceCount(
  character: MasterCharacter,
  progress: CharacterProgress,
  mode: StarMemoryCalcMode,
): number {
  const targetStar: CharacterProgress["star"] = mode === "star6_max" ? 6 : character.implemented.star6 ? 6 : 5;
  if (progress.star >= targetStar) {
    return 0;
  }

  let totalCost = 0;
  for (const step of STAR_STEP_COSTS) {
    if (step.from < progress.star || step.to > targetStar) {
      continue;
    }
    totalCost += character.limited ? step.limited : step.normal;
  }
  return totalCost;
}
