import { useVirtualizer } from "@tanstack/react-virtual";
import * as Popover from "@radix-ui/react-popover";
import { format, isValid, parseISO } from "date-fns";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
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
  const connectRankRemainingMaterial = getConnectRankRemainingMaterialCost(character.role, progress.connectRank);
  const ue1RemainingHeartFragment = getUe1RemainingHeartFragmentCountByMode(character, progress, ue1HeartFragmentCalcMode);
  const limitBreakRemainingMemoryPiece = getLimitBreakRemainingMemoryPieceCount(character, progress);
  const totalRemainingMemoryPiece =
    starRemainingMemoryPiece + connectRankRemainingMemoryPiece + ue1RemainingMemoryPiece + limitBreakRemainingMemoryPiece;
  const adjustedTotalRemainingMemoryPiece = Math.max(0, totalRemainingMemoryPiece - progress.ownedMemoryPiece);

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
  const handleOwnedMemoryPieceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextOwnedMemoryPiece = Math.max(0, Math.floor(Number(event.target.value) || 0));
      onUpdateProgress(character.name, { ownedMemoryPiece: nextOwnedMemoryPiece });
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
  const handleGachaPullCountChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextGachaPullCount = Math.min(300, Math.max(0, Math.floor(Number(event.target.value) || 0)));
      onUpdateProgress(character.name, { gachaPullCount: nextGachaPullCount });
    },
    [onUpdateProgress, character.name],
  );

  return (
    <UiTableRow className="odd:bg-row-odd even:bg-row-even hover:bg-row-hover">
      <TableCell className="text-center">
        <label className={`${tableSwitchClass} w-full justify-center`}>
          <TableCheckbox checked={progress.owned} aria-label={`${character.name}の所持状態`} onCheckedChange={handleOwnedChange} />
        </label>
      </TableCell>
      <TableCell className="whitespace-nowrap font-bold">
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
      <TableCell>
        <TableNumberInput
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={progress.ownedMemoryPiece}
          aria-label={`${character.name}の所持メモピ数`}
          onChange={handleOwnedMemoryPieceChange}
        />
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
              <span className="inline-flex items-center gap-1.5 text-muted">
                <CalendarIcon className="size-4" />
                <ChevronDown className="size-4" />
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
      <TableCell>
        <TableNumberInput
          type="number"
          inputMode="numeric"
          min={0}
          max={300}
          step={1}
          value={progress.gachaPullCount}
          aria-label={`${character.name}のガチャ回数`}
          onChange={handleGachaPullCountChange}
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
              <div className="h-px bg-white/20" />
              <span className="inline-flex items-baseline gap-2 font-bold">
                <span className="inline-block w-[9em]">合計</span>
                <span className="tabular-nums">{adjustedTotalRemainingMemoryPiece}</span>
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
  sortKey,
  sortDirection,
  onSort,
  onUpdateProgress,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
  ue1HeartFragmentCalcMode,
}: InputProgressTableProps) {
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
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

  return (
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
          <col className="w-[170px]" />
          <col className="w-[150px]" />
          <col className="w-[160px]" />
          <col className="w-[150px]" />
          <col className="w-[150px]" />
          <col className="w-[170px]" />
        </colgroup>
        <TableHeader>
          <UiTableRow>
            <TableHead aria-sort={getAriaSort("owned", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton label="所持" columnKey="owned" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead aria-sort={getAriaSort("name", sortKey, sortDirection)} className="text-center">
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
            <TableHead aria-sort={getAriaSort("obtainedDate", sortKey, sortDirection)} className="text-center">
              <SortHeaderButton label="入手日" columnKey="obtainedDate" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            </TableHead>
            <TableHead aria-sort={getAriaSort("gachaPullCount", sortKey, sortDirection)} className="text-center">
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
              <TableCell colSpan={14} className="px-3 py-[18px] text-center text-muted">
                条件に一致するキャラがいません
              </TableCell>
            </UiTableRow>
          ) : (
            <>
              {virtualRows.length > 0 && paddingTop > 0 ? (
                <UiTableRow aria-hidden="true">
                  <TableCell colSpan={14} className="h-0 border-0 p-0" style={{ height: `${paddingTop}px` }} />
                </UiTableRow>
              ) : null}
              {visibleVirtualRows.map(({ virtualRow, row }) => (
                <TableRow
                  key={`${row.character.name}-${virtualRow?.index ?? "fallback"}`}
                  character={row.character}
                  progress={row.progress}
                  onUpdateProgress={onUpdateProgress}
                  starMemoryCalcMode={starMemoryCalcMode}
                  ue1MemoryCalcMode={ue1MemoryCalcMode}
                  ue1HeartFragmentCalcMode={ue1HeartFragmentCalcMode}
                />
              ))}
              {virtualRows.length > 0 && paddingBottom > 0 ? (
                <UiTableRow aria-hidden="true">
                  <TableCell colSpan={14} className="h-0 border-0 p-0" style={{ height: `${paddingBottom}px` }} />
                </UiTableRow>
              ) : null}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
});
