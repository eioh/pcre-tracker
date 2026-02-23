import type { CharacterProgress, MasterCharacter } from "../domain/types";

// 限界突破の現在状態から必要なメモピ数を計算する。
export function getLimitBreakRemainingMemoryPieceCount(
  character: MasterCharacter,
  progress: CharacterProgress,
): number {
  if (progress.limitBreak) {
    return 0;
  }
  return character.limited ? 40 : 120;
}
