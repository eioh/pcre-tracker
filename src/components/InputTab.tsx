import { ChevronDown, Search } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterProgress, MasterCharacter, StoredStateV1 } from "../domain/types";
import type {
  InputViewSettings,
  LimitBreakFilter,
  LimitedFilter,
  MemorySourceFilter,
  OwnedFilter,
  PurePieceAvailabilityFilter,
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
import { filterSeparatorClass, panelClass } from "./input/uiStyles";
import { useVisibleRows } from "./input/useVisibleRows";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";

const SEARCH_FILTER_DEBOUNCE_MS = 300;

type InputTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onUpdateCharacterPurePiece: (name: string, value: number) => void;
  initialSettings: InputViewSettings;
  onSettingsChange: (settings: InputViewSettings) => void;
  settingsSyncToken: number;
};

// 育成入力画面の状態管理と各 UI コンポーネントの合成を行う。
export function InputTab({
  masterCharacters,
  state,
  onUpdateProgress,
  onUpdateCharacterPurePiece,
  initialSettings,
  onSettingsChange,
  settingsSyncToken,
}: InputTabProps) {
  const mountedRef = useRef(false);
  const isSyncingFromParentRef = useRef(false);
  const [searchText, setSearchText] = useState(initialSettings.searchText);
  const [debouncedSearchText, setDebouncedSearchText] = useState(initialSettings.searchText);
  const [isDetailSettingsOpen, setIsDetailSettingsOpen] = useState(initialSettings.isDetailSettingsOpen);
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>(initialSettings.ownedFilter);
  const [limitedFilter, setLimitedFilter] = useState<LimitedFilter>(initialSettings.limitedFilter);
  const [limitBreakFilter, setLimitBreakFilter] = useState<LimitBreakFilter>(initialSettings.limitBreakFilter);
  const [purePieceAvailabilityFilter, setPurePieceAvailabilityFilter] = useState<PurePieceAvailabilityFilter>(
    initialSettings.purePieceAvailabilityFilter,
  );
  const [starMemoryCalcMode, setStarMemoryCalcMode] = useState<StarMemoryCalcMode>(initialSettings.starMemoryCalcMode);
  const [ue1MemoryCalcMode, setUe1MemoryCalcMode] = useState<Ue1MemoryCalcMode>(initialSettings.ue1MemoryCalcMode);
  const [ue1HeartFragmentCalcMode, setUe1HeartFragmentCalcMode] = useState<Ue1HeartFragmentCalcMode>(
    initialSettings.ue1HeartFragmentCalcMode,
  );
  const [includeSameBasePurePieceForUe2, setIncludeSameBasePurePieceForUe2] = useState(
    initialSettings.includeSameBasePurePieceForUe2,
  );
  const [starFilters, setStarFilters] = useState<StarFilter[]>(initialSettings.starFilters);
  const [ue1Filters, setUe1Filters] = useState<Ue1Filter[]>(initialSettings.ue1Filters);
  const [ue2Filters, setUe2Filters] = useState<Ue2Filter[]>(initialSettings.ue2Filters);
  const [memorySourceFilters, setMemorySourceFilters] = useState<MemorySourceFilter[]>(initialSettings.memorySourceFilters);
  const [sortKey, setSortKey] = useState<SortKey>(initialSettings.sortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSettings.sortDirection);

  useEffect(() => {
    // 検索入力の連続更新中は反映を遅らせ、全件フィルタ計算の頻度を抑える。
    const timerId = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, SEARCH_FILTER_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [searchText]);

  // デバウンス後の検索テキストをさらに低優先度で反映し、入力中のブロッキングを防ぐ。
  const deferredSearchText = useDeferredValue(debouncedSearchText);

  const visibleRows = useVisibleRows({
    masterCharacters,
    progressByName: state.progressByName,
    searchText: deferredSearchText,
    ownedFilter,
    limitedFilter,
    limitBreakFilter,
    purePieceAvailabilityFilter,
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
  const purePieceByBaseNameFromCharacters = useMemo<Record<string, number>>(() => {
    const nextTotals: Record<string, number> = {};
    for (const character of masterCharacters) {
      const current = nextTotals[character.baseName] ?? 0;
      const ownedPurePiece = state.purePieceByCharacterName[character.name] ?? 0;
      nextTotals[character.baseName] = current + ownedPurePiece;
    }
    return nextTotals;
  }, [masterCharacters, state.purePieceByCharacterName]);

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

  // 詳細設定セクションの開閉状態を切り替える。
  const handleDetailSettingsToggle = useCallback((): void => {
    setIsDetailSettingsOpen((previous) => !previous);
  }, []);

  // キャラ検索文字列を初期化する。
  const handleSearchReset = useCallback((): void => {
    setSearchText("");
  }, []);

  const currentSettings = useMemo<InputViewSettings>(
    () => ({
      searchText,
      isDetailSettingsOpen,
      ownedFilter,
      limitedFilter,
      limitBreakFilter,
      purePieceAvailabilityFilter,
      starMemoryCalcMode,
      ue1MemoryCalcMode,
      ue1HeartFragmentCalcMode,
      includeSameBasePurePieceForUe2,
      starFilters,
      ue1Filters,
      ue2Filters,
      memorySourceFilters,
      sortKey,
      sortDirection,
    }),
    [
      searchText,
      isDetailSettingsOpen,
      ownedFilter,
      limitedFilter,
      limitBreakFilter,
      purePieceAvailabilityFilter,
      starMemoryCalcMode,
      ue1MemoryCalcMode,
      ue1HeartFragmentCalcMode,
      includeSameBasePurePieceForUe2,
      starFilters,
      ue1Filters,
      ue2Filters,
      memorySourceFilters,
      sortKey,
      sortDirection,
    ],
  );

  useEffect(() => {
    // 親からの明示同期トリガー時のみ、入力画面のローカル設定を外部値へ合わせる。
    isSyncingFromParentRef.current = true;
    setSearchText(initialSettings.searchText);
    setDebouncedSearchText(initialSettings.searchText);
    setIsDetailSettingsOpen(initialSettings.isDetailSettingsOpen);
    setOwnedFilter(initialSettings.ownedFilter);
    setLimitedFilter(initialSettings.limitedFilter);
    setLimitBreakFilter(initialSettings.limitBreakFilter);
    setPurePieceAvailabilityFilter(initialSettings.purePieceAvailabilityFilter);
    setStarMemoryCalcMode(initialSettings.starMemoryCalcMode);
    setUe1MemoryCalcMode(initialSettings.ue1MemoryCalcMode);
    setUe1HeartFragmentCalcMode(initialSettings.ue1HeartFragmentCalcMode);
    setIncludeSameBasePurePieceForUe2(initialSettings.includeSameBasePurePieceForUe2);
    setStarFilters(initialSettings.starFilters);
    setUe1Filters(initialSettings.ue1Filters);
    setUe2Filters(initialSettings.ue2Filters);
    setMemorySourceFilters(initialSettings.memorySourceFilters);
    setSortKey(initialSettings.sortKey);
    setSortDirection(initialSettings.sortDirection);

    queueMicrotask(() => {
      isSyncingFromParentRef.current = false;
    });
  }, [settingsSyncToken]);

  useEffect(() => {
    // 初回マウント時は通知せず、ユーザー操作で設定が変化したときのみ親へ通知する。
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    // 親からの同期反映中は通知せず、設定の往復更新を防ぐ。
    if (isSyncingFromParentRef.current) {
      return;
    }
    // 画面設定が変化したタイミングで親へ通知し、永続化対象を同期する。
    onSettingsChange(currentSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSettingsChange は親側で安定参照(useCallback)を前提に意図的に依存配列から除外する。
  }, [currentSettings]);

  return (
    <section className={panelClass}>
      <div className="mb-3 grid gap-1.5 text-sm text-muted">
        <Label>キャラ検索</Label>
        <div className="flex items-center gap-2">
          <div className="relative w-full">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} className="pl-9" placeholder="例: ヒヨリ" />
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={handleSearchReset}>
            リセット
          </Button>
        </div>
      </div>

      <Separator className={filterSeparatorClass} label="キャラ検索と詳細設定の区切り" />

      <div className="mb-3">
        <button
          type="button"
          aria-expanded={isDetailSettingsOpen}
          aria-controls="input-detail-settings"
          className="inline-flex w-full items-center justify-between rounded-[12px] border border-white/20 bg-transparent px-3 py-2 text-left text-sm font-semibold text-main transition hover:border-accent hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          onClick={handleDetailSettingsToggle}
        >
          <span>詳細設定</span>
          <ChevronDown className={`size-4 shrink-0 transition-transform ${isDetailSettingsOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isDetailSettingsOpen ? (
        <div id="input-detail-settings">
          <InputFilters
            ownedFilter={ownedFilter}
            onOwnedFilterChange={setOwnedFilter}
            limitedFilter={limitedFilter}
            onLimitedFilterChange={setLimitedFilter}
            limitBreakFilter={limitBreakFilter}
            onLimitBreakFilterChange={setLimitBreakFilter}
            purePieceAvailabilityFilter={purePieceAvailabilityFilter}
            onPurePieceAvailabilityFilterChange={setPurePieceAvailabilityFilter}
            starFilters={starFilters}
            setStarFilters={setStarFilters}
            ue1Filters={ue1Filters}
            setUe1Filters={setUe1Filters}
            ue2Filters={ue2Filters}
            setUe2Filters={setUe2Filters}
            memorySourceFilters={memorySourceFilters}
            setMemorySourceFilters={setMemorySourceFilters}
          />

          <Separator className="mt-4" label="フィルタと必要メモピ/ハートの欠片計算の区切り" />

          <InputMemoryCalcSettings
            starMemoryCalcMode={starMemoryCalcMode}
            onStarMemoryCalcModeChange={setStarMemoryCalcMode}
            ue1MemoryCalcMode={ue1MemoryCalcMode}
            onUe1MemoryCalcModeChange={setUe1MemoryCalcMode}
            ue1HeartFragmentCalcMode={ue1HeartFragmentCalcMode}
            onUe1HeartFragmentCalcModeChange={setUe1HeartFragmentCalcMode}
            includeSameBasePurePieceForUe2={includeSameBasePurePieceForUe2}
            onIncludeSameBasePurePieceForUe2Change={setIncludeSameBasePurePieceForUe2}
          />
        </div>
      ) : null}

      <Separator className="mt-4 mb-1" label="必要メモピ/ハートの欠片計算とテーブルの区切り" />

      <p className="my-3.5 text-sm text-muted">表示件数: {visibleRows.length}</p>

      <InputProgressTable
        visibleRows={visibleRows}
        purePieceByCharacterName={state.purePieceByCharacterName}
        purePieceByBaseNameFromCharacters={purePieceByBaseNameFromCharacters}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onUpdateProgress={onUpdateProgress}
        onUpdatePurePiece={onUpdateCharacterPurePiece}
        includeSameBasePurePieceForUe2={includeSameBasePurePieceForUe2}
        starMemoryCalcMode={starMemoryCalcMode}
        ue1MemoryCalcMode={ue1MemoryCalcMode}
        ue1HeartFragmentCalcMode={ue1HeartFragmentCalcMode}
      />
    </section>
  );
}
