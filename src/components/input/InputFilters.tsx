import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
import type { Dispatch, SetStateAction } from "react";
import type { CharacterProgress } from "../../domain/types";
import type {
  LimitBreakFilter,
  LimitedFilter,
  MemorySourceFilter,
  OwnedFilter,
  StarFilter,
  StarMemoryNeedFilter,
  Ue1Filter,
  Ue2Filter,
} from "../../domain/uiStorage";
import { STAR_MEMORY_FILTER_VALUES } from "../../utils/starMemoryCost";
import { memorySourceLabelMap } from "./constants";
import { formatUeLevel } from "./formatters";
import {
  controlClass,
  fieldGroupClass,
  filterSeparatorClass,
  inputToolbarClass,
  multiSelectItemClass,
  multiSelectPanelClass,
  multiSelectSummaryClass,
  resetButtonClass,
  sectionLabelClass,
} from "./uiStyles";

type InputFiltersProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  ownedFilter: OwnedFilter;
  onOwnedFilterChange: (value: OwnedFilter) => void;
  limitedFilter: LimitedFilter;
  onLimitedFilterChange: (value: LimitedFilter) => void;
  limitBreakFilter: LimitBreakFilter;
  onLimitBreakFilterChange: (value: LimitBreakFilter) => void;
  starFilters: StarFilter[];
  setStarFilters: Dispatch<SetStateAction<StarFilter[]>>;
  starMemoryNeedFilters: StarMemoryNeedFilter[];
  setStarMemoryNeedFilters: Dispatch<SetStateAction<StarMemoryNeedFilter[]>>;
  ue1Filters: Ue1Filter[];
  setUe1Filters: Dispatch<SetStateAction<Ue1Filter[]>>;
  ue2Filters: Ue2Filter[];
  setUe2Filters: Dispatch<SetStateAction<Ue2Filter[]>>;
  memorySourceFilters: MemorySourceFilter[];
  setMemorySourceFilters: Dispatch<SetStateAction<MemorySourceFilter[]>>;
};

// 育成入力画面の検索・フィルタ操作 UI を表示する。
export function InputFilters({
  searchText,
  onSearchTextChange,
  ownedFilter,
  onOwnedFilterChange,
  limitedFilter,
  onLimitedFilterChange,
  limitBreakFilter,
  onLimitBreakFilterChange,
  starFilters,
  setStarFilters,
  starMemoryNeedFilters,
  setStarMemoryNeedFilters,
  ue1Filters,
  setUe1Filters,
  ue2Filters,
  setUe2Filters,
  memorySourceFilters,
  setMemorySourceFilters,
}: InputFiltersProps) {
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

  // 指定フィルタの選択状態を配列内でトグルする。
  function toggleFilter<T>(filter: T, setFilters: Dispatch<SetStateAction<T[]>>): void {
    setFilters((previous) => (previous.includes(filter) ? previous.filter((value) => value !== filter) : [...previous, filter]));
  }

  // キャラ検索文字列を初期化する。
  function resetSearchText(): void {
    onSearchTextChange("");
  }

  // すべての絞り込み条件を既定値へ戻す。
  function resetFilters(): void {
    onOwnedFilterChange("all");
    onLimitedFilterChange("all");
    onLimitBreakFilterChange("all");
    setStarFilters([]);
    setStarMemoryNeedFilters([]);
    setUe1Filters([]);
    setUe2Filters([]);
    setMemorySourceFilters([]);
  }

  return (
    <>
      <label className={`${fieldGroupClass} mb-3`}>
        <span>キャラ検索</span>
        <span className="flex items-center gap-2">
          <input
            className={controlClass}
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="例: ヒヨリ"
          />
          <button type="button" className={`${resetButtonClass} shrink-0`} onClick={resetSearchText}>
            リセット
          </button>
        </span>
      </label>

      <div className={filterSeparatorClass} role="separator" aria-label="キャラ検索とフィルタの区切り" />

      <p className={`${sectionLabelClass} mb-1`}>フィルタ</p>
      <div className="mb-2">
        <button type="button" className={resetButtonClass} onClick={resetFilters}>
          リセット
        </button>
      </div>
      <div className={inputToolbarClass}>
        <label className={fieldGroupClass}>
          <span>所持</span>
          <select className={controlClass} value={ownedFilter} onChange={(event) => onOwnedFilterChange(event.target.value as OwnedFilter)}>
            <option value="all">すべて</option>
            <option value="owned">所持のみ</option>
            <option value="unowned">未所持のみ</option>
          </select>
        </label>

        <label className={fieldGroupClass}>
          <span>限定</span>
          <select className={controlClass} value={limitedFilter} onChange={(event) => onLimitedFilterChange(event.target.value as LimitedFilter)}>
            <option value="all">すべて</option>
            <option value="limited">限定のみ</option>
            <option value="normal">恒常のみ</option>
          </select>
        </label>

        <label className={fieldGroupClass}>
          <span>限界突破</span>
          <select
            className={controlClass}
            value={limitBreakFilter}
            onChange={(event) => onLimitBreakFilterChange(event.target.value as LimitBreakFilter)}
          >
            <option value="all">すべて</option>
            <option value="on">限界突破済み</option>
            <option value="off">未限界突破</option>
          </select>
        </label>

        <div className={fieldGroupClass}>
          <span>☆</span>
          <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
            <summary className={multiSelectSummaryClass}>{starFilters.length === 0 ? "すべて" : selectedStarLabels}</summary>
            <div className={multiSelectPanelClass}>
              {[1, 2, 3, 4, 5, 6].map((star) => (
                <label key={star} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={starFilters.includes(star as CharacterProgress["star"])}
                    onChange={() => toggleFilter(star as CharacterProgress["star"], setStarFilters)}
                  />
                  <span>☆{star}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className={fieldGroupClass}>
          <span>☆必要メモピ</span>
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
                    onChange={() => toggleFilter(value, setStarMemoryNeedFilters)}
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className={fieldGroupClass}>
          <span>専用1</span>
          <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
            <summary className={multiSelectSummaryClass}>{ue1Filters.length === 0 ? "すべて" : selectedUe1Labels}</summary>
            <div className={multiSelectPanelClass}>
              <label className={multiSelectItemClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={ue1Filters.includes("unimplemented")}
                  onChange={() => toggleFilter("unimplemented", setUe1Filters)}
                />
                <span>未実装</span>
              </label>
              {UE1_LEVEL_VALUES.map((level) => (
                <label key={level} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={ue1Filters.includes(level)}
                    onChange={() => toggleFilter(level, setUe1Filters)}
                  />
                  <span>{formatUeLevel(level)}</span>
                </label>
              ))}
              <label className={multiSelectItemClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={ue1Filters.includes("sp")}
                  onChange={() => toggleFilter("sp", setUe1Filters)}
                />
                <span>SP</span>
              </label>
            </div>
          </details>
        </div>

        <div className={fieldGroupClass}>
          <span>専用2</span>
          <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
            <summary className={multiSelectSummaryClass}>{ue2Filters.length === 0 ? "すべて" : selectedUe2Labels}</summary>
            <div className={multiSelectPanelClass}>
              <label className={multiSelectItemClass}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={ue2Filters.includes("unimplemented")}
                  onChange={() => toggleFilter("unimplemented", setUe2Filters)}
                />
                <span>未実装</span>
              </label>
              {UE2_LEVEL_VALUES.map((level) => (
                <label key={level} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={ue2Filters.includes(level)}
                    onChange={() => toggleFilter(level, setUe2Filters)}
                  />
                  <span>{formatUeLevel(level)}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className={fieldGroupClass}>
          <span>メモピ入手</span>
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
                  onChange={() => toggleFilter("none", setMemorySourceFilters)}
                />
                <span>情報なし</span>
              </label>
              {Object.entries(memorySourceLabelMap).map(([source, label]) => (
                <label key={source} className={multiSelectItemClass}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={memorySourceFilters.includes(source as MemorySourceFilter)}
                    onChange={() => toggleFilter(source as MemorySourceFilter, setMemorySourceFilters)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
