import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterProgress, MasterCharacter, StoredStateV1 } from "../domain/types";
import type {
  InputViewSettings,
  LimitBreakFilter,
  LimitedFilter,
  MemorySourceFilter,
  OwnedFilter,
  SortDirection,
  SortKey,
  StarFilter,
  Ue1Filter,
  Ue2Filter,
} from "../domain/uiStorage";
import type { Ue1HeartFragmentCalcMode } from "../utils/ue1HeartFragmentCost";
import type { Ue1MemoryCalcMode } from "../utils/ue1MemoryCost";
import type { StarMemoryCalcMode } from "../utils/starMemoryCost";
import { InputFilters } from "./input/InputFilters";
import { InputMemoryCalcSettings } from "./input/InputMemoryCalcSettings";
import { InputProgressTable } from "./input/InputProgressTable";
import type { ProgressPatch } from "./input/types";
import { useVisibleRows } from "./input/useVisibleRows";
import { filterSeparatorClass, panelClass, tableSeparatorClass } from "./input/uiStyles";

type InputTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  initialSettings: InputViewSettings;
  onSettingsChange: (settings: InputViewSettings) => void;
};

// 育成入力画面の状態管理と各 UI コンポーネントの合成を行う。
export function InputTab({ masterCharacters, state, onUpdateProgress, initialSettings, onSettingsChange }: InputTabProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [searchText, setSearchText] = useState(initialSettings.searchText);
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>(initialSettings.ownedFilter);
  const [limitedFilter, setLimitedFilter] = useState<LimitedFilter>(initialSettings.limitedFilter);
  const [limitBreakFilter, setLimitBreakFilter] = useState<LimitBreakFilter>(initialSettings.limitBreakFilter);
  const [starMemoryCalcMode, setStarMemoryCalcMode] = useState<StarMemoryCalcMode>(initialSettings.starMemoryCalcMode);
  const [ue1MemoryCalcMode, setUe1MemoryCalcMode] = useState<Ue1MemoryCalcMode>(initialSettings.ue1MemoryCalcMode);
  const [ue1HeartFragmentCalcMode, setUe1HeartFragmentCalcMode] = useState<Ue1HeartFragmentCalcMode>(
    initialSettings.ue1HeartFragmentCalcMode,
  );
  const [starFilters, setStarFilters] = useState<StarFilter[]>(initialSettings.starFilters);
  const [ue1Filters, setUe1Filters] = useState<Ue1Filter[]>(initialSettings.ue1Filters);
  const [ue2Filters, setUe2Filters] = useState<Ue2Filter[]>(initialSettings.ue2Filters);
  const [memorySourceFilters, setMemorySourceFilters] = useState<MemorySourceFilter[]>(initialSettings.memorySourceFilters);
  const [sortKey, setSortKey] = useState<SortKey>(initialSettings.sortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSettings.sortDirection);

  // 検索テキストの遅延値を使い、入力中のブロッキングを防ぐ。
  const deferredSearchText = useDeferredValue(searchText);

  const visibleRows = useVisibleRows({
    masterCharacters,
    progressByName: state.progressByName,
    searchText: deferredSearchText,
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
  });

  // テーブルヘッダークリック時のソート状態遷移を管理する。
  const handleSort = useCallback(
    (nextSortKey: SortKey): void => {
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
    },
    [sortKey, sortDirection],
  );

  const currentSettings = useMemo<InputViewSettings>(
    () => ({
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
    }),
    [
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
      <InputFilters
        searchText={searchText}
        onSearchTextChange={setSearchText}
        ownedFilter={ownedFilter}
        onOwnedFilterChange={setOwnedFilter}
        limitedFilter={limitedFilter}
        onLimitedFilterChange={setLimitedFilter}
        limitBreakFilter={limitBreakFilter}
        onLimitBreakFilterChange={setLimitBreakFilter}
        starFilters={starFilters}
        setStarFilters={setStarFilters}
        ue1Filters={ue1Filters}
        setUe1Filters={setUe1Filters}
        ue2Filters={ue2Filters}
        setUe2Filters={setUe2Filters}
        memorySourceFilters={memorySourceFilters}
        setMemorySourceFilters={setMemorySourceFilters}
      />

      <div className={filterSeparatorClass} role="separator" aria-label="フィルタと必要メモピ/ハートの欠片計算の区切り" />

      <InputMemoryCalcSettings
        starMemoryCalcMode={starMemoryCalcMode}
        onStarMemoryCalcModeChange={setStarMemoryCalcMode}
        ue1MemoryCalcMode={ue1MemoryCalcMode}
        onUe1MemoryCalcModeChange={setUe1MemoryCalcMode}
        ue1HeartFragmentCalcMode={ue1HeartFragmentCalcMode}
        onUe1HeartFragmentCalcModeChange={setUe1HeartFragmentCalcMode}
      />

      <div className={tableSeparatorClass} role="separator" aria-label="必要メモピ/ハートの欠片計算とテーブルの区切り" />

      <p className="my-3.5 text-sm text-muted">表示件数: {visibleRows.length}</p>

      <InputProgressTable
        visibleRows={visibleRows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onUpdateProgress={onUpdateProgress}
        starMemoryCalcMode={starMemoryCalcMode}
        ue1MemoryCalcMode={ue1MemoryCalcMode}
        ue1HeartFragmentCalcMode={ue1HeartFragmentCalcMode}
      />
    </section>
  );
}
