import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import type { StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { cn } from "../../lib/utils";
import { attributeTextClassMap, roleTextClassMap } from "./constants";
import { InputCharacterEditSheet } from "./InputCharacterEditSheet";
import { computeRowDerived } from "./rowDerived";
import type { ProgressPatch, SaveStatus, VisibleRow } from "./types";
import { TableCheckbox } from "../ui/table-checkbox";

// モバイル一覧行の物理固定高（px）。ListRow の h-20 クラスと必ず一致させること（変更時は両方を更新する）。
const LIST_ROW_HEIGHT_PX = 80;

type InputProgressListProps = {
  visibleRows: VisibleRow[];
  purePieceByCharacterName: Record<string, number>;
  purePieceByBaseNameFromCharacters: Record<string, number>;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onUpdatePurePiece: (name: string, value: number) => void;
  includeSameBasePurePieceForUe2: boolean;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  /** 編集シートに表示する保存ステータス。省略時は「保存済み」扱い。 */
  saveStatus?: SaveStatus;
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

// モバイル一覧の1行。80px の物理固定高に収め、行タップで編集シートを開く。
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
  // サマリー表示用に育成状態の派生値を計算する（テーブル行と同一ロジック）。
  const { isStarAtMax, isConnectRankAtMax, isUe1AtMax, isUe2AtMax, ue1CompositeValue, ue2Value } = computeRowDerived(
    character,
    progress,
    ownedPurePiece,
    ownedPurePieceByBase,
    {
      includeSameBasePurePieceForUe2,
      starMemoryCalcMode,
      ue1MemoryCalcMode,
    },
  );
  // 専用装備の表示値。未実装は "-"、SP装備中は "SP"、それ以外はレベル数値をそのまま表示する。
  const ue1Display = ue1CompositeValue === "null" ? "-" : ue1CompositeValue === "sp" ? "SP" : ue1CompositeValue;
  const ue2Display = ue2Value === "null" ? "-" : ue2Value;

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
        // h-20（=LIST_ROW_HEIGHT_PX の 80px）の物理固定高 + overflow-hidden で、
        // 仮想化の estimateSize と実 DOM 高のズレを構造的に防ぐ（変更時は定数と両方を更新する）。
        "flex h-20 items-center gap-1 overflow-hidden border-b border-table-border px-2",
        isEven ? "bg-row-even" : "bg-row-odd",
      )}
    >
      {/* min-w-11(44px)でタップ領域を確保し、縦罫線で「左=チェック / 右=行タップ」の境界を可視化する。 */}
      <label
        className="flex h-full min-w-11 shrink-0 items-center justify-center border-r border-white/10"
        onClick={stopPropagation}
      >
        {/* size-6 で 24px に拡大（twMerge で TableCheckbox 既定の h-4 w-4 を上書き。Check アイコンも size-4 へ追従）。 */}
        <TableCheckbox
          className="size-6 [&_svg]:size-4"
          checked={progress.owned}
          aria-label={`${character.name}の所持状態`}
          onCheckedChange={handleOwnedChange}
        />
      </label>
      <button
        type="button"
        aria-label={`${character.name}の編集シートを開く`}
        onClick={handleOpen}
        className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {/* 左ブロックはタグ / 名前 / サマリーの3段スタック。 */}
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="truncate text-[0.72rem] font-semibold leading-none">
            <span className={character.limited ? "text-limited-text" : "text-normal-text"}>{character.limited ? "限定" : "恒常"}</span>
            <span className="text-tag-separator"> / </span>
            <span className={attributeTextClassMap[character.attribute]}>{character.attribute}</span>
            <span className="text-tag-separator"> / </span>
            <span className={roleTextClassMap[character.role]}>{character.role}</span>
          </span>
          <span className="block max-w-full truncate font-bold">{character.name}</span>
          {/* サマリー行。育成状態4項目を横並びで表示し、実装段階の最大まで強化済みの項目は緑系の色で示す。 */}
          <span className="flex min-w-0 items-center gap-2 truncate text-xs whitespace-nowrap tabular-nums leading-none">
            <span className={isStarAtMax ? "text-maxed-green" : "text-muted"}>☆{progress.star}</span>
            <span className={isConnectRankAtMax ? "text-maxed-green" : "text-muted"}>CR{progress.connectRank}</span>
            <span className={isUe1AtMax ? "text-maxed-green" : "text-muted"}>専用1: {ue1Display}</span>
            <span className={isUe2AtMax ? "text-maxed-green" : "text-muted"}>専用2: {ue2Display}</span>
          </span>
        </span>
        {/* 行タップのアフォーダンスとして右端に縦センターでシェブロンを置く。 */}
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
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
  saveStatus = "saved",
}: InputProgressListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  // 選択キャラは name で保持し、レンダリング毎に visibleRows から最新 row を引く
  // （progress オブジェクトは編集の度に再生成されるため、参照保持だと古い値を表示してしまう）。
  const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null);
  // ページ先頭から一覧先頭までのオフセット。ref 直参照は再レンダーを起こさず、
  // ヘッダー高の変化・sticky バーの変化・タブ再表示（forceMount の display:none 解除）・回転に
  // 追従できないため、state で管理して変化を仮想化計算へ確実に反映する。
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowVirtualizer = useWindowVirtualizer({
    count: visibleRows.length,
    // 行は物理固定高のため推定値=実高。ListRow の h-20 と一致させる（LIST_ROW_HEIGHT_PX の定義コメント参照）。
    estimateSize: () => LIST_ROW_HEIGHT_PX,
    overscan: 8,
    scrollMargin,
  });

  useLayoutEffect(() => {
    const listElement = listRef.current;
    if (!listElement) {
      return;
    }
    // 一覧先頭のページ内オフセットを再計測し、変化があれば state を更新する（同値なら再レンダーなし）。
    const measureScrollMargin = () => {
      setScrollMargin(listElement.getBoundingClientRect().top + window.scrollY);
    };
    measureScrollMargin();
    // 画面回転やビューポート変化で一覧の開始位置がずれた場合に追従する。
    window.addEventListener("resize", measureScrollMargin);
    // 一覧自身と body を監視し、上部要素（ヘッダー・詳細設定など）の高さ変化やタブ再表示に追従する。
    // jsdom には ResizeObserver が無いため存在チェックを挟む（テストでは初回計測のみで足りる）。
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measureScrollMargin);
      resizeObserver.observe(listElement);
      resizeObserver.observe(document.body);
    }
    return () => {
      window.removeEventListener("resize", measureScrollMargin);
      resizeObserver?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    // scrollMargin の変化時は仮想化の位置計算を再実行し、行の重なり・空白を防ぐ。
    rowVirtualizer.measure();
  }, [scrollMargin, rowVirtualizer]);
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
      {/* 自然高で window スクロールに一本化する（内部スクローラーは持たない）。
          overflow-hidden はスクロールを生まず、角丸からの行のはみ出しを防ぐ描画クリップのみ。 */}
      <div
        ref={listRef}
        className="overflow-hidden rounded-[8px] border border-table-wrap-border bg-table-wrap-bg"
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
                    ? {
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        // start はページ先頭基準のため、一覧コンテナ基準へ scrollMargin 分を差し引いて配置する。
                        transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                      }
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
        saveStatus={saveStatus}
      />
    </>
  );
});
