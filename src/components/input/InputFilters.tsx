import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
import { memo, type Dispatch, type SetStateAction } from "react";
import type { CharacterProgress } from "../../domain/types";
import type {
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
} from "../../domain/uiStorage";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { MultiSelectFilter } from "../ui/multi-select-filter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { memorySourceLabelMap } from "./constants";
import { formatUeLevel } from "./formatters";
import { inputToolbarClass, sectionLabelClass } from "./uiStyles";

type InputFiltersProps = {
  ownedFilter: OwnedFilter;
  onOwnedFilterChange: (value: OwnedFilter) => void;
  limitedFilter: LimitedFilter;
  onLimitedFilterChange: (value: LimitedFilter) => void;
  limitBreakFilter: LimitBreakFilter;
  onLimitBreakFilterChange: (value: LimitBreakFilter) => void;
  adventureMemoryPieceFilter: AdventureMemoryPieceFilter;
  onAdventureMemoryPieceFilterChange: (value: AdventureMemoryPieceFilter) => void;
  purePieceAvailabilityFilter: PurePieceAvailabilityFilter;
  onPurePieceAvailabilityFilterChange: (value: PurePieceAvailabilityFilter) => void;
  starFilters: StarFilter[];
  setStarFilters: Dispatch<SetStateAction<StarFilter[]>>;
  ue1Filters: Ue1Filter[];
  setUe1Filters: Dispatch<SetStateAction<Ue1Filter[]>>;
  ue2Filters: Ue2Filter[];
  setUe2Filters: Dispatch<SetStateAction<Ue2Filter[]>>;
  memorySourceFilters: MemorySourceFilter[];
  setMemorySourceFilters: Dispatch<SetStateAction<MemorySourceFilter[]>>;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
  onApplyDisplaySettings: () => void;
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

// ラベル配列をスラッシュ区切りの文字列へ整形する。
function buildSummary(labels: string[]): string {
  return labels.join(" / ");
}

// 育成入力画面のソートとフィルタ操作 UI を表示する。
export const InputFilters = memo(function InputFilters({
  ownedFilter,
  onOwnedFilterChange,
  limitedFilter,
  onLimitedFilterChange,
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
  onApplyDisplaySettings,
}: InputFiltersProps) {
  const selectedMemorySourceLabels = buildSummary(
    memorySourceFilters.map((filter) => (filter === "none" ? "情報なし" : memorySourceLabelMap[filter])),
  );
  const selectedStarLabels = buildSummary(starFilters.map((star) => `☆${star}`));
  const selectedUe1Labels = buildSummary(
    ue1Filters.map((filter) => (filter === "unimplemented" ? "未実装" : filter === "sp" ? "SP" : formatUeLevel(filter))),
  );
  const selectedUe2Labels = buildSummary(
    ue2Filters.map((filter) => (filter === "unimplemented" ? "未実装" : formatUeLevel(filter))),
  );

  // 指定フィルタの選択状態を配列内でトグルする。
  function toggleFilter<T>(filter: T, setFilters: Dispatch<SetStateAction<T[]>>): void {
    setFilters((previous) => (previous.includes(filter) ? previous.filter((value) => value !== filter) : [...previous, filter]));
  }

  // すべての絞り込み条件を既定値へ戻す。
  function resetFilters(): void {
    onOwnedFilterChange("all");
    onLimitedFilterChange("all");
    onLimitBreakFilterChange("all");
    onAdventureMemoryPieceFilterChange("all");
    onPurePieceAvailabilityFilterChange("all");
    setStarFilters([]);
    setUe1Filters([]);
    setUe2Filters([]);
    setMemorySourceFilters([]);
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button type="button" variant="default" size="sm" className="bg-none bg-accent" onClick={onApplyDisplaySettings}>
          表示に適用
        </Button>
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
            <SelectTrigger>
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
            <SelectTrigger>
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
            <SelectTrigger>
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
            <SelectTrigger>
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
            <SelectTrigger>
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
          options={[1, 2, 3, 4, 5, 6].map((star) => ({ value: star as CharacterProgress["star"], label: `☆${star}` }))}
          emptyLabel="すべて"
          summary={selectedStarLabels}
          onToggle={(value) => toggleFilter(value, setStarFilters)}
        />

        <MultiSelectFilter
          title="専用1"
          selectedValues={ue1Filters}
          options={[
            { value: "unimplemented", label: "未実装" },
            ...UE1_LEVEL_VALUES.map((level) => ({ value: level as Ue1Filter, label: formatUeLevel(level) })),
            { value: "sp", label: "SP" },
          ]}
          emptyLabel="すべて"
          summary={selectedUe1Labels}
          onToggle={(value) => toggleFilter(value, setUe1Filters)}
        />

        <MultiSelectFilter
          title="専用2"
          selectedValues={ue2Filters}
          options={[
            { value: "unimplemented", label: "未実装" },
            ...UE2_LEVEL_VALUES.map((level) => ({ value: level as Ue2Filter, label: formatUeLevel(level) })),
          ]}
          emptyLabel="すべて"
          summary={selectedUe2Labels}
          onToggle={(value) => toggleFilter(value, setUe2Filters)}
        />

        <MultiSelectFilter
          title="メモピ入手"
          selectedValues={memorySourceFilters}
          options={[
            { value: "none", label: "情報なし" },
            ...Object.entries(memorySourceLabelMap).map(([source, label]) => ({ value: source as MemorySourceFilter, label })),
          ]}
          emptyLabel="すべて"
          summary={selectedMemorySourceLabels}
          onToggle={(value) => toggleFilter(value, setMemorySourceFilters)}
        />
      </div>
    </>
  );
});
