import type { CharacterProgress, MasterCharacter } from "../domain/types";
import { UE1_LEVEL_VALUES } from "../domain/levels";

export type Ue1HeartFragmentCalcMode = "implemented_max" | "all_max";

const UE1_NEXT_HEART_FRAGMENT_COST_BY_LEVEL: Record<number, number> = {
  0: 30,
  30: 5,
  50: 5,
  70: 8,
  90: 10,
  110: 10,
  130: 10,
  140: 10,
  150: 10,
  160: 10,
  170: 10,
  180: 10,
  190: 10,
  200: 10,
  210: 10,
  220: 10,
  230: 10,
  240: 10,
  250: 10,
  260: 10,
  270: 10,
  280: 10,
  290: 10,
  300: 10,
  310: 10,
  320: 10,
  330: 10,
  340: 10,
  350: 10,
  360: 20,
};

// 現在レベルから専用1Lv370までに必要なハートの欠片を積算する。
function getRemainingHeartFragmentCountFromCurrentLevel(progress: CharacterProgress): number {
  if (progress.ue1SpEquipped) {
    return 0;
  }

  const currentLevel = progress.ue1Level ?? 0;
  let totalCost = 0;

  for (const level of UE1_LEVEL_VALUES) {
    if (level < currentLevel || level >= 370) {
      continue;
    }
    totalCost += UE1_NEXT_HEART_FRAGMENT_COST_BY_LEVEL[level] ?? 0;
  }

  return totalCost;
}

// 専用1実装キャラのみを対象に、現在状態からLv370までの必要ハートの欠片数を返す。
export function getUe1RemainingHeartFragmentCount(character: MasterCharacter, progress: CharacterProgress): number {
  if (!character.implemented.ue1) {
    return 0;
  }
  return getRemainingHeartFragmentCountFromCurrentLevel(progress);
}

// 専用1未実装キャラも将来実装される前提で、現在状態からLv370までの必要ハートの欠片数を返す。
export function getUe1RemainingHeartFragmentCountToMaxAssumed(progress: CharacterProgress): number {
  return getRemainingHeartFragmentCountFromCurrentLevel(progress);
}

// 計算モードに応じて専用1の必要ハートの欠片数を返す。
export function getUe1RemainingHeartFragmentCountByMode(
  character: MasterCharacter,
  progress: CharacterProgress,
  mode: Ue1HeartFragmentCalcMode,
): number {
  return mode === "all_max"
    ? getUe1RemainingHeartFragmentCountToMaxAssumed(progress)
    : getUe1RemainingHeartFragmentCount(character, progress);
}
