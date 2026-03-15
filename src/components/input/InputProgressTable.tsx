import { useVirtualizer } from "@tanstack/react-virtual";
import * as Popover from "@radix-ui/react-popover";
import { format, isValid, parseISO } from "date-fns";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
import { toGachaPullCount, toPurePieceCount } from "../../domain/storage";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { SortDirection, SortKey } from "../../domain/uiStorage";
import { getConnectRankRemainingMemoryPieceCount } from "../../utils/connectRankMemoryCost";
import { getConnectRankRemainingMaterialCost } from "../../utils/connectRankMaterialCost";
import { getLimitBreakRemainingMemoryPieceCount } from "../../utils/limitBreakMemoryCost";
import {
  getUe1RemainingHeartFragmentCountByMode,
  type Ue1HeartFragmentCalcMode,
} from "../../utils/ue1HeartFragmentCost";
import { getUe1RemainingMemoryPieceCount, type Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import { getStarRemainingMemoryPieceCount, type StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { attributeTextClassMap, memorySourceLabelMap, roleTextClassMap, sourceChipClassMap } from "./constants";
import { formatObtainedDate, formatUeLevel } from "./formatters";
import type { ProgressPatch, VisibleRow } from "./types";
import {
  characterNameCellLayoutClass,
  characterTagLineClass,
  sortButtonClass,
  sortIndicatorClass,
  tableSwitchClass,
  tableWrapClass,
} from "./uiStyles";
import { TableCheckbox } from "../ui/table-checkbox";
import { TableNumberInput } from "../ui/table-number-input";
import { SelectItem } from "../ui/select";
import { TableSelect } from "../ui/table-select";
import { Calendar } from "../ui/calendar";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as UiTableRow } from "../ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useClampedNumberInput } from "./useClampedNumberInput";

// 所持メモピのクランプ: 0 以上の整数（上限なし）。
const clampOwnedMemoryPiece = (v: number) => Math.max(0, Math.floor(v));
// toPurePieceCount は unknown を受け取るが、hook では number のみ渡すためラップする。
const clampPurePiece = (v: number) => toPurePieceCount(v);

type InputProgressTableProps = {
  visibleRows: VisibleRow[];
  purePieceByCharacterName: Record<string, number>;
  purePieceByBaseNameFromCharacters: Record<string, number>;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (sortKey: SortKey) => void;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onUpdatePurePiece: (name: string, value: number) => void;
  includeSameBasePurePieceForUe2: boolean;
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

// 保存用の日付文字列をDateへ変換し、不正値なら undefined を返す。
function parseStoredDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

// Date型を保存用の YYYY-MM-DD 文字列へ変換する。
function toStoredDateString(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

type SortHeaderButtonProps = {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (sortKey: SortKey) => void;
};

// テーブルヘッダーのソートボタンを統一表示する。
function SortHeaderButton({ label, columnKey, sortKey, sortDirection, onSort }: SortHeaderButtonProps) {
  return (
    <Button variant="ghost" className={`${sortButtonClass} relative w-full justify-center rounded-none px-0 py-0`} onClick={() => onSort(columnKey)}>
      {label}
      <span className={`${sortIndicatorClass} absolute right-0`}>{renderSortIndicator(columnKey, sortKey, sortDirection)}</span>
    </Button>
  );
}

type TableRowProps = {
  character: MasterCharacter;
  progress: CharacterProgress;
  ownedPurePiece: number;
  ownedPurePieceByBase: number;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onUpdatePurePiece: (name: string, value: number) => void;
  includeSameBasePurePieceForUe2: boolean;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  ue1HeartFragmentCalcMode: Ue1HeartFragmentCalcMode;
};

// テーブル行コンポーネント。行単位でメモ化し不要な再レンダリングを防ぐ。
const TableRow = memo(function TableRow({
  character,
  progress,
  ownedPurePiece,
  ownedPurePieceByBase,
  onUpdateProgress,
  onUpdatePurePiece,
  includeSameBasePurePieceForUe2,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
  ue1HeartFragmentCalcMode,
}: TableRowProps) {
  const ue1Value = character.implemented.ue1 ? String(progress.ue1Level ?? 0) : "null";
  const ue2Value = character.implemented.ue2 ? String(progress.ue2Level ?? 0) : "null";
  const isPurePieceImplemented = character.implemented.star6 || character.implemented.ue2;
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
  const connectRankRemainingMaterial = getConnectRankRemainingMaterialCost(character.role, progress.connectRank);
  const ue1RemainingHeartFragment = getUe1RemainingHeartFragmentCountByMode(character, progress, ue1HeartFragmentCalcMode);
  const limitBreakRemainingMemoryPiece = getLimitBreakRemainingMemoryPieceCount(character, progress);
  const totalRemainingMemoryPiece =
    starRemainingMemoryPiece + connectRankRemainingMemoryPiece + ue1RemainingMemoryPiece + limitBreakRemainingMemoryPiece;
  const adjustedTotalRemainingMemoryPiece = Math.max(0, totalRemainingMemoryPiece - progress.ownedMemoryPiece);
  const star6PurePieceNeed = character.implemented.star6 && progress.star < 6 ? 50 : 0;
  const ue2PurePieceNeed = character.implemented.ue2 && progress.ue2Level !== ue2MaxLevel ? 150 : 0;
  const sameBasePurePieceUsed =
    includeSameBasePurePieceForUe2 && character.implemented.ue2 ? Math.max(0, ownedPurePieceByBase - ownedPurePiece) : 0;
  const star6PurePieceSubtotal = Math.max(0, star6PurePieceNeed - ownedPurePiece);
  const ue2PurePieceSubtotal = Math.max(0, ue2PurePieceNeed - (ownedPurePiece + sameBasePurePieceUsed));
  const totalPurePieceNeeded = star6PurePieceSubtotal + ue2PurePieceSubtotal;
  const commitOwnedMemoryPiece = useCallback(
    (v: number) => onUpdateProgress(character.name, { ownedMemoryPiece: v }),
    [onUpdateProgress, character.name],
  );
  const commitOwnedPurePiece = useCallback(
    (v: number) => onUpdatePurePiece(character.name, v),
    [onUpdatePurePiece, character.name],
  );
  const commitGachaPullCount = useCallback(
    (v: number) => onUpdateProgress(character.name, { gachaPullCount: v }),
    [onUpdateProgress, character.name],
  );
  const ownedMemoryPieceField = useClampedNumberInput(progress.ownedMemoryPiece, clampOwnedMemoryPiece, commitOwnedMemoryPiece);
  const ownedPurePieceField = useClampedNumberInput(ownedPurePiece, clampPurePiece, commitOwnedPurePiece);
  const gachaPullCountField = useClampedNumberInput(progress.gachaPullCount, toGachaPullCount, commitGachaPullCount);

  const handleOwnedChange = useCallback(
    (checked: boolean | "indeterminate") => onUpdateProgress(character.name, { owned: checked === true }),
    [onUpdateProgress, character.name],
  );
  const handleLimitBreakChange = useCallback(
    (checked: boolean | "indeterminate") => onUpdateProgress(character.name, { limitBreak: checked === true }),
    [onUpdateProgress, character.name],
  );
  const handleStarChange = useCallback(
    (value: string) => onUpdateProgress(character.name, { star: Number(value) as CharacterProgress["star"] }),
    [onUpdateProgress, character.name],
  );
  const handleUe1Change = useCallback(
    (value: string) => {
      if (value === "sp") {
        onUpdateProgress(character.name, { ue1Level: 370, ue1SpEquipped: true });
        return;
      }
      const nextValue = (value === "null" ? null : Number(value)) as CharacterProgress["ue1Level"];
      onUpdateProgress(character.name, { ue1Level: nextValue, ue1SpEquipped: false });
    },
    [onUpdateProgress, character.name],
  );
  const handleConnectRankChange = useCallback(
    (value: string) => onUpdateProgress(character.name, { connectRank: Number(value) as CharacterProgress["connectRank"] }),
    [onUpdateProgress, character.name],
  );
  const handleUe2Change = useCallback(
    (value: string) => {
      const nextValue = (value === "null" ? null : Number(value)) as CharacterProgress["ue2Level"];
      onUpdateProgress(character.name, { ue2Level: nextValue });
    },
    [onUpdateProgress, character.name],
  );
  const selectedObtainedDate = useMemo(() => parseStoredDate(progress.obtainedDate), [progress.obtainedDate]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const handleObtainedDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value.trim();
      onUpdateProgress(character.name, { obtainedDate: nextValue ? nextValue : null });
    },
    [onUpdateProgress, character.name],
  );
  const handleObtainedDateSelect = useCallback(
    (value: Date | undefined) => {
      if (!value) {
        return;
      }
      onUpdateProgress(character.name, { obtainedDate: toStoredDateString(value) });
      setIsDatePickerOpen(false);
    },
    [onUpdateProgress, character.name],
  );
  const handleObtainedDateClear = useCallback(() => {
    onUpdateProgress(character.name, { obtainedDate: null });
  }, [onUpdateProgress, character.name]);

  return (
    <UiTableRow className="odd:[&>td]:bg-row-odd even:[&>td]:bg-row-even hover:[&>td]:bg-row-hover hover:[&>td]:border-row-hover-border">
      <TableCell className="sticky left-0 z-[4] text-center">
        <label className={`${tableSwitchClass} w-full justify-center`}>
          <TableCheckbox checked={progress.owned} aria-label={`${character.name}の所持状態`} onCheckedChange={handleOwnedChange} />
        </label>
      </TableCell>
      <TableCell className="sticky left-20 z-[4] border-r border-table-border whitespace-nowrap font-bold">
        <div className={characterNameCellLayoutClass}>
          <div className={characterTagLineClass}>
            <span className={character.limited ? "text-limited-text" : "text-normal-text"}>{character.limited ? "限定" : "恒常"}</span>
            <span className="text-tag-separator">/</span>
            <span className={attributeTextClassMap[character.attribute]}>{character.attribute}</span>
            <span className="text-tag-separator">/</span>
            <span className={roleTextClassMap[character.role]}>{character.role}</span>
          </div>
          <span className="block max-w-full truncate text-[1.05rem]">{character.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <label className={`${tableSwitchClass} w-full justify-center`}>
          <TableCheckbox checked={progress.limitBreak} aria-label={`${character.name}の限界突破状態`} onCheckedChange={handleLimitBreakChange} />
        </label>
      </TableCell>
      <TableCell>
        <TableSelect value={String(progress.star)} appearance={isStarAtMax ? "maxed" : "default"} onValueChange={handleStarChange}>
          {Array.from({ length: starMax }, (_, index) => index + 1).map((star) => (
            <SelectItem key={star} value={String(star)}>
              {star}
            </SelectItem>
          ))}
        </TableSelect>
      </TableCell>
      <TableCell>
        <TableSelect
          value={String(progress.connectRank)}
          appearance={isConnectRankAtMax ? "maxed" : "default"}
          onValueChange={handleConnectRankChange}
        >
          <SelectItem value="0">未開放</SelectItem>
          {Array.from({ length: 15 }, (_, index) => index + 1).map((rank) => (
            <SelectItem key={rank} value={String(rank)}>
              {rank}
            </SelectItem>
          ))}
        </TableSelect>
      </TableCell>
      <TableCell>
        {character.implemented.ue1 ? (
          <TableSelect value={ue1CompositeValue} appearance={isUe1AtMax ? "maxed" : "default"} onValueChange={handleUe1Change}>
            {UE1_LEVEL_VALUES.map((level) => (
              <SelectItem key={level} value={String(level)}>
                {formatUeLevel(level)}
              </SelectItem>
            ))}
            {character.implemented.ue1Sp ? <SelectItem value="sp">SP</SelectItem> : null}
          </TableSelect>
        ) : (
          <TableSelect value="null" appearance="disabled" disabled>
            <SelectItem value="null">-</SelectItem>
          </TableSelect>
        )}
      </TableCell>
      <TableCell>
        {character.implemented.ue2 ? (
          <TableSelect value={ue2Value} appearance={isUe2AtMax ? "maxed" : "default"} onValueChange={handleUe2Change}>
            {UE2_LEVEL_VALUES.map((level) => (
              <SelectItem key={level} value={String(level)}>
                {formatUeLevel(level)}
              </SelectItem>
            ))}
          </TableSelect>
        ) : (
          <TableSelect value="null" appearance="disabled" disabled>
            <SelectItem value="null">-</SelectItem>
          </TableSelect>
        )}
      </TableCell>
      <TableCell className="border-r border-table-border">
        <TableNumberInput
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={ownedMemoryPieceField.value}
          aria-label={`${character.name}の所持メモピ数`}
          onChange={ownedMemoryPieceField.onChange}
          onBlur={ownedMemoryPieceField.onBlur}
          onKeyDown={ownedMemoryPieceField.onKeyDown}
        />
      </TableCell>
      <TableCell>
        {isPurePieceImplemented ? (
          <TableNumberInput
            type="number"
            inputMode="numeric"
            min={0}
            max={99999}
            step={1}
            value={ownedPurePieceField.value}
            aria-label={`${character.name}の所持ピュアピ数`}
            onChange={ownedPurePieceField.onChange}
            onBlur={ownedPurePieceField.onBlur}
            onKeyDown={ownedPurePieceField.onKeyDown}
          />
        ) : (
          <TableNumberInput
            type="text"
            value="-"
            disabled
            aria-label={`${character.name}の所持ピュアピ数（未実装）`}
            className="text-left text-muted"
          />
        )}
      </TableCell>
      <TableCell className="text-center">
        <Popover.Root open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={`${character.name}の入手日セル`}
              className="inline-flex w-full items-center justify-between rounded-[10px] border border-white/20 bg-input-bg px-2.5 py-2 text-sm font-bold hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <span className="tabular-nums">{formatObtainedDate(progress.obtainedDate)}</span>
              <span className="inline-flex items-center text-muted">
                <CalendarIcon className="size-4" />
              </span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="center"
              className="z-50 rounded-[12px] border border-white/20 bg-popover-bg p-2 shadow-panel"
            >
              <Calendar mode="single" selected={selectedObtainedDate} onSelect={handleObtainedDateSelect} />
              <div className="mt-1.5 flex justify-end">
                <Button variant="ghost" size="sm" aria-label={`${character.name}の入手日クリア`} onClick={handleObtainedDateClear}>
                  クリア
                </Button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <input
          type="date"
          value={progress.obtainedDate ?? ""}
          aria-label={`${character.name}の入手日`}
          className="sr-only"
          onChange={handleObtainedDateChange}
        />
      </TableCell>
      <TableCell className="border-r border-table-border">
        <TableNumberInput
          type="number"
          inputMode="numeric"
          min={0}
          max={300}
          step={1}
          value={gachaPullCountField.value}
          aria-label={`${character.name}のガチャ回数`}
          onChange={gachaPullCountField.onChange}
          onBlur={gachaPullCountField.onBlur}
          onKeyDown={gachaPullCountField.onKeyDown}
        />
      </TableCell>
      <TableCell>
        <span className="inline-grid w-full grid-cols-[3ch_auto_3ch_auto_3ch] place-content-center items-center gap-x-1 text-center text-sm font-bold tabular-nums whitespace-nowrap">
          <span className="text-center">{connectRankRemainingMaterial.arts}</span>
          <span className="text-center">/</span>
          <span className="text-center">{connectRankRemainingMaterial.soul}</span>
          <span className="text-center">/</span>
          <span className="text-center">{connectRankRemainingMaterial.guard}</span>
        </span>
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block w-full cursor-help text-center text-sm font-bold tabular-nums">
                {adjustedTotalRemainingMemoryPiece}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="grid min-w-[220px] gap-1.5 text-left">
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[9em]">☆</span>
                <span className="tabular-nums">+{starRemainingMemoryPiece}</span>
              </span>
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[9em]">コネクトRANK</span>
                <span className="tabular-nums">+{connectRankRemainingMemoryPiece}</span>
              </span>
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[9em]">専用1</span>
                <span className="tabular-nums">+{ue1RemainingMemoryPiece}</span>
              </span>
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[9em]">限界突破</span>
                <span className="tabular-nums">+{limitBreakRemainingMemoryPiece}</span>
              </span>
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[9em]">所持数</span>
                <span className="tabular-nums">-{progress.ownedMemoryPiece}</span>
              </span>
              <div className="mt-1 h-px bg-white/20" />
              <span className="inline-flex items-baseline gap-2 font-bold">
                <span className="inline-block w-[9em]">合計</span>
                <span className="tabular-nums">{adjustedTotalRemainingMemoryPiece}</span>
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block w-full cursor-help text-center text-sm font-bold tabular-nums">{totalPurePieceNeeded}</span>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="grid min-w-[260px] gap-1.5 text-left">
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[12em]">☆6</span>
                <span className="tabular-nums">+{star6PurePieceNeed}</span>
              </span>
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[12em]">所持数</span>
                <span className="tabular-nums">-{ownedPurePiece}</span>
              </span>
              <div className="mt-1 h-px bg-white/20" />
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[12em]">小計</span>
                <span className="tabular-nums">+{star6PurePieceSubtotal}</span>
              </span>
              <div className="h-2" />
              <div className="h-px bg-white/20" />
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[12em]">専用2</span>
                <span className="tabular-nums">+{ue2PurePieceNeed}</span>
              </span>
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[12em]">所持数</span>
                <span />
              </span>
              <span className="inline-flex items-baseline gap-2">
                <span className="inline-block w-[12em]">・{character.name}</span>
                <span className="tabular-nums">-{ownedPurePiece}</span>
              </span>
              {includeSameBasePurePieceForUe2 && character.implemented.ue2 ? (
                <span className="inline-flex items-baseline gap-2">
                  <span className="inline-block w-[12em]">・同名別衣装</span>
                  <span className="tabular-nums">-{sameBasePurePieceUsed}</span>
                </span>
              ) : null}
              <div className="h-px bg-white/20" />
              <span className="inline-flex items-baseline gap-2 font-bold">
                <span className="inline-block w-[12em]">小計</span>
                <span className="tabular-nums">+{ue2PurePieceSubtotal}</span>
              </span>
              <div className="h-2" />
              <div className="h-px bg-white/20" />
              <span className="inline-flex items-baseline gap-2 font-bold">
                <span className="inline-block w-[12em]">合計</span>
                <span className="tabular-nums">+{totalPurePieceNeeded}</span>
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          {character.memoryPieceSources.length === 0 ? (
            <Badge variant="muted">情報なし</Badge>
          ) : (
            character.memoryPieceSources.map((source) => (
              <Badge key={source} className={sourceChipClassMap[source]}>
                {memorySourceLabelMap[source]}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-block w-full text-center text-sm font-bold tabular-nums">{ue1RemainingHeartFragment}</span>
      </TableCell>
    </UiTableRow>
  );
});

// 育成入力テーブル本体を表示し、各行の進捗編集を受け付ける。
export const InputProgressTable = memo(function InputProgressTable({
  visibleRows,
  purePieceByCharacterName,
  purePieceByBaseNameFromCharacters,
  sortKey,
  sortDirection,
  onSort,
  onUpdateProgress,
  onUpdatePurePiece,
  includeSameBasePurePieceForUe2,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
  ue1HeartFragmentCalcMode,
}: InputProgressTableProps) {
  const shadowLayerRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const stickyNameHeadRef = useRef<HTMLTableCellElement | null>(null);
  const initialScrollLeftRef = useRef<number | null>(null);
  const [hasStickyShadow, setHasStickyShadow] = useState(false);
  const [stickyShadowLeft, setStickyShadowLeft] = useState(280);
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? Math.max(0, rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0))
      : 0;
  const visibleVirtualRows = useMemo(() => {
    const resolvedRows = virtualRows
      .map((virtualRow) => {
        const row = visibleRows[virtualRow.index];
        if (!row) {
          return null;
        }
        return { virtualRow, row };
      })
      .filter((item): item is { virtualRow: (typeof virtualRows)[number]; row: VisibleRow } => item !== null);

    // スクロール領域の計測が未確定な瞬間でも、最低限の行を表示して操作不能を避ける。
    if (resolvedRows.length === 0 && visibleRows.length > 0) {
      const firstRow = visibleRows[0];
      if (!firstRow) {
        return resolvedRows;
      }
      return [{ virtualRow: null, row: firstRow }];
    }
    return resolvedRows;
  }, [virtualRows, visibleRows]);

  useEffect(() => {
    const scrollElement = scrollParentRef.current;
    if (!scrollElement) {
      return;
    }

    // 横スクロール位置に応じて固定列の影表示を切り替える。
    const handleScroll = () => {
      const baseline = initialScrollLeftRef.current ?? 0;
      setHasStickyShadow(scrollElement.scrollLeft > baseline + 2);
    };

    initialScrollLeftRef.current = scrollElement.scrollLeft;
    handleScroll();
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const shadowLayerElement = shadowLayerRef.current;
    const stickyNameHeadElement = stickyNameHeadRef.current;
    if (!shadowLayerElement || !stickyNameHeadElement) {
      return;
    }

    // 固定列境界を実測し、ガターや境界線分を含めて影のx座標を合わせる。
    const updateShadowLeft = () => {
      const layerRect = shadowLayerElement.getBoundingClientRect();
      const stickyRect = stickyNameHeadElement.getBoundingClientRect();
      setStickyShadowLeft(stickyRect.right - layerRect.left);
    };

    updateShadowLeft();
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateShadowLeft();
          })
        : null;
    resizeObserver?.observe(shadowLayerElement);
    resizeObserver?.observe(stickyNameHeadElement);
    window.addEventListener("resize", updateShadowLeft);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateShadowLeft);
    };
  }, [visibleRows.length]);

  return (
    <div ref={shadowLayerRef} className="relative">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 z-[8] w-4 bg-linear-to-r from-black/40 to-transparent ${
          hasStickyShadow ? "opacity-100" : "opacity-0"
        }`}
        style={{ left: stickyShadowLeft }}
      />
      <div ref={scrollParentRef} className={tableWrapClass}>
        <Table className="table-fixed">
        <colgroup>
          <col className="w-20" />
          <col className="w-[200px]" />
          <col className="w-[95px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[170px]" />
          <col className="w-[150px]" />
          <col className="w-[160px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[170px]" />
        </colgroup>
        <TableHeader>
          <UiTableRow>
            <TableHead aria-sort={getAriaSort("owned", sortKey, sortDirection)} className="sticky left-0 z-[6] bg-table-header-bg text-center">
              <SortHeaderButton label="所持" columnKey="owned" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead
              ref={stickyNameHeadRef}
              aria-sort={getAriaSort("name", sortKey, sortDirection)}
              className="sticky left-20 z-[6] border-r border-table-border bg-table-header-bg text-center"
            >
              <SortHeaderButton label="キャラ" columnKey="name" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead aria-sort={getAriaSort("limitBreak", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton
                label="限界突破"
                columnKey="limitBreak"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            </TableHead>
            <TableHead aria-sort={getAriaSort("star", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton label="☆" columnKey="star" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead aria-sort={getAriaSort("connectRank", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton
                label="コネクトRANK"
                columnKey="connectRank"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            </TableHead>
            <TableHead aria-sort={getAriaSort("ue1", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton label="専用1" columnKey="ue1" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead aria-sort={getAriaSort("ue2", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton label="専用2" columnKey="ue2" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead aria-sort={getAriaSort("ownedMemoryPiece", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton
                label="所持メモピ"
                columnKey="ownedMemoryPiece"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            </TableHead>
            <TableHead className="text-center">
              所持ピュアピ
            </TableHead>
            <TableHead aria-sort={getAriaSort("obtainedDate", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton label="入手日" columnKey="obtainedDate" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead
              aria-sort={getAriaSort("gachaPullCount", sortKey, sortDirection)}
              className="border-r border-table-border text-center"
            >
              <SortHeaderButton
                label="ガチャ回数"
                columnKey="gachaPullCount"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            </TableHead>
            <TableHead className="text-center">
              コネクトRANK必要素材
              <br />
              （アーツ/ソウル/ガード）
            </TableHead>
            <TableHead aria-sort={getAriaSort("totalMemoryNeeded", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton
                label="必要メモピ合計"
                columnKey="totalMemoryNeeded"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            </TableHead>
            <TableHead className="text-center">必要ピュアピ合計</TableHead>
            <TableHead className="text-center">メモピ入手</TableHead>
            <TableHead aria-sort={getAriaSort("ue1HeartFragmentNeeded", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton
                label="専用1必要ハートの欠片"
                columnKey="ue1HeartFragmentNeeded"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            </TableHead>
          </UiTableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length === 0 ? (
            <UiTableRow>
              <TableCell colSpan={16} className="px-3 py-[18px] text-center text-muted">
                条件に一致するキャラがいません
              </TableCell>
            </UiTableRow>
          ) : (
            <>
              {virtualRows.length > 0 && paddingTop > 0 ? (
                <UiTableRow aria-hidden="true">
                  <TableCell colSpan={16} className="h-0 border-0 p-0" style={{ height: `${paddingTop}px` }} />
                </UiTableRow>
              ) : null}
              {visibleVirtualRows.map(({ virtualRow, row }) => (
                <TableRow
                  key={row.character.name}
                  character={row.character}
                  progress={row.progress}
                  ownedPurePiece={purePieceByCharacterName[row.character.name] ?? 0}
                  ownedPurePieceByBase={purePieceByBaseNameFromCharacters[row.character.baseName] ?? 0}
                  onUpdateProgress={onUpdateProgress}
                  onUpdatePurePiece={onUpdatePurePiece}
                  includeSameBasePurePieceForUe2={includeSameBasePurePieceForUe2}
                  starMemoryCalcMode={starMemoryCalcMode}
                  ue1MemoryCalcMode={ue1MemoryCalcMode}
                  ue1HeartFragmentCalcMode={ue1HeartFragmentCalcMode}
                />
              ))}
              {virtualRows.length > 0 && paddingBottom > 0 ? (
                <UiTableRow aria-hidden="true">
                  <TableCell colSpan={16} className="h-0 border-0 p-0" style={{ height: `${paddingBottom}px` }} />
                </UiTableRow>
              ) : null}
            </>
          )}
        </TableBody>
        </Table>
      </div>
    </div>
  );
});
