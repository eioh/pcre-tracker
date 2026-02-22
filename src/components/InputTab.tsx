import { useEffect, useRef, useMemo, useState } from "react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../domain/levels";
import type { CharacterProgress, MasterCharacter, MemoryPieceSource, StoredStateV1 } from "../domain/types";
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
};

type OwnedFilter = "all" | "owned" | "unowned";
type LimitedFilter = "all" | "limited" | "normal";
type LimitBreakFilter = "all" | "on" | "off";
type StarFilter = CharacterProgress["star"];
type StarMemoryNeedFilter = number;
type Ue1Filter = "unimplemented" | "sp" | (typeof UE1_LEVEL_VALUES)[number];
type Ue2Filter = "unimplemented" | (typeof UE2_LEVEL_VALUES)[number];
type MemorySourceFilter = "none" | MemoryPieceSource;
type SortKey =
  | "owned"
  | "name"
  | "limited"
  | "limitBreak"
  | "star"
  | "ue1"
  | "ue2"
  | "starMemoryNeeded"
  | "ue1MemoryNeeded";
type SortDirection = "asc" | "desc" | null;

const memorySourceLabelMap: Record<MemoryPieceSource, string> = {
  dungeon_coin: "ダンジョン",
  arena_coin: "アリーナ",
  p_arena_coin: "プリーナ",
  clan_coin: "クラン",
  master_coin: "マスター",
  hard_quest: "ハード",
  side_story: "サイド",
};

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

export function InputTab({ masterCharacters, state, onUpdateProgress }: InputTabProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [searchText, setSearchText] = useState("");
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [limitedFilter, setLimitedFilter] = useState<LimitedFilter>("all");
  const [limitBreakFilter, setLimitBreakFilter] = useState<LimitBreakFilter>("all");
  const [starMemoryCalcMode, setStarMemoryCalcMode] = useState<StarMemoryCalcMode>("implemented_max");
  const [ue1MemoryCalcMode, setUe1MemoryCalcMode] = useState<Ue1MemoryCalcMode>("implemented_max");
  const [starFilters, setStarFilters] = useState<StarFilter[]>([]);
  const [starMemoryNeedFilters, setStarMemoryNeedFilters] = useState<StarMemoryNeedFilter[]>([]);
  const [ue1Filters, setUe1Filters] = useState<Ue1Filter[]>([]);
  const [ue2Filters, setUe2Filters] = useState<Ue2Filter[]>([]);
  const [memorySourceFilters, setMemorySourceFilters] = useState<MemorySourceFilter[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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
      const progress = state.progressByName[character.name];
      if (!progress) {
        continue;
      }
      if (trimmedSearchText && !character.name.includes(trimmedSearchText)) {
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

  function getAriaSort(columnKey: SortKey): "none" | "ascending" | "descending" {
    if (sortKey !== columnKey || sortDirection === null) {
      return "none";
    }
    return sortDirection === "asc" ? "ascending" : "descending";
  }

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

  function toggleUe1Filter(filter: Ue1Filter): void {
    setUe1Filters((previous) =>
      previous.includes(filter) ? previous.filter((value) => value !== filter) : [...previous, filter],
    );
  }

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

  useEffect(() => {
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
    <section className="panel" ref={rootRef}>
      <div className="input-toolbar">
        <label className="field-group">
          <span>キャラ検索</span>
          <input
            className="text-input"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="例: ヒヨリ"
          />
        </label>

        <label className="field-group">
          <span>所持フィルタ</span>
          <select
            className="select-input"
            value={ownedFilter}
            onChange={(event) => setOwnedFilter(event.target.value as OwnedFilter)}
          >
            <option value="all">すべて</option>
            <option value="owned">所持のみ</option>
            <option value="unowned">未所持のみ</option>
          </select>
        </label>

        <label className="field-group">
          <span>限定フィルタ</span>
          <select
            className="select-input"
            value={limitedFilter}
            onChange={(event) => setLimitedFilter(event.target.value as LimitedFilter)}
          >
            <option value="all">すべて</option>
            <option value="limited">限定のみ</option>
            <option value="normal">恒常のみ</option>
          </select>
        </label>

        <label className="field-group">
          <span>限界突破フィルタ</span>
          <select
            className="select-input"
            value={limitBreakFilter}
            onChange={(event) => setLimitBreakFilter(event.target.value as LimitBreakFilter)}
          >
            <option value="all">すべて</option>
            <option value="on">限界突破済み</option>
            <option value="off">未限界突破</option>
          </select>
        </label>

        <div className="field-group">
          <span>☆フィルタ</span>
          <details className="multi-select-dropdown">
            <summary className="select-input multi-select-summary">{starFilters.length === 0 ? "すべて" : selectedStarLabels}</summary>
            <div className="multi-select-panel">
              {[1, 2, 3, 4, 5, 6].map((star) => (
                <label key={star} className="memory-source-filter-item">
                  <input
                    type="checkbox"
                    checked={starFilters.includes(star as CharacterProgress["star"])}
                    onChange={() => toggleStarFilter(star as CharacterProgress["star"])}
                  />
                  <span>☆{star}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className="field-group">
          <span>☆必要メモピフィルタ</span>
          <details className="multi-select-dropdown">
            <summary className="select-input multi-select-summary">
              {starMemoryNeedFilters.length === 0 ? "すべて" : selectedStarMemoryNeedLabels}
            </summary>
            <div className="multi-select-panel">
              {STAR_MEMORY_FILTER_VALUES.map((value) => (
                <label key={value} className="memory-source-filter-item">
                  <input
                    type="checkbox"
                    checked={starMemoryNeedFilters.includes(value)}
                    onChange={() => toggleStarMemoryNeedFilter(value)}
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className="field-group">
          <span>専用1フィルタ</span>
          <details className="multi-select-dropdown">
            <summary className="select-input multi-select-summary">{ue1Filters.length === 0 ? "すべて" : selectedUe1Labels}</summary>
            <div className="multi-select-panel">
              <label className="memory-source-filter-item">
                <input
                  type="checkbox"
                  checked={ue1Filters.includes("unimplemented")}
                  onChange={() => toggleUe1Filter("unimplemented")}
                />
                <span>未実装</span>
              </label>
              {UE1_LEVEL_VALUES.map((level) => (
                <label key={level} className="memory-source-filter-item">
                  <input
                    type="checkbox"
                    checked={ue1Filters.includes(level)}
                    onChange={() => toggleUe1Filter(level)}
                  />
                  <span>{formatUeLevel(level)}</span>
                </label>
              ))}
              <label className="memory-source-filter-item">
                <input type="checkbox" checked={ue1Filters.includes("sp")} onChange={() => toggleUe1Filter("sp")} />
                <span>SP</span>
              </label>
            </div>
          </details>
        </div>

        <div className="field-group">
          <span>専用2フィルタ</span>
          <details className="multi-select-dropdown">
            <summary className="select-input multi-select-summary">{ue2Filters.length === 0 ? "すべて" : selectedUe2Labels}</summary>
            <div className="multi-select-panel">
              <label className="memory-source-filter-item">
                <input
                  type="checkbox"
                  checked={ue2Filters.includes("unimplemented")}
                  onChange={() => toggleUe2Filter("unimplemented")}
                />
                <span>未実装</span>
              </label>
              {UE2_LEVEL_VALUES.map((level) => (
                <label key={level} className="memory-source-filter-item">
                  <input
                    type="checkbox"
                    checked={ue2Filters.includes(level)}
                    onChange={() => toggleUe2Filter(level)}
                  />
                  <span>{formatUeLevel(level)}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className="field-group">
          <span>メモピ入手フィルタ</span>
          <details className="multi-select-dropdown">
            <summary className="select-input multi-select-summary">
              {memorySourceFilters.length === 0 ? "すべて" : selectedMemorySourceLabels}
            </summary>
            <div className="multi-select-panel">
              <label className="memory-source-filter-item">
                <input
                  type="checkbox"
                  checked={memorySourceFilters.includes("none")}
                  onChange={() => toggleMemorySourceFilter("none")}
                />
                <span>情報なし</span>
              </label>
              {Object.entries(memorySourceLabelMap).map(([source, label]) => (
                <label key={source} className="memory-source-filter-item">
                  <input
                    type="checkbox"
                    checked={memorySourceFilters.includes(source as MemorySourceFilter)}
                    onChange={() => toggleMemorySourceFilter(source as MemorySourceFilter)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className="memory-calc-section">
          <p className="memory-calc-title">必要メモピ計算</p>
          <div className="memory-calc-grid">
            <label className="field-group">
              <span>☆</span>
              <select
                className="select-input"
                value={starMemoryCalcMode}
                onChange={(event) => setStarMemoryCalcMode(event.target.value as StarMemoryCalcMode)}
              >
                <option value="implemented_max">実装段階の最大まで</option>
                <option value="star6_max">☆6最大まで（仮定）</option>
              </select>
            </label>

            <label className="field-group">
              <span>専用1</span>
              <select
                className="select-input"
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

      <p className="result-count">表示件数: {visibleRows.length}</p>

      <div className="table-wrap">
        <table className="character-table">
          <thead>
            <tr>
              <th aria-sort={getAriaSort("owned")}>
                <button type="button" className="sort-button" onClick={() => handleSort("owned")}>
                  所持<span className="sort-indicator">{renderSortIndicator("owned")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("name")}>
                <button type="button" className="sort-button" onClick={() => handleSort("name")}>
                  キャラ<span className="sort-indicator">{renderSortIndicator("name")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("limited")}>
                <button type="button" className="sort-button" onClick={() => handleSort("limited")}>
                  区分<span className="sort-indicator">{renderSortIndicator("limited")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("limitBreak")}>
                <button type="button" className="sort-button" onClick={() => handleSort("limitBreak")}>
                  限界突破<span className="sort-indicator">{renderSortIndicator("limitBreak")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("star")}>
                <button type="button" className="sort-button" onClick={() => handleSort("star")}>
                  ☆<span className="sort-indicator">{renderSortIndicator("star")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("ue1")}>
                <button type="button" className="sort-button" onClick={() => handleSort("ue1")}>
                  専用1<span className="sort-indicator">{renderSortIndicator("ue1")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("ue2")}>
                <button type="button" className="sort-button" onClick={() => handleSort("ue2")}>
                  専用2<span className="sort-indicator">{renderSortIndicator("ue2")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("starMemoryNeeded")}>
                <button type="button" className="sort-button" onClick={() => handleSort("starMemoryNeeded")}>
                  ☆必要メモピ<span className="sort-indicator">{renderSortIndicator("starMemoryNeeded")}</span>
                </button>
              </th>
              <th aria-sort={getAriaSort("ue1MemoryNeeded")}>
                <button type="button" className="sort-button" onClick={() => handleSort("ue1MemoryNeeded")}>
                  専用1必要メモピ<span className="sort-indicator">{renderSortIndicator("ue1MemoryNeeded")}</span>
                </button>
              </th>
              <th>メモピ入手</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty-row">
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

                return (
                  <tr key={character.name}>
                    <td>
                      <label className="table-switch">
                        <input
                          type="checkbox"
                          checked={progress.owned}
                          aria-label={`${character.name}の所持状態`}
                          onChange={(event) => onUpdateProgress(character.name, { owned: event.target.checked })}
                        />
                      </label>
                    </td>
                    <td className="name-cell">{character.name}</td>
                    <td>
                      {character.limited ? <span className="badge limited">限定</span> : <span className="badge">恒常</span>}
                    </td>
                    <td>
                      <label className="table-switch">
                        <input
                          type="checkbox"
                          checked={progress.limitBreak}
                          aria-label={`${character.name}の限界突破状態`}
                          onChange={(event) => onUpdateProgress(character.name, { limitBreak: event.target.checked })}
                        />
                      </label>
                    </td>
                    <td>
                      <select
                        className="select-input table-select"
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
                    <td>
                      {character.implemented.ue1 ? (
                        <select
                          className="select-input table-select"
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
                        <select className="select-input table-select table-select-disabled" value="null" disabled>
                          <option value="null">-</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {character.implemented.ue2 ? (
                        <select
                          className="select-input table-select"
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
                        <select className="select-input table-select table-select-disabled" value="null" disabled>
                          <option value="null">-</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <span className="memory-piece-needed">{starRemainingMemoryPiece}</span>
                    </td>
                    <td>
                      <span className="memory-piece-needed">{ue1RemainingMemoryPiece}</span>
                    </td>
                    <td>
                      <div className="table-source-list">
                        {character.memoryPieceSources.length === 0 ? (
                          <span className="source-chip empty">情報なし</span>
                        ) : (
                          character.memoryPieceSources.map((source) => (
                            <span key={source} className={`source-chip source-chip-${source}`}>
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
