import { memo, useCallback } from "react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { SortDirection, SortKey } from "../../domain/uiStorage";
import { getLimitBreakRemainingMemoryPieceCount } from "../../utils/limitBreakMemoryCost";
import { getUe1RemainingMemoryPieceCount, type Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import { getStarRemainingMemoryPieceCount, type StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { memorySourceLabelMap, sourceChipClassMap } from "./constants";
import { formatUeLevel } from "./formatters";
import type { ProgressPatch, VisibleRow } from "./types";
import {
  disabledTableSelectClass,
  limitedBadgeClass,
  normalBadgeClass,
  sortButtonClass,
  sortIndicatorClass,
  sourceChipEmptyClass,
  tableBodyCellClass,
  tableCheckClass,
  tableClass,
  tableHeadCellClass,
  tableSelectClass,
  tableSwitchClass,
  tableWrapClass,
} from "./uiStyles";

type InputProgressTableProps = {
  visibleRows: VisibleRow[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (sortKey: SortKey) => void;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
};

// ソート状態をth要素のaria-sort値に変換する。
function getAriaSort(columnKey: SortKey, sortKey: SortKey, sortDirection: SortDirection): "none" | "ascending" | "descending" {
  if (sortKey !== columnKey || sortDirection === null) {
    return "none";
  }
  return sortDirection === "asc" ? "ascending" : "descending";
}

// ソート中の列に矢印記号を表示する。
function renderSortIndicator(columnKey: SortKey, sortKey: SortKey, sortDirection: SortDirection): string {
  if (sortKey !== columnKey || sortDirection === null) {
    return "";
  }
  return sortDirection === "asc" ? "▲" : "▼";
}

type TableRowProps = {
  character: MasterCharacter;
  progress: CharacterProgress;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
};

// テーブル行コンポーネント。行単位でメモ化し不要な再レンダリングを防ぐ。
const TableRow = memo(function TableRow({
  character,
  progress,
  onUpdateProgress,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
}: TableRowProps) {
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
  const adjustedTotalRemainingMemoryPiece = Math.max(0, totalRemainingMemoryPiece - progress.ownedMemoryPiece);

  const handleOwnedChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onUpdateProgress(character.name, { owned: event.target.checked }),
    [onUpdateProgress, character.name],
  );
  const handleLimitBreakChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onUpdateProgress(character.name, { limitBreak: event.target.checked }),
    [onUpdateProgress, character.name],
  );
  const handleStarChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) =>
      onUpdateProgress(character.name, { star: Number(event.target.value) as CharacterProgress["star"] }),
    [onUpdateProgress, character.name],
  );
  const handleUe1Change = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (event.target.value === "sp") {
        onUpdateProgress(character.name, { ue1Level: 370, ue1SpEquipped: true });
        return;
      }
      const nextValue = (event.target.value === "null"
        ? null
        : Number(event.target.value)) as CharacterProgress["ue1Level"];
      onUpdateProgress(character.name, { ue1Level: nextValue, ue1SpEquipped: false });
    },
    [onUpdateProgress, character.name],
  );
  const handleUe2Change = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextValue = (event.target.value === "null"
        ? null
        : Number(event.target.value)) as CharacterProgress["ue2Level"];
      onUpdateProgress(character.name, { ue2Level: nextValue });
    },
    [onUpdateProgress, character.name],
  );
  const handleOwnedMemoryPieceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextOwnedMemoryPiece = Math.max(0, Math.floor(Number(event.target.value) || 0));
      onUpdateProgress(character.name, { ownedMemoryPiece: nextOwnedMemoryPiece });
    },
    [onUpdateProgress, character.name],
  );

  return (
    <tr className="odd:bg-[#091425b5] even:bg-[#10203ab5] hover:bg-[#3a537c24]">
      <td className={tableBodyCellClass}>
        <label className={tableSwitchClass}>
          <input
            type="checkbox"
            className={tableCheckClass}
            checked={progress.owned}
            aria-label={`${character.name}の所持状態`}
            onChange={handleOwnedChange}
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
            onChange={handleLimitBreakChange}
          />
        </label>
      </td>
      <td className={tableBodyCellClass}>
        <select
          className={tableSelectClass}
          value={progress.star}
          onChange={handleStarChange}
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
            onChange={handleUe1Change}
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
            onChange={handleUe2Change}
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
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className={tableSelectClass}
          value={progress.ownedMemoryPiece}
          aria-label={`${character.name}の所持メモピ数`}
          onChange={handleOwnedMemoryPieceChange}
        />
      </td>
      <td className={tableBodyCellClass}>
        <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{starRemainingMemoryPiece}</span>
      </td>
      <td className={tableBodyCellClass}>
        <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{ue1RemainingMemoryPiece}</span>
      </td>
      <td className={tableBodyCellClass}>
        <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{limitBreakRemainingMemoryPiece}</span>
      </td>
      <td className={tableBodyCellClass}>
        <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{adjustedTotalRemainingMemoryPiece}</span>
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
});

// 育成入力テーブル本体を表示し、各行の進捗編集を受け付ける。
export const InputProgressTable = memo(function InputProgressTable({
  visibleRows,
  sortKey,
  sortDirection,
  onSort,
  onUpdateProgress,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
}: InputProgressTableProps) {
  return (
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
          <col className="w-[140px]" />
          <col className="w-[120px]" />
          <col className="w-[130px]" />
          <col className="w-[145px]" />
          <col className="w-[120px]" />
          <col className="w-[260px]" />
        </colgroup>
        <thead>
          <tr>
            <th aria-sort={getAriaSort("owned", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("owned")}>
                所持<span className={sortIndicatorClass}>{renderSortIndicator("owned", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("name", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("name")}>
                キャラ<span className={sortIndicatorClass}>{renderSortIndicator("name", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("limited", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("limited")}>
                区分<span className={sortIndicatorClass}>{renderSortIndicator("limited", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("limitBreak", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("limitBreak")}>
                限界突破<span className={sortIndicatorClass}>{renderSortIndicator("limitBreak", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("star", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("star")}>
                ☆<span className={sortIndicatorClass}>{renderSortIndicator("star", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("ue1", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("ue1")}>
                専用1<span className={sortIndicatorClass}>{renderSortIndicator("ue1", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("ue2", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("ue2")}>
                専用2<span className={sortIndicatorClass}>{renderSortIndicator("ue2", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("ownedMemoryPiece", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("ownedMemoryPiece")}>
                所持メモピ<span className={sortIndicatorClass}>{renderSortIndicator("ownedMemoryPiece", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("starMemoryNeeded", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("starMemoryNeeded")}>
                ☆必要メモピ<span className={sortIndicatorClass}>{renderSortIndicator("starMemoryNeeded", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("ue1MemoryNeeded", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("ue1MemoryNeeded")}>
                専用1必要メモピ<span className={sortIndicatorClass}>{renderSortIndicator("ue1MemoryNeeded", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("limitBreakMemoryNeeded", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("limitBreakMemoryNeeded")}>
                限界突破必要メモピ
                <span className={sortIndicatorClass}>{renderSortIndicator("limitBreakMemoryNeeded", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("totalMemoryNeeded", sortKey, sortDirection)} className={tableHeadCellClass}>
              <button type="button" className={sortButtonClass} onClick={() => onSort("totalMemoryNeeded")}>
                必要メモピ合計<span className={sortIndicatorClass}>{renderSortIndicator("totalMemoryNeeded", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th className={tableHeadCellClass}>メモピ入手</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-3 py-[18px] text-center text-muted">
                条件に一致するキャラがいません
              </td>
            </tr>
          ) : (
            visibleRows.map(({ character, progress }) => (
              <TableRow
                key={character.name}
                character={character}
                progress={progress}
                onUpdateProgress={onUpdateProgress}
                starMemoryCalcMode={starMemoryCalcMode}
                ue1MemoryCalcMode={ue1MemoryCalcMode}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});
