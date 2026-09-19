import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import type { StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { memorySourceLabelMap, sourceChipClassMap } from "./constants";
import { AttributeIconLabel, RoleIconLabel } from "./SemanticIconLabel";
import {
  ConnectRankSelect,
  GachaPullCountInput,
  ObtainedDatePicker,
  OwnedMemoryPieceInput,
  OwnedPurePieceInput,
  StarSelect,
  Ue1Select,
  Ue2Select,
} from "./progressFields";
import { computeRowDerived } from "./rowDerived";
import type { ProgressPatch, VisibleRow } from "./types";
import {
  characterNameCellLayoutClass,
  characterTagLineClass,
  tableSwitchClass,
  tableWrapClass,
} from "./uiStyles";
import { TableCheckbox } from "../ui/table-checkbox";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as UiTableRow } from "../ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

type InputProgressTableProps = {
  visibleRows: VisibleRow[];
  purePieceByCharacterName: Record<string, number>;
  purePieceByBaseNameFromCharacters: Record<string, number>;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onUpdatePurePiece: (name: string, value: number) => void;
  includeSameBasePurePieceForUe2: boolean;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
};

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
};

// テーブル行コンポーネント。行単位でメモ化し不要な再レンダリングを防ぐ。
// キャラと進捗・更新通知を受け取り、セル全体で操作できる入力行を返す。
// 入力を絶対配置するため親セルの余白を除き、行高は仮想スクロールの推定値と揃える。
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
}: TableRowProps) {
  // 必要メモピ・ピュアピの内訳や最大強化判定などの派生値を一括計算する。
  const {
    isPurePieceImplemented,
    isStarAtMax,
    isConnectRankAtMax,
    isUe1AtMax,
    isUe2AtMax,
    ue1CompositeValue,
    ue2Value,
    starRemainingMemoryPiece,
    connectRankRemainingMemoryPiece,
    ue1RemainingMemoryPiece,
    limitBreakRemainingMemoryPiece,
    adjustedTotalRemainingMemoryPiece,
    star6PurePieceNeed,
    sameBasePurePieceUsed,
    star6PurePieceSubtotal,
    ue2PurePieceNeed,
    ue2PurePieceSubtotal,
    totalPurePieceNeeded,
  } = computeRowDerived(character, progress, ownedPurePiece, ownedPurePieceByBase, {
    includeSameBasePurePieceForUe2,
    starMemoryCalcMode,
    ue1MemoryCalcMode,
  });

  const handleOwnedChange = useCallback(
    (checked: boolean | "indeterminate") => onUpdateProgress(character.name, { owned: checked === true }),
    [onUpdateProgress, character.name],
  );
  const handleLimitBreakChange = useCallback(
    (checked: boolean | "indeterminate") => onUpdateProgress(character.name, { limitBreak: checked === true }),
    [onUpdateProgress, character.name],
  );
  const handleAdventureMemoryPieceTargetChange = useCallback(
    (checked: boolean | "indeterminate") => onUpdateProgress(character.name, { adventureMemoryPieceTarget: checked === true }),
    [onUpdateProgress, character.name],
  );

  return (
    <UiTableRow className="h-[72px] odd:[&>td]:bg-row-odd even:[&>td]:bg-row-even hover:[&>td]:bg-row-hover hover:[&>td]:border-row-hover-border">
      <TableCell className="sticky left-0 z-[4] p-0 text-center">
        <label className={`${tableSwitchClass} absolute inset-0 cursor-pointer justify-center`}>
          <TableCheckbox checked={progress.owned} aria-label={`${character.name}の所持状態`} onCheckedChange={handleOwnedChange} />
        </label>
      </TableCell>
      <TableCell className="sticky left-14 z-[4] border-r border-table-border whitespace-nowrap font-bold">
        <div className={characterNameCellLayoutClass}>
          <div className={characterTagLineClass}>
            <span className={character.limited ? "text-limited-text" : "text-normal-text"}>{character.limited ? "限定" : "恒常"}</span>
            <span className="text-tag-separator">/</span>
            <span className="inline-flex items-center gap-1.5">
              <AttributeIconLabel attribute={character.attribute} />
              <RoleIconLabel role={character.role} />
            </span>
          </div>
          <span className="block max-w-full truncate text-[1.05rem]">{character.name}</span>
        </div>
      </TableCell>
      <TableCell className="relative p-0 text-center">
        <label className={`${tableSwitchClass} absolute inset-0 cursor-pointer justify-center`}>
          <TableCheckbox checked={progress.limitBreak} aria-label={`${character.name}の限界突破状態`} onCheckedChange={handleLimitBreakChange} />
        </label>
      </TableCell>
      <TableCell className="relative p-0">
        <StarSelect character={character} star={progress.star} isAtMax={isStarAtMax} onUpdateProgress={onUpdateProgress} />
      </TableCell>
      <TableCell className="relative p-0">
        <ConnectRankSelect
          character={character}
          connectRank={progress.connectRank}
          isAtMax={isConnectRankAtMax}
          onUpdateProgress={onUpdateProgress}
        />
      </TableCell>
      <TableCell className="relative p-0">
        <Ue1Select character={character} value={ue1CompositeValue} isAtMax={isUe1AtMax} onUpdateProgress={onUpdateProgress} />
      </TableCell>
      <TableCell className="relative p-0">
        <Ue2Select character={character} value={ue2Value} isAtMax={isUe2AtMax} onUpdateProgress={onUpdateProgress} />
      </TableCell>
      <TableCell className="relative p-0 text-center">
        <label className={`${tableSwitchClass} absolute inset-0 cursor-pointer justify-center`}>
          <TableCheckbox
            checked={progress.adventureMemoryPieceTarget === true}
            aria-label={`${character.name}のアドベンチャーメモピ枠`}
            onCheckedChange={handleAdventureMemoryPieceTargetChange}
          />
        </label>
      </TableCell>
      <TableCell className="relative p-0">
        <OwnedMemoryPieceInput character={character} ownedMemoryPiece={progress.ownedMemoryPiece} onUpdateProgress={onUpdateProgress} />
      </TableCell>
      <TableCell className="relative p-0">
        <OwnedPurePieceInput
          character={character}
          ownedPurePiece={ownedPurePiece}
          isImplemented={isPurePieceImplemented}
          onUpdatePurePiece={onUpdatePurePiece}
        />
      </TableCell>
      <TableCell className="relative p-0 text-center">
        <ObtainedDatePicker character={character} obtainedDate={progress.obtainedDate} onUpdateProgress={onUpdateProgress} inlineEditing />
      </TableCell>
      <TableCell className="relative border-r border-table-border p-0">
        <GachaPullCountInput character={character} gachaPullCount={progress.gachaPullCount} onUpdateProgress={onUpdateProgress} />
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
    </UiTableRow>
  );
});

// 育成入力テーブル本体を表示し、各行の進捗編集を受け付ける。
export const InputProgressTable = memo(function InputProgressTable({
  visibleRows,
  purePieceByCharacterName,
  purePieceByBaseNameFromCharacters,
  onUpdateProgress,
  onUpdatePurePiece,
  includeSameBasePurePieceForUe2,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
}: InputProgressTableProps) {
  const shadowLayerRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const stickyNameHeadRef = useRef<HTMLTableCellElement | null>(null);
  const initialScrollLeftRef = useRef<number | null>(null);
  const [hasStickyShadow, setHasStickyShadow] = useState(false);
  const [stickyShadowLeft, setStickyShadowLeft] = useState(256);
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
        {/* 見出し・選択値が収まる列幅に絞り、固定列の位置も所持列の56pxに揃える。 */}
        <Table className="min-w-[1700px] table-fixed [&_th]:px-2">
        <colgroup>
          <col className="w-14" />
          <col className="w-[200px]" />
          <col className="w-[76px]" />
          <col className="w-16" />
          <col className="w-[112px]" />
          <col className="w-[104px]" />
          <col className="w-[104px]" />
          <col className="w-[112px]" />
          <col className="w-[104px]" />
          <col className="w-[112px]" />
          <col className="w-[132px]" />
          <col className="w-[100px]" />
          <col className="w-[128px]" />
          <col className="w-[140px]" />
          <col className="w-[156px]" />
        </colgroup>
        <TableHeader>
          <UiTableRow>
            <TableHead className="sticky left-0 z-[6] bg-table-header-bg text-center">
              所持
            </TableHead>
            <TableHead
              ref={stickyNameHeadRef}
              className="sticky left-14 z-[6] border-r border-table-border bg-table-header-bg text-center"
            >
              キャラ
            </TableHead>
            <TableHead className="text-center">限界突破</TableHead>
            <TableHead className="text-center">☆</TableHead>
            <TableHead className="text-center">コネクトRANK</TableHead>
            <TableHead className="text-center">専用1</TableHead>
            <TableHead className="text-center">専用2</TableHead>
            <TableHead className="text-center">アドベンチャー</TableHead>
            <TableHead className="text-center">所持メモピ</TableHead>
            <TableHead className="text-center">所持ピュアピ</TableHead>
            <TableHead className="text-center">入手日</TableHead>
            <TableHead className="border-r border-table-border text-center">ガチャ回数</TableHead>
            <TableHead className="text-center">必要メモピ合計</TableHead>
            <TableHead className="text-center">必要ピュアピ合計</TableHead>
            <TableHead className="text-center">メモピ入手</TableHead>
          </UiTableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length === 0 ? (
            <UiTableRow>
              <TableCell colSpan={15} className="px-3 py-[18px] text-center text-muted">
                条件に一致するキャラがいません
              </TableCell>
            </UiTableRow>
          ) : (
            <>
              {virtualRows.length > 0 && paddingTop > 0 ? (
                <UiTableRow aria-hidden="true">
                  <TableCell colSpan={15} className="h-0 border-0 p-0" style={{ height: `${paddingTop}px` }} />
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
                />
              ))}
              {virtualRows.length > 0 && paddingBottom > 0 ? (
                <UiTableRow aria-hidden="true">
                  <TableCell colSpan={15} className="h-0 border-0 p-0" style={{ height: `${paddingBottom}px` }} />
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
