import { useMemo } from "react";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type {
  LimitBreakFilter,
  LimitedFilter,
  MemorySourceFilter,
  OwnedFilter,
  SortDirection,
  SortKey,
  StarFilter,
  Ue1Filter,
  Ue2Filter,
} from "../../domain/uiStorage";
import { getLimitBreakRemainingMemoryPieceCount } from "../../utils/limitBreakMemoryCost";
import { isCharacterNameMatched } from "../../utils/nameSearch";
import { getConnectRankRemainingMemoryPieceCount } from "../../utils/connectRankMemoryCost";
import {
  getUe1RemainingHeartFragmentCountByMode,
  type Ue1HeartFragmentCalcMode,
} from "../../utils/ue1HeartFragmentCost";
import { getUe1RemainingMemoryPieceCount, type Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import { getStarRemainingMemoryPieceCount, type StarMemoryCalcMode } from "../../utils/starMemoryCost";
import type { VisibleRow } from "./types";

type UseVisibleRowsParams = {
  masterCharacters: MasterCharacter[];
  progressByName: Record<string, CharacterProgress>;
  searchText: string;
  ownedFilter: OwnedFilter;
  limitedFilter: LimitedFilter;
  limitBreakFilter: LimitBreakFilter;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  ue1HeartFragmentCalcMode: Ue1HeartFragmentCalcMode;
  starFilters: StarFilter[];
  ue1Filters: Ue1Filter[];
  ue2Filters: Ue2Filter[];
  memorySourceFilters: MemorySourceFilter[];
  sortKey: SortKey;
  sortDirection: SortDirection;
};

// 専用1の並び順を統一するための比較値を返す。
function getUe1SortValue(character: MasterCharacter, progress: CharacterProgress): number {
  if (!character.implemented.ue1) {
    return -1;
  }
  if (progress.ue1SpEquipped) {
    return 1000;
  }
  return progress.ue1Level ?? 0;
}

// 専用2の並び順を統一するための比較値を返す。
function getUe2SortValue(character: MasterCharacter, progress: CharacterProgress): number {
  if (!character.implemented.ue2) {
    return -1;
  }
  return progress.ue2Level ?? 0;
}

// 所持メモピ数を反映した必要メモピ合計を算出する。
function getAdjustedTotalMemoryNeeded(
  character: MasterCharacter,
  progress: CharacterProgress,
  starMemoryCalcMode: StarMemoryCalcMode,
  ue1MemoryCalcMode: Ue1MemoryCalcMode,
): number {
  const totalNeeded =
    getStarRemainingMemoryPieceCount(character, progress, starMemoryCalcMode) +
    getConnectRankRemainingMemoryPieceCount(progress) +
    getUe1RemainingMemoryPieceCount(character, progress, ue1MemoryCalcMode) +
    getLimitBreakRemainingMemoryPieceCount(character, progress);
  return Math.max(0, totalNeeded - progress.ownedMemoryPiece);
}

// 育成入力テーブルの表示行をフィルタ・ソート条件から算出する。
export function useVisibleRows({
  masterCharacters,
  progressByName,
  searchText,
  ownedFilter,
  limitedFilter,
  limitBreakFilter,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
  ue1HeartFragmentCalcMode,
  starFilters,
  ue1Filters,
  ue2Filters,
  memorySourceFilters,
  sortKey,
  sortDirection,
}: UseVisibleRowsParams): VisibleRow[] {
  const selectedStarSet = useMemo(() => new Set(starFilters), [starFilters]);
  const selectedUe1Set = useMemo(() => new Set(ue1Filters), [ue1Filters]);
  const selectedUe2Set = useMemo(() => new Set(ue2Filters), [ue2Filters]);
  const selectedMemorySourceSet = useMemo(() => new Set(memorySourceFilters), [memorySourceFilters]);

  return useMemo(() => {
    const trimmedSearchText = searchText.trim();
    const filteredRows: Array<{ character: MasterCharacter; progress: CharacterProgress; index: number }> = [];
    const hasStarFilter = selectedStarSet.size > 0;
    const hasUe1Filter = selectedUe1Set.size > 0;
    const hasUe2Filter = selectedUe2Set.size > 0;
    const hasMemorySourceFilter = selectedMemorySourceSet.size > 0;
    const hasNoneSourceFilter = selectedMemorySourceSet.has("none");

    for (let index = 0; index < masterCharacters.length; index += 1) {
      const character = masterCharacters[index];
      if (!character) {
        continue;
      }
      const progress = progressByName[character.name];
      if (!progress) {
        continue;
      }
      if (trimmedSearchText && !isCharacterNameMatched(character.searchTokens ?? character.name, trimmedSearchText)) {
        continue;
      }
      if (ownedFilter === "owned" && !progress.owned) {
        continue;
      }
      if (ownedFilter === "unowned" && progress.owned) {
        continue;
      }
      if (limitedFilter === "limited" && !character.limited) {
        continue;
      }
      if (limitedFilter === "normal" && character.limited) {
        continue;
      }
      if (limitBreakFilter === "on" && !progress.limitBreak) {
        continue;
      }
      if (limitBreakFilter === "off" && progress.limitBreak) {
        continue;
      }
      if (hasStarFilter && !selectedStarSet.has(progress.star)) {
        continue;
      }
      if (hasUe1Filter) {
        let isUe1Matched = false;
        if (!character.implemented.ue1 && selectedUe1Set.has("unimplemented")) {
          isUe1Matched = true;
        } else if (character.implemented.ue1) {
          if (progress.ue1SpEquipped && selectedUe1Set.has("sp")) {
            isUe1Matched = true;
          } else if (!progress.ue1SpEquipped && progress.ue1Level !== null && selectedUe1Set.has(progress.ue1Level)) {
            isUe1Matched = true;
          }
        }
        if (!isUe1Matched) {
          continue;
        }
      }
      if (hasUe2Filter) {
        let isUe2Matched = false;
        if (!character.implemented.ue2 && selectedUe2Set.has("unimplemented")) {
          isUe2Matched = true;
        } else if (character.implemented.ue2 && progress.ue2Level !== null && selectedUe2Set.has(progress.ue2Level)) {
          isUe2Matched = true;
        }
        if (!isUe2Matched) {
          continue;
        }
      }
      if (hasMemorySourceFilter) {
        const isNoneMatched = hasNoneSourceFilter && character.memoryPieceSources.length === 0;
        let isSourceMatched = false;
        if (!isNoneMatched) {
          for (const source of character.memoryPieceSources) {
            if (selectedMemorySourceSet.has(source)) {
              isSourceMatched = true;
              break;
            }
          }
        }
        if (!isNoneMatched && !isSourceMatched) {
          continue;
        }
      }
      filteredRows.push({ character, progress, index });
    }

    if (!sortDirection) {
      return filteredRows.map(({ character, progress }) => ({ character, progress }));
    }

    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    const sortedRows = [...filteredRows].sort((a, b) => {
      const { character: aCharacter, progress: aProgress } = a;
      const { character: bCharacter, progress: bProgress } = b;
      let baseComparison = 0;

      switch (sortKey) {
        case "owned":
          baseComparison = Number(aProgress.owned) - Number(bProgress.owned);
          break;
        case "name":
          baseComparison = aCharacter.name.localeCompare(bCharacter.name, "ja");
          break;
        case "limited":
          baseComparison = Number(aCharacter.limited) - Number(bCharacter.limited);
          break;
        case "limitBreak":
          baseComparison = Number(aProgress.limitBreak) - Number(bProgress.limitBreak);
          break;
        case "star":
          baseComparison = aProgress.star - bProgress.star;
          break;
        case "connectRank":
          baseComparison = aProgress.connectRank - bProgress.connectRank;
          break;
        case "ue1":
          baseComparison = getUe1SortValue(aCharacter, aProgress) - getUe1SortValue(bCharacter, bProgress);
          break;
        case "ue2":
          baseComparison = getUe2SortValue(aCharacter, aProgress) - getUe2SortValue(bCharacter, bProgress);
          break;
        case "ownedMemoryPiece":
          baseComparison = aProgress.ownedMemoryPiece - bProgress.ownedMemoryPiece;
          break;
        case "starMemoryNeeded":
          baseComparison =
            getStarRemainingMemoryPieceCount(aCharacter, aProgress, starMemoryCalcMode) -
            getStarRemainingMemoryPieceCount(bCharacter, bProgress, starMemoryCalcMode);
          break;
        case "connectRankMemoryNeeded":
          baseComparison =
            getConnectRankRemainingMemoryPieceCount(aProgress) - getConnectRankRemainingMemoryPieceCount(bProgress);
          break;
        case "ue1MemoryNeeded":
          baseComparison =
            getUe1RemainingMemoryPieceCount(aCharacter, aProgress, ue1MemoryCalcMode) -
            getUe1RemainingMemoryPieceCount(bCharacter, bProgress, ue1MemoryCalcMode);
          break;
        case "ue1HeartFragmentNeeded":
          baseComparison =
            getUe1RemainingHeartFragmentCountByMode(aCharacter, aProgress, ue1HeartFragmentCalcMode) -
            getUe1RemainingHeartFragmentCountByMode(bCharacter, bProgress, ue1HeartFragmentCalcMode);
          break;
        case "limitBreakMemoryNeeded":
          baseComparison =
            getLimitBreakRemainingMemoryPieceCount(aCharacter, aProgress) -
            getLimitBreakRemainingMemoryPieceCount(bCharacter, bProgress);
          break;
        case "totalMemoryNeeded":
          baseComparison =
            getAdjustedTotalMemoryNeeded(aCharacter, aProgress, starMemoryCalcMode, ue1MemoryCalcMode) -
            getAdjustedTotalMemoryNeeded(bCharacter, bProgress, starMemoryCalcMode, ue1MemoryCalcMode);
          break;
      }

      if (baseComparison !== 0) {
        return baseComparison * directionMultiplier;
      }

      const nameComparison = aCharacter.name.localeCompare(bCharacter.name, "ja");
      if (nameComparison !== 0) {
        return nameComparison;
      }
      return a.index - b.index;
    });

    return sortedRows.map(({ character, progress }) => ({ character, progress }));
  }, [
    limitBreakFilter,
    limitedFilter,
    masterCharacters,
    ownedFilter,
    progressByName,
    searchText,
    selectedMemorySourceSet,
    selectedStarSet,
    selectedUe1Set,
    selectedUe2Set,
    sortDirection,
    sortKey,
    starMemoryCalcMode,
    ue1HeartFragmentCalcMode,
    ue1MemoryCalcMode,
  ]);
}
