import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterProgress, MasterCharacter, StoredStateV1 } from "../domain/types";
import type {
  InputViewSettings,
  AdventureMemoryPieceFilter,
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
import { useIsMobile } from "../hooks/useIsMobile";
import { cn } from "../lib/utils";
import { InputFilterSheet } from "./input/InputFilterSheet";
import { InputFilters } from "./input/InputFilters";
import { InputMemoryCalcSettings } from "./input/InputMemoryCalcSettings";
import { InputProgressList } from "./input/InputProgressList";
import { InputProgressTable } from "./input/InputProgressTable";
import type { ProgressPatch } from "./input/types";
import { panelClass } from "./input/uiStyles";
import { useVisibleRows } from "./input/useVisibleRows";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";

const SEARCH_FILTER_DEBOUNCE_MS = 300;
const DETAIL_SETTINGS_ANIMATION_MS = 300;

type InputTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onUpdateCharacterPurePiece: (name: string, value: number) => void;
  initialSettings: InputViewSettings;
  onSettingsChange: (settings: InputViewSettings) => void;
  settingsSyncToken: number;
};

type AppliedDisplaySettings = Pick<
  InputViewSettings,
  | "ownedFilter"
  | "limitedFilter"
  | "limitBreakFilter"
  | "adventureMemoryPieceFilter"
  | "purePieceAvailabilityFilter"
  | "starMemoryCalcMode"
  | "ue1MemoryCalcMode"
  | "ue1HeartFragmentCalcMode"
  | "starFilters"
  | "ue1Filters"
  | "ue2Filters"
  | "memorySourceFilters"
  | "sortKey"
  | "sortDirection"
>;

// 入力された画面設定から、テーブルのフィルタ・ソート・必要数計算に使う値だけを返す。
function buildAppliedDisplaySettings(settings: InputViewSettings): AppliedDisplaySettings {
  return {
    ownedFilter: settings.ownedFilter,
    limitedFilter: settings.limitedFilter,
    limitBreakFilter: settings.limitBreakFilter,
    adventureMemoryPieceFilter: settings.adventureMemoryPieceFilter,
    purePieceAvailabilityFilter: settings.purePieceAvailabilityFilter,
    starMemoryCalcMode: settings.starMemoryCalcMode,
    ue1MemoryCalcMode: settings.ue1MemoryCalcMode,
    ue1HeartFragmentCalcMode: settings.ue1HeartFragmentCalcMode,
    starFilters: settings.starFilters,
    ue1Filters: settings.ue1Filters,
    ue2Filters: settings.ue2Filters,
    memorySourceFilters: settings.memorySourceFilters,
    sortKey: settings.sortKey,
    sortDirection: settings.sortDirection,
  };
}

type QuickFilterChipProps = {
  // チップに表示するラベル。
  label: string;
  // 選択中かどうか（選択中は強調表示する）。
  selected: boolean;
  // タップ時のトグル処理。
  onClick: () => void;
};

// モバイルの sticky バーに並べるクイックフィルタチップ。タップでフィルタをトグルする。
function QuickFilterChip({ label, selected, onClick }: QuickFilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        selected ? "border-accent/60 bg-accent/15 text-accent" : "border-white/20 bg-white/5 text-muted",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

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
  // 768px 未満ではモバイル向け一覧、それ以外はテーブルを表示する（両方の同時マウントは仮想化計測と aria の二重化を招くため禁止）。
  const isMobile = useIsMobile();
  const [searchText, setSearchText] = useState(initialSettings.searchText);
  const [debouncedSearchText, setDebouncedSearchText] = useState(initialSettings.searchText);
  const [isDetailSettingsOpen, setIsDetailSettingsOpen] = useState(initialSettings.isDetailSettingsOpen);
  const [shouldRenderDetailSettings, setShouldRenderDetailSettings] = useState(initialSettings.isDetailSettingsOpen);
  const [isDetailSettingsVisible, setIsDetailSettingsVisible] = useState(initialSettings.isDetailSettingsOpen);
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>(initialSettings.ownedFilter);
  const [limitedFilter, setLimitedFilter] = useState<LimitedFilter>(initialSettings.limitedFilter);
  const [limitBreakFilter, setLimitBreakFilter] = useState<LimitBreakFilter>(initialSettings.limitBreakFilter);
  const [adventureMemoryPieceFilter, setAdventureMemoryPieceFilter] = useState<AdventureMemoryPieceFilter>(
    initialSettings.adventureMemoryPieceFilter,
  );
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
  const [appliedProgressByName, setAppliedProgressByName] = useState<Record<string, CharacterProgress>>(() => ({
    ...state.progressByName,
  }));
  // モバイルのフィルタシートの開閉状態（永続化しないローカル state）。
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  useEffect(() => {
    // 検索入力の連続更新中は反映を遅らせ、全件フィルタ計算の頻度を抑える。
    const timerId = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, SEARCH_FILTER_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [searchText]);

  useEffect(() => {
    // 詳細設定の開閉時にフェード+高さトランジションを適用する。
    if (isDetailSettingsOpen) {
      setIsDetailSettingsVisible(false);
      setShouldRenderDetailSettings(true);
      const timerId = window.setTimeout(() => {
        setIsDetailSettingsVisible(true);
      }, 16);
      return () => {
        window.clearTimeout(timerId);
      };
    }

    setIsDetailSettingsVisible(false);
    const timerId = window.setTimeout(() => {
      setShouldRenderDetailSettings(false);
    }, DETAIL_SETTINGS_ANIMATION_MS);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [isDetailSettingsOpen]);

  // ソート列の変更時に列キーを保存し、未ソート状態ならすぐ並び替えが効くよう昇順へ切り替える。
  const handleSortKeyChange = useCallback((nextSortKey: SortKey): void => {
    setSortKey(nextSortKey);
    setSortDirection((previousDirection) => previousDirection ?? "asc");
  }, []);

  // 詳細設定セクションの開閉状態を切り替える。
  const handleDetailSettingsToggle = useCallback((): void => {
    setIsDetailSettingsOpen((previous) => !previous);
  }, []);

  // キャラ検索文字列を初期化する。
  const handleSearchReset = useCallback((): void => {
    setSearchText("");
  }, []);

  // テーブル編集後の進捗スナップショットを現在値へ更新し、ソート順や絞り込みを再計算できるようにする。
  const handleApplyDisplaySettings = useCallback((): void => {
    setAppliedProgressByName({ ...state.progressByName });
  }, [state.progressByName]);

  const currentSettings = useMemo<InputViewSettings>(
    () => ({
      searchText,
      isDetailSettingsOpen,
      ownedFilter,
      limitedFilter,
      limitBreakFilter,
      adventureMemoryPieceFilter,
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
      adventureMemoryPieceFilter,
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

  // 現在の詳細設定を入力として、表示件数とテーブル行へ即時反映する設定値を生成する。
  const appliedDisplaySettings = useMemo(() => buildAppliedDisplaySettings(currentSettings), [currentSettings]);

  // デバウンス後の検索テキストをさらに低優先度で反映し、入力中のブロッキングを防ぐ。
  const deferredSearchText = useDeferredValue(debouncedSearchText);

  const visibleRows = useVisibleRows({
    masterCharacters,
    progressByName: appliedProgressByName,
    searchText: deferredSearchText,
    ownedFilter: appliedDisplaySettings.ownedFilter,
    limitedFilter: appliedDisplaySettings.limitedFilter,
    limitBreakFilter: appliedDisplaySettings.limitBreakFilter,
    adventureMemoryPieceFilter: appliedDisplaySettings.adventureMemoryPieceFilter,
    purePieceAvailabilityFilter: appliedDisplaySettings.purePieceAvailabilityFilter,
    starMemoryCalcMode: appliedDisplaySettings.starMemoryCalcMode,
    ue1MemoryCalcMode: appliedDisplaySettings.ue1MemoryCalcMode,
    ue1HeartFragmentCalcMode: appliedDisplaySettings.ue1HeartFragmentCalcMode,
    starFilters: appliedDisplaySettings.starFilters,
    ue1Filters: appliedDisplaySettings.ue1Filters,
    ue2Filters: appliedDisplaySettings.ue2Filters,
    memorySourceFilters: appliedDisplaySettings.memorySourceFilters,
    sortKey: appliedDisplaySettings.sortKey,
    sortDirection: appliedDisplaySettings.sortDirection,
  });
  const visibleRowsWithCurrentProgress = useMemo(
    () =>
      visibleRows.map(({ character, progress }) => ({
        character,
        progress: state.progressByName[character.name] ?? progress,
      })),
    [state.progressByName, visibleRows],
  );
  const purePieceByBaseNameFromCharacters = useMemo<Record<string, number>>(() => {
    const nextTotals: Record<string, number> = {};
    for (const character of masterCharacters) {
      const current = nextTotals[character.baseName] ?? 0;
      const ownedPurePiece = state.purePieceByCharacterName[character.name] ?? 0;
      nextTotals[character.baseName] = current + ownedPurePiece;
    }
    return nextTotals;
  }, [masterCharacters, state.purePieceByCharacterName]);

  // 詳細設定を閉じた状態でも絞り込み中だと分かるよう、表示件数に影響する詳細フィルタの適用数を数える。
  // デスクトップは「count > 0」でバッジ表示（従来の boolean 判定と等価）、モバイルはフィルタボタンに件数を表示する。
  const activeDetailFilterCount = useMemo(() => {
    const activeFlags = [
      appliedDisplaySettings.ownedFilter !== "all",
      appliedDisplaySettings.limitedFilter !== "all",
      appliedDisplaySettings.limitBreakFilter !== "all",
      appliedDisplaySettings.adventureMemoryPieceFilter !== "all",
      appliedDisplaySettings.purePieceAvailabilityFilter !== "all",
      appliedDisplaySettings.starFilters.length > 0,
      appliedDisplaySettings.ue1Filters.length > 0,
      appliedDisplaySettings.ue2Filters.length > 0,
      appliedDisplaySettings.memorySourceFilters.length > 0,
    ];
    return activeFlags.filter(Boolean).length;
  }, [appliedDisplaySettings]);

  useEffect(() => {
    // 親からの明示同期トリガー時のみ、入力画面のローカル設定を外部値へ合わせる。
    isSyncingFromParentRef.current = true;
    setSearchText(initialSettings.searchText);
    setDebouncedSearchText(initialSettings.searchText);
    setIsDetailSettingsOpen(initialSettings.isDetailSettingsOpen);
    setShouldRenderDetailSettings(initialSettings.isDetailSettingsOpen);
    setIsDetailSettingsVisible(initialSettings.isDetailSettingsOpen);
    setOwnedFilter(initialSettings.ownedFilter);
    setLimitedFilter(initialSettings.limitedFilter);
    setLimitBreakFilter(initialSettings.limitBreakFilter);
    setAdventureMemoryPieceFilter(initialSettings.adventureMemoryPieceFilter);
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
    setAppliedProgressByName({ ...state.progressByName });

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

  // フィルタ・ソート・計算モードの設定 UI（配線済み）。
  // デスクトップは詳細設定パネル、モバイルはフィルタシートへ同じものを埋め込む（どちらか一方のみレンダリング）。
  const filterSettingsContent = (
    <>
      <InputFilters
        ownedFilter={ownedFilter}
        onOwnedFilterChange={setOwnedFilter}
        limitedFilter={limitedFilter}
        onLimitedFilterChange={setLimitedFilter}
        limitBreakFilter={limitBreakFilter}
        onLimitBreakFilterChange={setLimitBreakFilter}
        adventureMemoryPieceFilter={adventureMemoryPieceFilter}
        onAdventureMemoryPieceFilterChange={setAdventureMemoryPieceFilter}
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
        sortKey={sortKey}
        onSortKeyChange={handleSortKeyChange}
        sortDirection={sortDirection}
        onSortDirectionChange={setSortDirection}
        onApplyDisplaySettings={handleApplyDisplaySettings}
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
    </>
  );

  // 詳細設定セクション（デスクトップ専用。モバイルではフィルタシートに置き換えるためレンダリングしない）。
  const detailSettingsSection = (
    <section className={`${panelClass} mb-4`}>
        <div className={`flex flex-wrap items-center gap-2 ${isDetailSettingsOpen ? "mb-3" : ""}`}>
          <button
            type="button"
            aria-expanded={isDetailSettingsOpen}
            aria-controls="input-detail-settings"
            className="inline-flex h-8 items-center gap-1.5 text-left text-sm leading-none font-semibold text-main transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            onClick={handleDetailSettingsToggle}
          >
            <span>詳細設定</span>
            <ChevronDown className={`size-4 shrink-0 transition-transform ${isDetailSettingsOpen ? "rotate-180" : ""}`} />
          </button>
          {!isDetailSettingsOpen && activeDetailFilterCount > 0 ? (
            <Badge className="border-accent/40 bg-accent/10 text-accent">フィルタ適用中</Badge>
          ) : null}
        </div>

        {shouldRenderDetailSettings ? (
          <div
            id="input-detail-settings"
            aria-hidden={!isDetailSettingsOpen}
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
              isDetailSettingsVisible ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="pt-1">{filterSettingsContent}</div>
          </div>
        ) : null}
      </section>
  );

  if (isMobile) {
    // モバイル（768px 未満）: 検索バー+クイックフィルタチップを画面上部へ固定し、一覧は window スクロールに一本化する。
    // 詳細なフィルタ・表示設定は詳細設定パネルの代わりにボトムシート（InputFilterSheet）へ集約する。
    // パネル枠を使わないのは、sticky バーの上に padding の隙間から行が透けるのを防ぐため。
    return (
      <>
        <div className="sticky top-0 z-10 bg-bg-end py-2.5">
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                aria-label="キャラ検索"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="pl-9"
                placeholder="例: ヒヨリ"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-danger/60 bg-danger-bg/40 text-danger hover:border-danger-strong hover:text-danger-strong"
              onClick={handleSearchReset}
            >
              リセット
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {/* チップ行は将来の項目追加に備えて横スクロール可能にする（表示件数とフィルタボタンは右端に固定） */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              <QuickFilterChip
                label="所持のみ"
                selected={ownedFilter === "owned"}
                onClick={() => setOwnedFilter((previous) => (previous === "owned" ? "all" : "owned"))}
              />
              <QuickFilterChip
                label="未所持のみ"
                selected={ownedFilter === "unowned"}
                onClick={() => setOwnedFilter((previous) => (previous === "unowned" ? "all" : "unowned"))}
              />
            </div>
            <span className="shrink-0 text-xs whitespace-nowrap text-muted">
              表示件数: {visibleRowsWithCurrentProgress.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setIsFilterSheetOpen(true)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              フィルタ
              {activeDetailFilterCount > 0 ? (
                <Badge className="border-accent/40 bg-accent/10 px-1.5 text-accent">{activeDetailFilterCount}</Badge>
              ) : null}
            </Button>
          </div>
        </div>

        <InputFilterSheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
          {filterSettingsContent}
        </InputFilterSheet>

        <InputProgressList
          visibleRows={visibleRowsWithCurrentProgress}
          purePieceByCharacterName={state.purePieceByCharacterName}
          purePieceByBaseNameFromCharacters={purePieceByBaseNameFromCharacters}
          onUpdateProgress={onUpdateProgress}
          onUpdatePurePiece={onUpdateCharacterPurePiece}
          includeSameBasePurePieceForUe2={includeSameBasePurePieceForUe2}
          starMemoryCalcMode={starMemoryCalcMode}
          ue1MemoryCalcMode={ue1MemoryCalcMode}
        />
      </>
    );
  }

  // デスクトップ（768px 以上）: 従来のパネル+内部スクロールテーブル構成（見た目・挙動とも不変）。
  return (
    <>
      {detailSettingsSection}

      <section className={panelClass}>
        <div className="mb-3 grid gap-1.5 text-sm text-muted">
          <Label>キャラ検索</Label>
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="pl-9"
                placeholder="例: ヒヨリ"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-danger/60 bg-danger-bg/40 text-danger hover:border-danger-strong hover:text-danger-strong"
              onClick={handleSearchReset}
            >
              リセット
            </Button>
          </div>
        </div>

        <Separator className="mt-4 mb-1" label="検索エリアとテーブルの区切り" />

        <p className="my-3.5 text-sm text-muted">表示件数: {visibleRowsWithCurrentProgress.length}</p>

        <InputProgressTable
          visibleRows={visibleRowsWithCurrentProgress}
          purePieceByCharacterName={state.purePieceByCharacterName}
          purePieceByBaseNameFromCharacters={purePieceByBaseNameFromCharacters}
          onUpdateProgress={onUpdateProgress}
          onUpdatePurePiece={onUpdateCharacterPurePiece}
          includeSameBasePurePieceForUe2={includeSameBasePurePieceForUe2}
          starMemoryCalcMode={starMemoryCalcMode}
          ue1MemoryCalcMode={ue1MemoryCalcMode}
        />
      </section>
    </>
  );
}
