import { memo, type Dispatch, type SetStateAction } from "react";
import type { MultiSelection } from "../../domain/multiSelection";
import {
  MEMORY_SOURCE_FILTER_VALUES,
  STAR_FILTER_VALUES,
  UE1_FILTER_VALUES,
  UE2_FILTER_VALUES,
  type AdventureMemoryPieceFilter,
  type LimitBreakFilter,
  type LimitedFilter,
  type MemorySourceFilter,
  type OwnedFilter,
  type PurePieceAvailabilityFilter,
  type SortDirection,
  type SortKey,
  type StarFilter,
  type Ue1Filter,
  type Ue1SpImplementedFilter,
  type Ue2Filter,
} from "../../domain/uiStorage";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { MultiSelectFilter } from "../ui/multi-select-filter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { memorySourceLabelMap } from "./constants";
import { formatUeLevel } from "./formatters";
import { filterTriggerClass, inputToolbarClass, sectionLabelClass } from "./uiStyles";

type InputFiltersProps = {
  ownedFilter: OwnedFilter;
  onOwnedFilterChange: (value: OwnedFilter) => void;
  limitedFilter: LimitedFilter;
  onLimitedFilterChange: (value: LimitedFilter) => void;
  ue1SpImplementedFilter: Ue1SpImplementedFilter;
  onUe1SpImplementedFilterChange: (value: Ue1SpImplementedFilter) => void;
  limitBreakFilter: LimitBreakFilter;
  onLimitBreakFilterChange: (value: LimitBreakFilter) => void;
  adventureMemoryPieceFilter: AdventureMemoryPieceFilter;
  onAdventureMemoryPieceFilterChange: (value: AdventureMemoryPieceFilter) => void;
  purePieceAvailabilityFilter: PurePieceAvailabilityFilter;
  onPurePieceAvailabilityFilterChange: (value: PurePieceAvailabilityFilter) => void;
  starFilters: MultiSelection<StarFilter>;
  setStarFilters: Dispatch<SetStateAction<MultiSelection<StarFilter>>>;
  ue1Filters: MultiSelection<Ue1Filter>;
  setUe1Filters: Dispatch<SetStateAction<MultiSelection<Ue1Filter>>>;
  ue2Filters: MultiSelection<Ue2Filter>;
  setUe2Filters: Dispatch<SetStateAction<MultiSelection<Ue2Filter>>>;
  memorySourceFilters: MultiSelection<MemorySourceFilter>;
  setMemorySourceFilters: Dispatch<SetStateAction<MultiSelection<MemorySourceFilter>>>;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
};

const sortKeyOptions: Array<{ value: SortKey; label: string }> = [
  { value: "owned", label: "所持" },
  { value: "name", label: "キャラ" },
  { value: "limited", label: "限定" },
  { value: "limitBreak", label: "限界突破" },
  { value: "star", label: "☆" },
  { value: "connectRank", label: "コネクトRANK" },
  { value: "ue1", label: "専用1" },
  { value: "ue2", label: "専用2" },
  { value: "ownedMemoryPiece", label: "所持メモピ" },
  { value: "obtainedDate", label: "入手日" },
  { value: "gachaPullCount", label: "ガチャ回数" },
  { value: "totalMemoryNeeded", label: "必要メモピ合計" },
  { value: "ue1HeartFragmentNeeded", label: "必要ハートの欠片" },
];

// 複数選択フィルタの選択肢。値の並びは保存値の検証と同じ定義（uiStorage）を使う。
const starFilterOptions = STAR_FILTER_VALUES.map((star) => ({ value: star, label: `☆${star}` }));
const ue1FilterOptions = UE1_FILTER_VALUES.map((filter) => ({
  value: filter,
  label: filter === "unimplemented" ? "未実装" : filter === "sp" ? "SP" : formatUeLevel(filter),
}));
const ue2FilterOptions = UE2_FILTER_VALUES.map((filter) => ({
  value: filter,
  label: filter === "unimplemented" ? "未実装" : formatUeLevel(filter),
}));
const memorySourceFilterOptions = MEMORY_SOURCE_FILTER_VALUES.map((filter) => ({
  value: filter,
  label: filter === "none" ? "情報なし" : memorySourceLabelMap[filter],
}));

// 育成入力画面のソートとフィルタ操作 UI を表示する。
export const InputFilters = memo(function InputFilters({
  ownedFilter,
  onOwnedFilterChange,
  limitedFilter,
  onLimitedFilterChange,
  ue1SpImplementedFilter,
  onUe1SpImplementedFilterChange,
  limitBreakFilter,
  onLimitBreakFilterChange,
  adventureMemoryPieceFilter,
  onAdventureMemoryPieceFilterChange,
  purePieceAvailabilityFilter,
  onPurePieceAvailabilityFilterChange,
  starFilters,
  setStarFilters,
  ue1Filters,
  setUe1Filters,
  ue2Filters,
  setUe2Filters,
  memorySourceFilters,
  setMemorySourceFilters,
  sortKey,
  onSortKeyChange,
  sortDirection,
  onSortDirectionChange,
}: InputFiltersProps) {
  // すべての絞り込み条件を既定値へ戻す。
  function resetFilters(): void {
    onOwnedFilterChange("all");
    onLimitedFilterChange("all");
    onUe1SpImplementedFilterChange("all");
    onLimitBreakFilterChange("all");
    onAdventureMemoryPieceFilterChange("all");
    onPurePieceAvailabilityFilterChange("all");
    setStarFilters(null);
    setUe1Filters(null);
    setUe2Filters(null);
    setMemorySourceFilters(null);
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-danger/60 bg-danger-bg/40 text-danger hover:border-danger-strong hover:text-danger-strong"
          onClick={resetFilters}
        >
          リセット
        </Button>
      </div>
      <p className={`${sectionLabelClass} mb-1`}>ソート</p>
      <div className={`${inputToolbarClass} mb-4`}>
        <div className="grid gap-1.5 text-sm text-muted">
          <Label>ソート列</Label>
          <Select value={sortKey} onValueChange={(value) => onSortKeyChange(value as SortKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortKeyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 text-sm text-muted">
          <Label>ソート順</Label>
          <Select
            value={sortDirection ?? "none"}
            onValueChange={(value) => onSortDirectionChange(value === "none" ? null : (value as SortDirection))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">なし</SelectItem>
              <SelectItem value="asc">昇順</SelectItem>
              <SelectItem value="desc">降順</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className={`${sectionLabelClass} mb-1`}>フィルタ</p>
      <div className={inputToolbarClass}>
        <div className="grid gap-1.5 text-sm text-muted">
          <Label>所持</Label>
          <Select value={ownedFilter} onValueChange={(value) => onOwnedFilterChange(value as OwnedFilter)}>
            <SelectTrigger className={filterTriggerClass} data-active={ownedFilter !== "all"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="owned">所持のみ</SelectItem>
              <SelectItem value="unowned">未所持のみ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 text-sm text-muted">
          <Label>限定</Label>
          <Select value={limitedFilter} onValueChange={(value) => onLimitedFilterChange(value as LimitedFilter)}>
            <SelectTrigger className={filterTriggerClass} data-active={limitedFilter !== "all"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="limited">限定のみ</SelectItem>
              <SelectItem value="normal">恒常のみ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 text-sm text-muted">
          <Label>限界突破</Label>
          <Select value={limitBreakFilter} onValueChange={(value) => onLimitBreakFilterChange(value as LimitBreakFilter)}>
            <SelectTrigger className={filterTriggerClass} data-active={limitBreakFilter !== "all"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="on">限界突破済み</SelectItem>
              <SelectItem value="off">未限界突破</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 text-sm text-muted">
          <Label>アドベンチャー</Label>
          <Select
            value={adventureMemoryPieceFilter}
            onValueChange={(value) => onAdventureMemoryPieceFilterChange(value as AdventureMemoryPieceFilter)}
          >
            <SelectTrigger className={filterTriggerClass} data-active={adventureMemoryPieceFilter !== "all"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="on">メモピ枠のみ</SelectItem>
              <SelectItem value="off">メモピ枠以外</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 text-sm text-muted">
          <Label>ピュアピ</Label>
          <Select
            value={purePieceAvailabilityFilter}
            onValueChange={(value) => onPurePieceAvailabilityFilterChange(value as PurePieceAvailabilityFilter)}
          >
            <SelectTrigger className={filterTriggerClass} data-active={purePieceAvailabilityFilter !== "all"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="available">入手可能のみ</SelectItem>
              <SelectItem value="unavailable">入手不可能のみ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <MultiSelectFilter
          title="☆"
          selectedValues={starFilters}
          options={starFilterOptions}
          allLabel="すべて"
          noneLabel="選択なし"
          triggerClassName={filterTriggerClass}
          onValueChange={setStarFilters}
        />

        <MultiSelectFilter
          title="専用1"
          selectedValues={ue1Filters}
          options={ue1FilterOptions}
          allLabel="すべて"
          noneLabel="選択なし"
          triggerClassName={filterTriggerClass}
          onValueChange={setUe1Filters}
        />

        <div className="grid gap-1.5 text-sm text-muted">
          <Label>専用1SP</Label>
          <Select
            value={ue1SpImplementedFilter}
            onValueChange={(value) => onUe1SpImplementedFilterChange(value as Ue1SpImplementedFilter)}
          >
            <SelectTrigger className={filterTriggerClass} data-active={ue1SpImplementedFilter !== "all"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="implemented">実装済みのみ</SelectItem>
              <SelectItem value="unimplemented">未実装のみ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <MultiSelectFilter
          title="専用2"
          selectedValues={ue2Filters}
          options={ue2FilterOptions}
          allLabel="すべて"
          noneLabel="選択なし"
          triggerClassName={filterTriggerClass}
          onValueChange={setUe2Filters}
        />

        <MultiSelectFilter
          title="メモピ入手"
          selectedValues={memorySourceFilters}
          options={memorySourceFilterOptions}
          allLabel="すべて"
          noneLabel="選択なし"
          triggerClassName={filterTriggerClass}
          onValueChange={setMemorySourceFilters}
        />
      </div>
    </>
  );
});
