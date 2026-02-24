import { memo, useCallback } from "react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { SortDirection, SortKey } from "../../domain/uiStorage";
import { getConnectRankRemainingMemoryPieceCount } from "../../utils/connectRankMemoryCost";
import { getLimitBreakRemainingMemoryPieceCount } from "../../utils/limitBreakMemoryCost";
import {
  getUe1RemainingHeartFragmentCountByMode,
  type Ue1HeartFragmentCalcMode,
} from "../../utils/ue1HeartFragmentCost";
import { getUe1RemainingMemoryPieceCount, type Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import { getStarRemainingMemoryPieceCount, type StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { attributeTextClassMap, memorySourceLabelMap, roleTextClassMap, sourceChipClassMap } from "./constants";
import { formatUeLevel } from "./formatters";
import type { ProgressPatch, VisibleRow } from "./types";
import {
  characterNameCellLayoutClass,
  characterTagLineClass,
  sortButtonClass,
  sortIndicatorClass,
  sourceChipEmptyClass,
  tableBodyCellClass,
  tableClass,
  tableHeadCellClass,
  tableSwitchClass,
  tableWrapClass,
} from "./uiStyles";
import { TableCheckbox } from "../ui/table-checkbox";
import { TableNumberInput } from "../ui/table-number-input";
import { TableSelect } from "../ui/table-select";

type InputProgressTableProps = {
  visibleRows: VisibleRow[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (sortKey: SortKey) => void;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  ue1HeartFragmentCalcMode: Ue1HeartFragmentCalcMode;
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
  ue1HeartFragmentCalcMode: Ue1HeartFragmentCalcMode;
};

// テーブル行コンポーネント。行単位でメモ化し不要な再レンダリングを防ぐ。
const TableRow = memo(function TableRow({
  character,
  progress,
  onUpdateProgress,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
  ue1HeartFragmentCalcMode,
}: TableRowProps) {
  const ue1Value = character.implemented.ue1 ? String(progress.ue1Level ?? 0) : "null";
  const ue2Value = character.implemented.ue2 ? String(progress.ue2Level ?? 0) : "null";
  const starMax = character.implemented.star6 ? 6 : 5;
  const ue1MaxLevel = UE1_LEVEL_VALUES[UE1_LEVEL_VALUES.length - 1];
  const ue2MaxLevel = UE2_LEVEL_VALUES[UE2_LEVEL_VALUES.length - 1];
  const connectRankMax = 15;
  const isStarAtMax = progress.star === starMax;
  const isConnectRankAtMax = progress.connectRank === connectRankMax;
  const isUe1AtMax =
    character.implemented.ue1 &&
    (character.implemented.ue1Sp ? progress.ue1SpEquipped : progress.ue1Level === ue1MaxLevel);
  const isUe2AtMax = character.implemented.ue2 && progress.ue2Level === ue2MaxLevel;
  const ue1CompositeValue =
    character.implemented.ue1 && character.implemented.ue1Sp && progress.ue1SpEquipped ? "sp" : ue1Value;
  const starRemainingMemoryPiece = getStarRemainingMemoryPieceCount(character, progress, starMemoryCalcMode);
  const connectRankRemainingMemoryPiece = getConnectRankRemainingMemoryPieceCount(progress);
  const ue1RemainingMemoryPiece = getUe1RemainingMemoryPieceCount(character, progress, ue1MemoryCalcMode);
  const ue1RemainingHeartFragment = getUe1RemainingHeartFragmentCountByMode(character, progress, ue1HeartFragmentCalcMode);
  const limitBreakRemainingMemoryPiece = getLimitBreakRemainingMemoryPieceCount(character, progress);
  const totalRemainingMemoryPiece =
    starRemainingMemoryPiece + connectRankRemainingMemoryPiece + ue1RemainingMemoryPiece + limitBreakRemainingMemoryPiece;
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
  const handleConnectRankChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) =>
      onUpdateProgress(character.name, { connectRank: Number(event.target.value) as CharacterProgress["connectRank"] }),
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
      <td className={`${tableBodyCellClass} text-center`}>
        <label className={`${tableSwitchClass} w-full justify-center`}>
          <TableCheckbox checked={progress.owned} aria-label={`${character.name}の所持状態`} onChange={handleOwnedChange} />
        </label>
      </td>
      <td className={`${tableBodyCellClass} whitespace-nowrap font-bold`}>
        <div className={characterNameCellLayoutClass}>
          <div className={characterTagLineClass}>
            <span className={character.limited ? "text-[#d8aeb3]" : "text-[#9ec8df]"}>{character.limited ? "限定" : "恒常"}</span>
            <span className="text-[#7f8ba5]">/</span>
            <span className={attributeTextClassMap[character.attribute]}>{character.attribute}</span>
            <span className="text-[#7f8ba5]">/</span>
            <span className={roleTextClassMap[character.role]}>{character.role}</span>
          </div>
          <span className="text-[1.05rem]">{character.name}</span>
        </div>
      </td>
      <td className={`${tableBodyCellClass} text-center`}>
        <label className={`${tableSwitchClass} w-full justify-center`}>
          <TableCheckbox checked={progress.limitBreak} aria-label={`${character.name}の限界突破状態`} onChange={handleLimitBreakChange} />
        </label>
      </td>
      <td className={tableBodyCellClass}>
        <TableSelect value={progress.star} appearance={isStarAtMax ? "maxed" : "default"} onChange={handleStarChange}>
          {Array.from({ length: starMax }, (_, index) => index + 1).map((star) => (
            <option key={star} value={star}>
              {star}
            </option>
          ))}
        </TableSelect>
      </td>
      <td className={tableBodyCellClass}>
        <TableSelect
          value={progress.connectRank}
          appearance={isConnectRankAtMax ? "maxed" : "default"}
          onChange={handleConnectRankChange}
        >
          {Array.from({ length: 15 }, (_, index) => index + 1).map((rank) => (
            <option key={rank} value={rank}>
              {rank}
            </option>
          ))}
        </TableSelect>
      </td>
      <td className={tableBodyCellClass}>
        {character.implemented.ue1 ? (
          <TableSelect value={ue1CompositeValue} appearance={isUe1AtMax ? "maxed" : "default"} onChange={handleUe1Change}>
            {UE1_LEVEL_VALUES.map((level) => (
              <option key={level} value={level}>
                {formatUeLevel(level)}
              </option>
            ))}
            {character.implemented.ue1Sp ? <option value="sp">SP</option> : null}
          </TableSelect>
        ) : (
          <TableSelect value="null" appearance="disabled" disabled>
            <option value="null">-</option>
          </TableSelect>
        )}
      </td>
      <td className={tableBodyCellClass}>
        {character.implemented.ue2 ? (
          <TableSelect value={ue2Value} appearance={isUe2AtMax ? "maxed" : "default"} onChange={handleUe2Change}>
            {UE2_LEVEL_VALUES.map((level) => (
              <option key={level} value={level}>
                {formatUeLevel(level)}
              </option>
            ))}
          </TableSelect>
        ) : (
          <TableSelect value="null" appearance="disabled" disabled>
            <option value="null">-</option>
          </TableSelect>
        )}
      </td>
      <td className={tableBodyCellClass}>
        <TableNumberInput
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={progress.ownedMemoryPiece}
          aria-label={`${character.name}の所持メモピ数`}
          onChange={handleOwnedMemoryPieceChange}
        />
      </td>
      <td className={tableBodyCellClass}>
        <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{starRemainingMemoryPiece}</span>
      </td>
      <td className={tableBodyCellClass}>
        <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{connectRankRemainingMemoryPiece}</span>
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
      <td className={tableBodyCellClass}>
        <span className="inline-block min-w-14 text-right text-sm font-bold tabular-nums">{ue1RemainingHeartFragment}</span>
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
  ue1HeartFragmentCalcMode,
}: InputProgressTableProps) {
  return (
    <div className={tableWrapClass}>
      <table className={tableClass}>
        <colgroup>
          <col className="w-20" />
          <col className="w-[200px]" />
          <col className="w-[95px]" />
          <col className="w-[130px]" />
          <col className="w-[130px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[140px]" />
          <col className="w-[120px]" />
          <col className="w-[155px]" />
          <col className="w-[130px]" />
          <col className="w-[145px]" />
          <col className="w-[120px]" />
          <col className="w-[260px]" />
          <col className="w-[170px]" />
        </colgroup>
        <thead>
          <tr>
            <th aria-sort={getAriaSort("owned", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("owned")}>
                所持
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("owned", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("name", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("name")}>
                キャラ
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("name", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("limitBreak", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("limitBreak")}>
                限界突破
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("limitBreak", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("star", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("star")}>
                ☆
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("star", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("connectRank", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button
                type="button"
                className={`${sortButtonClass} relative w-full justify-center`}
                onClick={() => onSort("connectRank")}
              >
                コネクトRANK
                <span className={`${sortIndicatorClass} absolute right-0`}>
                  {renderSortIndicator("connectRank", sortKey, sortDirection)}
                </span>
              </button>
            </th>
            <th aria-sort={getAriaSort("ue1", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("ue1")}>
                専用1
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("ue1", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("ue2", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("ue2")}>
                専用2
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("ue2", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("ownedMemoryPiece", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("ownedMemoryPiece")}>
                所持メモピ
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("ownedMemoryPiece", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("starMemoryNeeded", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("starMemoryNeeded")}>
                ☆必要メモピ
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("starMemoryNeeded", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("connectRankMemoryNeeded", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button
                type="button"
                className={`${sortButtonClass} relative w-full justify-center`}
                onClick={() => onSort("connectRankMemoryNeeded")}
              >
                コネクトRANK必要メモピ
                <span className={`${sortIndicatorClass} absolute right-0`}>
                  {renderSortIndicator("connectRankMemoryNeeded", sortKey, sortDirection)}
                </span>
              </button>
            </th>
            <th aria-sort={getAriaSort("ue1MemoryNeeded", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("ue1MemoryNeeded")}>
                専用1必要メモピ
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("ue1MemoryNeeded", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th aria-sort={getAriaSort("limitBreakMemoryNeeded", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("limitBreakMemoryNeeded")}>
                限界突破必要メモピ
                <span className={`${sortIndicatorClass} absolute right-0`}>
                  {renderSortIndicator("limitBreakMemoryNeeded", sortKey, sortDirection)}
                </span>
              </button>
            </th>
            <th aria-sort={getAriaSort("totalMemoryNeeded", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button type="button" className={`${sortButtonClass} relative w-full justify-center`} onClick={() => onSort("totalMemoryNeeded")}>
                必要メモピ合計
                <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator("totalMemoryNeeded", sortKey, sortDirection)}</span>
              </button>
            </th>
            <th className={`${tableHeadCellClass} text-center`}>メモピ入手</th>
            <th aria-sort={getAriaSort("ue1HeartFragmentNeeded", sortKey, sortDirection)} className={`${tableHeadCellClass} text-center`}>
              <button
                type="button"
                className={`${sortButtonClass} relative w-full justify-center`}
                onClick={() => onSort("ue1HeartFragmentNeeded")}
              >
                専用1必要ハートの欠片
                <span className={`${sortIndicatorClass} absolute right-0`}>
                  {renderSortIndicator("ue1HeartFragmentNeeded", sortKey, sortDirection)}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={15} className="px-3 py-[18px] text-center text-muted">
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
                ue1HeartFragmentCalcMode={ue1HeartFragmentCalcMode}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});
