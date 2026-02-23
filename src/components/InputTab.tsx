import { useEffect, useRef, useMemo, useState } from "react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../domain/levels";
import type { CharacterProgress, MasterCharacter, MemoryPieceSource, StoredStateV1 } from "../domain/types";
import type {
  InputViewSettings,
  LimitBreakFilter,
  LimitedFilter,
  MemorySourceFilter,
  OwnedFilter,
  SortDirection,
  SortKey,
  StarFilter,
  StarMemoryNeedFilter,
  Ue1Filter,
  Ue2Filter,
} from "../domain/uiStorage";
import { getLimitBreakRemainingMemoryPieceCount } from "../utils/limitBreakMemoryCost";
import { isCharacterNameMatched } from "../utils/nameSearch";
import { getUe1RemainingMemoryPieceCount, type Ue1MemoryCalcMode } from "../utils/ue1MemoryCost";
import {
  getStarRemainingMemoryPieceCount,
  STAR_MEMORY_FILTER_VALUES,
  type StarMemoryCalcMode,
} from "../utils/starMemoryCost";

type ProgressPatch = Partial<
  Pick<CharacterProgress, "owned" | "limitBreak" | "star" | "ue1Level" | "ue1SpEquipped" | "ue2Level">
>;

type InputTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  initialSettings: InputViewSettings;
  onSettingsChange: (settings: InputViewSettings) => void;
};

const memorySourceLabelMap: Record<MemoryPieceSource, string> = {
  dungeon_coin: "ダンジョン",
  arena_coin: "アリーナ",
  p_arena_coin: "プリーナ",
  clan_coin: "クラン",
  master_coin: "マスター",
  hard_quest: "ハード",
  side_story: "サイド",
};

const panelClass =
  "rounded-[18px] border border-white/30 bg-linear-to-br from-[#131a27cc] to-[#0d1421f2] p-5 shadow-panel";
const inputToolbarClass = "grid grid-cols-1 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]";
const fieldGroupClass = "grid gap-1.5 text-sm text-muted";
const controlClass =
  "w-full rounded-[12px] border border-white/20 bg-[#090e17d9] px-3 py-2.5 text-sm text-main outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40";
const multiSelectSummaryClass = `${controlClass} cursor-pointer list-none select-none overflow-hidden text-ellipsis whitespace-nowrap [&::-webkit-details-marker]:hidden`;
const multiSelectPanelClass =
  "absolute left-0 top-[calc(100%+6px)] z-10 grid max-h-60 w-full gap-2 overflow-auto rounded-[12px] border border-white/20 bg-[#090e17f5] px-2.5 py-2 shadow-panel";
const multiSelectItemClass = "inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-main";
const memoryCalcSectionClass = "col-span-full mt-0.5 border-t border-[#7a94c547] pt-3.5";
const memoryCalcGridClass = "grid grid-cols-1 gap-3 md:grid-cols-[repeat(2,minmax(220px,300px))]";
const tableWrapClass =
  "overflow-auto rounded-[14px] border border-[#7a94c53d] bg-[#0b111bcc] [scrollbar-gutter:stable_both-edges]";
const tableClass = "w-full min-w-[1840px] border-collapse";
const tableHeadCellClass =
  "sticky top-0 z-[1] whitespace-nowrap border-b border-[#7a94c533] bg-[#101825f5] px-3 py-2.5 align-middle text-xs tracking-[0.04em] text-[#c8d8f6]";
const tableBodyCellClass = "border-b border-[#7a94c533] px-3 py-2.5 align-middle";
const sortButtonClass =
  "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-0 bg-transparent p-0 text-inherit hover:text-[#dff8ff]";
const sortIndicatorClass = "min-w-[0.85em] text-[0.72rem] text-accent";
const tableSwitchClass = "inline-flex items-center gap-2 whitespace-nowrap text-sm";
const tableCheckClass = "h-4 w-4 accent-accent";
const tableSelectClass = `${controlClass} min-w-32 px-2.5 py-2`;
const disabledTableSelectClass =
  "w-full min-w-32 cursor-default appearance-none rounded-[12px] border border-[#788aad38] bg-[#070b12bf] px-2.5 py-2 text-sm text-[#9fb0cf] opacity-100 outline-none [box-shadow:inset_0_0_0_1px_rgba(9,14,23,0.35)]";
const normalBadgeClass = "rounded-full border border-[#67b8ffa6] bg-[#1c4e7a4f] px-2 py-0.5 text-[0.7rem] text-[#a9ddff]";
const limitedBadgeClass = "rounded-full border border-[#ff7e63b3] bg-[#7b2c2552] px-2 py-0.5 text-[0.7rem] text-[#ffb19f]";
const sourceChipBaseClass = "rounded-full border px-2 py-0.5 text-[0.72rem]";
const sourceChipEmptyClass = `${sourceChipBaseClass} border-white/20 text-muted`;
const sourceChipClassMap: Record<MemoryPieceSource, string> = {
  dungeon_coin: `${sourceChipBaseClass} border-[#56c6ff99] bg-[#145c7e52] text-[#8fe6ff]`,
  arena_coin: `${sourceChipBaseClass} border-[#ff9966a6] bg-[#823f2257] text-[#ffc58c]`,
  p_arena_coin: `${sourceChipBaseClass} border-[#ba79ffa6] bg-[#522a7e5c] text-[#d9b0ff]`,
  clan_coin: `${sourceChipBaseClass} border-[#ff6b7aa6] bg-[#7c223857] text-[#ff9ea4]`,
  master_coin: `${sourceChipBaseClass} border-[#ffd455b3] bg-[#7e5a155c] text-[#ffe291]`,
  hard_quest: `${sourceChipBaseClass} border-[#ff8150a6] bg-[#82341c57] text-[#ffad7c]`,
  side_story: `${sourceChipBaseClass} border-[#5bdba4a6] bg-[#1c674957] text-[#9df0cb]`,
};

// 専用装備レベルの表示文字列を統一する。
function formatUeLevel(level: number): string {
  return level === 0 ? "未装備" : `Lv.${level}`;
}

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

// 育成入力テーブルのフィルタ・ソート・更新操作を提供する。
export function InputTab({ masterCharacters, state, onUpdateProgress, initialSettings, onSettingsChange }: InputTabProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [searchText, setSearchText] = useState(initialSettings.searchText);
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>(initialSettings.ownedFilter);
  const [limitedFilter, setLimitedFilter] = useState<LimitedFilter>(initialSettings.limitedFilter);
  const [limitBreakFilter, setLimitBreakFilter] = useState<LimitBreakFilter>(initialSettings.limitBreakFilter);
  const [starMemoryCalcMode, setStarMemoryCalcMode] = useState<StarMemoryCalcMode>(initialSettings.starMemoryCalcMode);
  const [ue1MemoryCalcMode, setUe1MemoryCalcMode] = useState<Ue1MemoryCalcMode>(initialSettings.ue1MemoryCalcMode);
  const [starFilters, setStarFilters] = useState<StarFilter[]>(initialSettings.starFilters);
  const [starMemoryNeedFilters, setStarMemoryNeedFilters] = useState<StarMemoryNeedFilter[]>(
    initialSettings.starMemoryNeedFilters,
  );
  const [ue1Filters, setUe1Filters] = useState<Ue1Filter[]>(initialSettings.ue1Filters);
  const [ue2Filters, setUe2Filters] = useState<Ue2Filter[]>(initialSettings.ue2Filters);
  const [memorySourceFilters, setMemorySourceFilters] = useState<MemorySourceFilter[]>(initialSettings.memorySourceFilters);
  const [sortKey, setSortKey] = useState<SortKey>(initialSettings.sortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSettings.sortDirection);

  const selectedStarSet = useMemo(() => new Set(starFilters), [starFilters]);
  const selectedStarMemoryNeedSet = useMemo(() => new Set(starMemoryNeedFilters), [starMemoryNeedFilters]);
  const selectedUe1Set = useMemo(() => new Set(ue1Filters), [ue1Filters]);
  const selectedUe2Set = useMemo(() => new Set(ue2Filters), [ue2Filters]);
  const selectedMemorySourceSet = useMemo(() => new Set(memorySourceFilters), [memorySourceFilters]);

  const visibleRows = useMemo(() => {
    const trimmedSearchText = searchText.trim();
    const filteredRows: Array<{ character: MasterCharacter; progress: CharacterProgress; index: number }> = [];
    const hasStarFilter = selectedStarSet.size > 0;
    const hasUe1Filter = selectedUe1Set.size > 0;
    const hasUe2Filter = selectedUe2Set.size > 0;
    const hasStarMemoryNeedFilter = selectedStarMemoryNeedSet.size > 0;
    const hasMemorySourceFilter = selectedMemorySourceSet.size > 0;
    const hasNoneSourceFilter = selectedMemorySourceSet.has("none");

    for (let index = 0; index < masterCharacters.length; index += 1) {
      const character = masterCharacters[index];
      if (!character) {
        continue;
      }
      const progress = state.progressByName[character.name];
      if (!progress) {
        continue;
      }
      if (trimmedSearchText && !isCharacterNameMatched(character.name, trimmedSearchText)) {
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
      if (hasStarMemoryNeedFilter) {
        const starRemainingMemoryPiece = getStarRemainingMemoryPieceCount(character, progress, starMemoryCalcMode);
        if (!selectedStarMemoryNeedSet.has(starRemainingMemoryPiece)) {
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
        case "ue1":
          baseComparison = getUe1SortValue(aCharacter, aProgress) - getUe1SortValue(bCharacter, bProgress);
          break;
        case "ue2":
          baseComparison = getUe2SortValue(aCharacter, aProgress) - getUe2SortValue(bCharacter, bProgress);
          break;
        case "starMemoryNeeded":
          baseComparison =
            getStarRemainingMemoryPieceCount(aCharacter, aProgress, starMemoryCalcMode) -
            getStarRemainingMemoryPieceCount(bCharacter, bProgress, starMemoryCalcMode);
          break;
        case "ue1MemoryNeeded":
          baseComparison =
            getUe1RemainingMemoryPieceCount(aCharacter, aProgress, ue1MemoryCalcMode) -
            getUe1RemainingMemoryPieceCount(bCharacter, bProgress, ue1MemoryCalcMode);
          break;
        case "limitBreakMemoryNeeded":
          baseComparison =
            getLimitBreakRemainingMemoryPieceCount(aCharacter, aProgress) -
            getLimitBreakRemainingMemoryPieceCount(bCharacter, bProgress);
          break;
        case "totalMemoryNeeded":
          baseComparison =
            getStarRemainingMemoryPieceCount(aCharacter, aProgress, starMemoryCalcMode) +
            getUe1RemainingMemoryPieceCount(aCharacter, aProgress, ue1MemoryCalcMode) +
            getLimitBreakRemainingMemoryPieceCount(aCharacter, aProgress) -
            (getStarRemainingMemoryPieceCount(bCharacter, bProgress, starMemoryCalcMode) +
              getUe1RemainingMemoryPieceCount(bCharacter, bProgress, ue1MemoryCalcMode) +
              getLimitBreakRemainingMemoryPieceCount(bCharacter, bProgress));
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
    searchText,
    sortDirection,
    sortKey,
    starMemoryCalcMode,
    ue1MemoryCalcMode,
    starFilters,
    starMemoryNeedFilters,
    state.progressByName,
    selectedMemorySourceSet,
    selectedStarMemoryNeedSet,
    selectedStarSet,
    selectedUe1Set,
    selectedUe2Set,
  ]);

  // テーブルヘッダークリック時のソート状態遷移を管理する。
  function handleSort(nextSortKey: SortKey): void {
    if (sortKey !== nextSortKey) {
      setSortKey(nextSortKey);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    if (sortDirection === "desc") {
      setSortDirection(null);
      return;
    }
    setSortDirection("asc");
  }

  // ソート状態をth要素のaria-sort値に変換する。
  function getAriaSort(columnKey: SortKey): "none" | "ascending" | "descending" {
    if (sortKey !== columnKey || sortDirection === null) {
      return "none";
    }
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  // ソート中の列に矢印記号を表示する。
  function renderSortIndicator(columnKey: SortKey): string {
    if (sortKey !== columnKey || sortDirection === null) {
      return "";
    }
    return sortDirection === "asc" ? "▲" : "▼";
  }

  // メモピ入手フィルタの複数選択状態を切り替える。
  function toggleMemorySourceFilter(filter: MemorySourceFilter): void {
    setMemorySourceFilters((previous) =>
      previous.includes(filter) ? previous.filter((value) => value !== filter) : [...previous, filter],
    );
  }

  // ☆フィルタの複数選択状態を切り替える。
  function toggleStarFilter(filter: StarFilter): void {
    setStarFilters((previous) =>
      previous.includes(filter) ? previous.filter((value) => value !== filter) : [...previous, filter],
    );
  }

  // ☆必要メモピフィルタの複数選択状態を切り替える。
  function toggleStarMemoryNeedFilter(filter: StarMemoryNeedFilter): void {
    setStarMemoryNeedFilters((previous) =>
      previous.includes(filter) ? previous.filter((value) => value !== filter) : [...previous, filter],
    );
  }

  // 専用1フィルタの複数選択状態を切り替える。
  function toggleUe1Filter(filter: Ue1Filter): void {
    setUe1Filters((previous) =>
      previous.includes(filter) ? previous.filter((value) => value !== filter) : [...previous, filter],
    );
  }

  // 専用2フィルタの複数選択状態を切り替える。
  function toggleUe2Filter(filter: Ue2Filter): void {
    setUe2Filters((previous) =>
      previous.includes(filter) ? previous.filter((value) => value !== filter) : [...previous, filter],
    );
  }

  const selectedMemorySourceLabels = memorySourceFilters
    .map((filter) => (filter === "none" ? "情報なし" : memorySourceLabelMap[filter]))
    .join(" / ");
  const selectedStarLabels = starFilters.map((star) => `☆${star}`).join(" / ");
  const selectedStarMemoryNeedLabels = starMemoryNeedFilters.map((value) => String(value)).join(" / ");
  const selectedUe1Labels = ue1Filters
    .map((filter) => (filter === "unimplemented" ? "未実装" : filter === "sp" ? "SP" : formatUeLevel(filter)))
    .join(" / ");
  const selectedUe2Labels = ue2Filters
    .map((filter) => (filter === "unimplemented" ? "未実装" : formatUeLevel(filter)))
    .join(" / ");

  const currentSettings = useMemo<InputViewSettings>(
    () => ({
      searchText,
      ownedFilter,
      limitedFilter,
      limitBreakFilter,
      starMemoryCalcMode,
      ue1MemoryCalcMode,
      starFilters,
      starMemoryNeedFilters,
      ue1Filters,
      ue2Filters,
      memorySourceFilters,
      sortKey,
      sortDirection,
    }),
    [
      searchText,
      ownedFilter,
      limitedFilter,
      limitBreakFilter,
      starMemoryCalcMode,
      ue1MemoryCalcMode,
      starFilters,
      starMemoryNeedFilters,
      ue1Filters,
      ue2Filters,
      memorySourceFilters,
      sortKey,
      sortDirection,
    ],
  );

  useEffect(() => {
    // 画面設定が変化したタイミングで親へ通知し、永続化対象を同期する。
    onSettingsChange(currentSettings);
  }, [currentSettings, onSettingsChange]);

  useEffect(() => {
    // フィルタ用ドロップダウン外クリック時に開いている一覧を閉じる。
    function handleDocumentPointerDown(event: MouseEvent): void {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const activeDropdowns = root.querySelectorAll("details.multi-select-dropdown[open]");
      if (activeDropdowns.length === 0) {
        return;
      }
      const isInsideAnyDropdown = Array.from(activeDropdowns).some((dropdown) => dropdown.contains(target));
      if (isInsideAnyDropdown) {
        return;
      }
      activeDropdowns.forEach((dropdown) => {
        (dropdown as HTMLDetailsElement).open = false;
      });
    }

    document.addEventListener("mousedown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
    };
  }, []);

  return (
    <section className={panelClass} ref={rootRef}>
      <div className={inputToolbarClass}>
        <label className={fieldGroupClass}>
          <span>キャラ検索</span>
          <input
            className={controlClass}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="例: ヒヨリ"
          />
        </label>

        <label className={fieldGroupClass}>
          <span>所持フィルタ</span>
          <select
            className={controlClass}
            value={ownedFilter}
            onChange={(event) => setOwnedFilter(event.target.value as OwnedFilter)}
          >
            <option value="all">すべて</option>
            <option value="owned">所持のみ</option>
            <option value="unowned">未所持のみ</option>
          </select>
        </label>

        <label className={fieldGroupClass}>
          <span>限定フィルタ</span>
          <select
            className={controlClass}
            value={limitedFilter}
            onChange={(event) => setLimitedFilter(event.target.value as LimitedFilter)}
          >
            <option value="all">すべて</option>
            <option value="limited">限定のみ</option>
            <option value="normal">恒常のみ</option>
          </select>
        </label>

        <label className={fieldGroupClass}>
          <span>限界突破フィルタ</span>
          <select
            className={controlClass}
            value={limitBreakFilter}
            onChange={(event) => setLimitBreakFilter(event.target.value as LimitBreakFilter)}
          >
            <option value="all">すべて</option>
            <option value="on">限界突破済み</option>
            <option value="off">未限界突破</option>
          </select>
        </label>

        <div className={fieldGroupClass}>
          <span>☆フィルタ</span>
          <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
            <summary className={multiSelectSummaryClass}>{starFilters.length === 0 ? "すべて" : selectedStarLabels}</summary>
            <div className={multiSelectPanelClass}>
              {[1, 2, 3, 4, 5, 6].map((star) => (
                <label key={star} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={starFilters.includes(star as CharacterProgress["star"])}
                    onChange={() => toggleStarFilter(star as CharacterProgress["star"])}
                  />
                  <span>☆{star}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className={fieldGroupClass}>
          <span>☆必要メモピフィルタ</span>
          <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
            <summary className={multiSelectSummaryClass}>
              {starMemoryNeedFilters.length === 0 ? "すべて" : selectedStarMemoryNeedLabels}
            </summary>
            <div className={multiSelectPanelClass}>
              {STAR_MEMORY_FILTER_VALUES.map((value) => (
                <label key={value} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={starMemoryNeedFilters.includes(value)}
                    onChange={() => toggleStarMemoryNeedFilter(value)}
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className={fieldGroupClass}>
          <span>専用1フィルタ</span>
          <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
            <summary className={multiSelectSummaryClass}>{ue1Filters.length === 0 ? "すべて" : selectedUe1Labels}</summary>
            <div className={multiSelectPanelClass}>
              <label className={multiSelectItemClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={ue1Filters.includes("unimplemented")}
                  onChange={() => toggleUe1Filter("unimplemented")}
                />
                <span>未実装</span>
              </label>
              {UE1_LEVEL_VALUES.map((level) => (
                <label key={level} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={ue1Filters.includes(level)}
                    onChange={() => toggleUe1Filter(level)}
                  />
                  <span>{formatUeLevel(level)}</span>
                </label>
              ))}
              <label className={multiSelectItemClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={ue1Filters.includes("sp")}
                  onChange={() => toggleUe1Filter("sp")}
                />
                <span>SP</span>
              </label>
            </div>
          </details>
        </div>

        <div className={fieldGroupClass}>
          <span>専用2フィルタ</span>
          <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
            <summary className={multiSelectSummaryClass}>{ue2Filters.length === 0 ? "すべて" : selectedUe2Labels}</summary>
            <div className={multiSelectPanelClass}>
              <label className={multiSelectItemClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={ue2Filters.includes("unimplemented")}
                  onChange={() => toggleUe2Filter("unimplemented")}
                />
                <span>未実装</span>
              </label>
              {UE2_LEVEL_VALUES.map((level) => (
                <label key={level} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={ue2Filters.includes(level)}
                    onChange={() => toggleUe2Filter(level)}
                  />
                  <span>{formatUeLevel(level)}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className={fieldGroupClass}>
          <span>メモピ入手フィルタ</span>
          <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
            <summary className={multiSelectSummaryClass}>
              {memorySourceFilters.length === 0 ? "すべて" : selectedMemorySourceLabels}
            </summary>
            <div className={multiSelectPanelClass}>
              <label className={multiSelectItemClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={memorySourceFilters.includes("none")}
                  onChange={() => toggleMemorySourceFilter("none")}
                />
                <span>情報なし</span>
              </label>
              {Object.entries(memorySourceLabelMap).map(([source, label]) => (
                <label key={source} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={memorySourceFilters.includes(source as MemorySourceFilter)}
                    onChange={() => toggleMemorySourceFilter(source as MemorySourceFilter)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className={memoryCalcSectionClass}>
          <p className="mb-2.5 mt-0 text-xs text-muted">必要メモピ計算</p>
          <div className={memoryCalcGridClass}>
            <label className={fieldGroupClass}>
              <span>☆</span>
              <select
                className={controlClass}
                value={starMemoryCalcMode}
                onChange={(event) => setStarMemoryCalcMode(event.target.value as StarMemoryCalcMode)}
              >
                <option value="implemented_max">実装段階の最大まで</option>
                <option value="star6_max">☆6最大まで（仮定）</option>
              </select>
            </label>

            <label className={fieldGroupClass}>
              <span>専用1</span>
              <select
                className={controlClass}
                value={ue1MemoryCalcMode}
                onChange={(event) => setUe1MemoryCalcMode(event.target.value as Ue1MemoryCalcMode)}
              >
                <option value="implemented_max">実装段階の最大まで</option>
                <option value="sp_max">SP最大まで（仮定）</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <p className="my-3.5 text-sm text-muted">表示件数: {visibleRows.length}</p>

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <colgroup>
            <col className="w-20" />
            <col className="w-[200px]" />
            <col className="w-[90px]" />
            <col className="w-[95px]" />
            <col className="w-[130px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
            <col className="w-[120px]" />
            <col className="w-[130px]" />
            <col className="w-[145px]" />
            <col className="w-[120px]" />
            <col className="w-[260px]" />
          </colgroup>
          <thead>
            <tr>
              <th aria-sort={getAriaSort("owned")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("owned")}>
                  所持<span className={sortIndicatorClass}>{renderSortIndicator("owned")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("name")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("name")}>
                  キャラ<span className={sortIndicatorClass}>{renderSortIndicator("name")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("limited")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("limited")}>
                  区分<span className={sortIndicatorClass}>{renderSortIndicator("limited")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("limitBreak")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("limitBreak")}>
                  限界突破<span className={sortIndicatorClass}>{renderSortIndicator("limitBreak")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("star")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("star")}>
                  ☆<span className={sortIndicatorClass}>{renderSortIndicator("star")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("ue1")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("ue1")}>
                  専用1<span className={sortIndicatorClass}>{renderSortIndicator("ue1")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("ue2")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("ue2")}>
                  専用2<span className={sortIndicatorClass}>{renderSortIndicator("ue2")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("starMemoryNeeded")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("starMemoryNeeded")}>
                  ☆必要メモピ<span className={sortIndicatorClass}>{renderSortIndicator("starMemoryNeeded")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("ue1MemoryNeeded")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("ue1MemoryNeeded")}>
                  専用1必要メモピ<span className={sortIndicatorClass}>{renderSortIndicator("ue1MemoryNeeded")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("limitBreakMemoryNeeded")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("limitBreakMemoryNeeded")}>
                  限界突破必要メモピ<span className={sortIndicatorClass}>{renderSortIndicator("limitBreakMemoryNeeded")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("totalMemoryNeeded")} className={tableHeadCellClass}>
                <button type="button" className={sortButtonClass} onClick={() => handleSort("totalMemoryNeeded")}>
                  必要メモピ合計<span className={sortIndicatorClass}>{renderSortIndicator("totalMemoryNeeded")}</span>
                </button>
              </th>
              <th className={tableHeadCellClass}>メモピ入手</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-[18px] text-center text-muted">
                  条件に一致するキャラがいません
                </td>
              </tr>
            ) : (
              visibleRows.map(({ character, progress }) => {
                const ue1Value = character.implemented.ue1 ? String(progress.ue1Level ?? 0) : "null";
                const ue2Value = character.implemented.ue2 ? String(progress.ue2Level ?? 0) : "null";
                const starMax = character.implemented.star6 ? 6 : 5;
                const ue1CompositeValue =
                  character.implemented.ue1 && character.implemented.ue1Sp && progress.ue1SpEquipped ? "sp" : ue1Value;
                const starRemainingMemoryPiece = getStarRemainingMemoryPieceCount(character, progress, starMemoryCalcMode);
                const ue1RemainingMemoryPiece = getUe1RemainingMemoryPieceCount(character, progress, ue1MemoryCalcMode);
                const limitBreakRemainingMemoryPiece = getLimitBreakRemainingMemoryPieceCount(character, progress);
                const totalRemainingMemoryPiece =
                  starRemainingMemoryPiece + ue1RemainingMemoryPiece + limitBreakRemainingMemoryPiece;

                return (
                  <tr key={character.name} className="odd:bg-[#091425b5] even:bg-[#10203ab5] hover:bg-[#3a537c24]">
                    <td className={tableBodyCellClass}>
                      <label className={tableSwitchClass}>
                        <input
                          type="checkbox"
                          className={tableCheckClass}
                          checked={progress.owned}
                          aria-label={`${character.name}の所持状態`}
                          onChange={(event) => onUpdateProgress(character.name, { owned: event.target.checked })}
                        />
                      </label>
                    </td>
                    <td className={`${tableBodyCellClass} whitespace-nowrap font-bold`}>{character.name}</td>
                    <td className={tableBodyCellClass}>
                      {character.limited ? <span className={limitedBadgeClass}>限定</span> : <span className={normalBadgeClass}>恒常</span>}
                    </td>
                    <td className={tableBodyCellClass}>
                      <label className={tableSwitchClass}>
                        <input
                          type="checkbox"
                          className={tableCheckClass}
                          checked={progress.limitBreak}
                          aria-label={`${character.name}の限界突破状態`}
                          onChange={(event) => onUpdateProgress(character.name, { limitBreak: event.target.checked })}
                        />
                      </label>
                    </td>
                    <td className={tableBodyCellClass}>
                      <select
                        className={tableSelectClass}
                        value={progress.star}
                        onChange={(event) =>
                          onUpdateProgress(character.name, { star: Number(event.target.value) as CharacterProgress["star"] })
                        }
                      >
                        {Array.from({ length: starMax }, (_, index) => index + 1).map((star) => (
                          <option key={star} value={star}>
                            {star}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tableBodyCellClass}>
                      {character.implemented.ue1 ? (
                        <select
                          className={tableSelectClass}
                          value={ue1CompositeValue}
                          onChange={(event) => {
                            if (event.target.value === "sp") {
                              onUpdateProgress(character.name, { ue1Level: 370, ue1SpEquipped: true });
                              return;
                            }
                            const nextValue = (event.target.value === "null"
                              ? null
                              : Number(event.target.value)) as CharacterProgress["ue1Level"];
                            onUpdateProgress(character.name, { ue1Level: nextValue, ue1SpEquipped: false });
                          }}
                        >
                          {UE1_LEVEL_VALUES.map((level) => (
                            <option key={level} value={level}>
                              {formatUeLevel(level)}
                            </option>
                          ))}
                          {character.implemented.ue1Sp ? <option value="sp">SP</option> : null}
                        </select>
                      ) : (
                        <select className={disabledTableSelectClass} value="null" disabled>
                          <option value="null">-</option>
                        </select>
                      )}
                    </td>
                    <td className={tableBodyCellClass}>
                      {character.implemented.ue2 ? (
                        <select
                          className={tableSelectClass}
                          value={ue2Value}
                          onChange={(event) => {
                            const nextValue = (event.target.value === "null"
                              ? null
                              : Number(event.target.value)) as CharacterProgress["ue2Level"];
                            onUpdateProgress(character.name, { ue2Level: nextValue });
                          }}
                        >
                          {UE2_LEVEL_VALUES.map((level) => (
                            <option key={level} value={level}>
                              {formatUeLevel(level)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select className={disabledTableSelectClass} value="null" disabled>
                          <option value="null">-</option>
                        </select>
                      )}
                    </td>
                    <td className={tableBodyCellClass}>
                      <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{starRemainingMemoryPiece}</span>
                    </td>
                    <td className={tableBodyCellClass}>
                      <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{ue1RemainingMemoryPiece}</span>
                    </td>
                    <td className={tableBodyCellClass}>
                      <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">
                        {limitBreakRemainingMemoryPiece}
                      </span>
                    </td>
                    <td className={tableBodyCellClass}>
                      <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">
                        {totalRemainingMemoryPiece}
                      </span>
                    </td>
                    <td className={tableBodyCellClass}>
                      <div className="flex flex-wrap gap-1.5">
                        {character.memoryPieceSources.length === 0 ? (
                          <span className={sourceChipEmptyClass}>情報なし</span>
                        ) : (
                          character.memoryPieceSources.map((source) => (
                            <span key={source} className={sourceChipClassMap[source]}>
                              {memorySourceLabelMap[source]}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
