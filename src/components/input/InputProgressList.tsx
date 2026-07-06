import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import type { StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { cn } from "../../lib/utils";
import { attributeTextClassMap, roleTextClassMap } from "./constants";
import { InputCharacterEditSheet } from "./InputCharacterEditSheet";
import { computeRowDerived } from "./rowDerived";
import type { ProgressPatch, VisibleRow } from "./types";
import { TableCheckbox } from "../ui/table-checkbox";

type InputProgressListProps = {
  visibleRows: VisibleRow[];
  purePieceByCharacterName: Record<string, number>;
  purePieceByBaseNameFromCharacters: Record<string, number>;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onUpdatePurePiece: (name: string, value: number) => void;
  includeSameBasePurePieceForUe2: boolean;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
};

type ListRowProps = {
  character: MasterCharacter;
  progress: CharacterProgress;
  ownedPurePiece: number;
  ownedPurePieceByBase: number;
  includeSameBasePurePieceForUe2: boolean;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  /** 縞模様表示用。仮想化行の index 偶奇で背景色を切り替える */
  isEven: boolean;
  /** 仮想化の位置指定スタイル。計測未確定のフォールバック行では undefined */
  style?: CSSProperties;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onOpenEditSheet: (name: string) => void;
};

// モバイル一覧の1行。64px の物理固定高に収め、行タップで編集シートを開く。
const ListRow = memo(function ListRow({
  character,
  progress,
  ownedPurePiece,
  ownedPurePieceByBase,
  includeSameBasePurePieceForUe2,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
  isEven,
  style,
  onUpdateProgress,
  onOpenEditSheet,
}: ListRowProps) {
  // サマリー表示用に必要メモピ合計を計算する（テーブル行と同一ロジック）。
  const { adjustedTotalRemainingMemoryPiece } = computeRowDerived(character, progress, ownedPurePiece, ownedPurePieceByBase, {
    includeSameBasePurePieceForUe2,
    starMemoryCalcMode,
    ue1MemoryCalcMode,
  });

  const handleOwnedChange = useCallback(
    (checked: boolean | "indeterminate") => onUpdateProgress(character.name, { owned: checked === true }),
    [onUpdateProgress, character.name],
  );
  const handleOpen = useCallback(() => onOpenEditSheet(character.name), [onOpenEditSheet, character.name]);
  // 所持チェックのタップを行タップ（編集シートを開く操作）へ伝播させない。
  const stopPropagation = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <div
      style={style}
      className={cn(
        // h-16 の物理固定高 + overflow-hidden で、仮想化の estimateSize(64) と実 DOM 高のズレを構造的に防ぐ。
        "flex h-16 items-center gap-1 overflow-hidden border-b border-table-border px-2",
        isEven ? "bg-row-even" : "bg-row-odd",
      )}
    >
      <label className="flex h-full shrink-0 items-center px-1.5" onClick={stopPropagation}>
        <TableCheckbox checked={progress.owned} aria-label={`${character.name}の所持状態`} onCheckedChange={handleOwnedChange} />
      </label>
      <button
        type="button"
        aria-label={`${character.name}の編集シートを開く`}
        onClick={handleOpen}
        className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="grid min-w-0 gap-1">
          <span className="truncate text-[0.72rem] font-semibold leading-none">
            <span className={character.limited ? "text-limited-text" : "text-normal-text"}>{character.limited ? "限定" : "恒常"}</span>
            <span className="text-tag-separator"> / </span>
            <span className={attributeTextClassMap[character.attribute]}>{character.attribute}</span>
            <span className="text-tag-separator"> / </span>
            <span className={roleTextClassMap[character.role]}>{character.role}</span>
          </span>
          <span className="block max-w-full truncate font-bold">{character.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs tabular-nums text-muted">
          <span>☆{progress.star}</span>
          <span>RANK {progress.connectRank}</span>
          <span className="font-bold text-main">必要 {adjustedTotalRemainingMemoryPiece}</span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        </span>
      </button>
    </div>
  );
});

// 育成入力のモバイル一覧。仮想スクロールで行を表示し、行タップで編集シートを開く。
export const InputProgressList = memo(function InputProgressList({
  visibleRows,
  purePieceByCharacterName,
  purePieceByBaseNameFromCharacters,
  onUpdateProgress,
  onUpdatePurePiece,
  includeSameBasePurePieceForUe2,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
}: InputProgressListProps) {
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  // 選択キャラは name で保持し、レンダリング毎に visibleRows から最新 row を引く
  // （progress オブジェクトは編集の度に再生成されるため、参照保持だと古い値を表示してしまう）。
  const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
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

  // 選択中キャラの最新 row。フィルタ変更などで一覧から消えた場合は null となり、シートが閉じる。
  const selectedRow = useMemo(
    () =>
      selectedCharacterName === null
        ? null
        : (visibleRows.find((row) => row.character.name === selectedCharacterName) ?? null),
    [selectedCharacterName, visibleRows],
  );

  // 行タップで編集シートを開く。
  const handleOpenEditSheet = useCallback((name: string) => {
    setSelectedCharacterName(name);
  }, []);
  // シートが閉じられたら選択キャラを解除する。
  const handleSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedCharacterName(null);
    }
  }, []);

  return (
    <>
      {/* 70dvh: モバイルブラウザの動的ツールバーによる高さ変動へ追従する */}
      <div
        ref={scrollParentRef}
        className="h-[70dvh] overflow-y-auto overflow-x-hidden rounded-[8px] border border-table-wrap-border bg-table-wrap-bg"
      >
        {visibleRows.length === 0 ? (
          <p className="px-3 py-[18px] text-center text-sm text-muted">条件に一致するキャラがいません</p>
        ) : (
          <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {visibleVirtualRows.map(({ virtualRow, row }) => (
              <ListRow
                key={row.character.name}
                character={row.character}
                progress={row.progress}
                ownedPurePiece={purePieceByCharacterName[row.character.name] ?? 0}
                ownedPurePieceByBase={purePieceByBaseNameFromCharacters[row.character.baseName] ?? 0}
                includeSameBasePurePieceForUe2={includeSameBasePurePieceForUe2}
                starMemoryCalcMode={starMemoryCalcMode}
                ue1MemoryCalcMode={ue1MemoryCalcMode}
                isEven={(virtualRow?.index ?? 0) % 2 === 0}
                style={
                  virtualRow
                    ? { position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }
                    : undefined
                }
                onUpdateProgress={onUpdateProgress}
                onOpenEditSheet={handleOpenEditSheet}
              />
            ))}
          </div>
        )}
      </div>
      <InputCharacterEditSheet
        row={selectedRow}
        onOpenChange={handleSheetOpenChange}
        ownedPurePiece={selectedRow ? (purePieceByCharacterName[selectedRow.character.name] ?? 0) : 0}
        ownedPurePieceByBase={selectedRow ? (purePieceByBaseNameFromCharacters[selectedRow.character.baseName] ?? 0) : 0}
        onUpdateProgress={onUpdateProgress}
        onUpdatePurePiece={onUpdatePurePiece}
        includeSameBasePurePieceForUe2={includeSameBasePurePieceForUe2}
        starMemoryCalcMode={starMemoryCalcMode}
        ue1MemoryCalcMode={ue1MemoryCalcMode}
      />
    </>
  );
});
