import { memo, useCallback } from "react";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import type { StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { attributeTextClassMap, memorySourceLabelMap, roleTextClassMap, sourceChipClassMap } from "./constants";
import { ObtainedDatePicker } from "./progressFields";
import {
  ConnectRankStepper,
  GachaPullCountStepper,
  OwnedMemoryPieceStepper,
  OwnedPurePieceStepper,
  StarSegmentedControl,
  Ue1Stepper,
  Ue2Stepper,
} from "./mobileFields";
import { computeRowDerived } from "./rowDerived";
import type { ProgressPatch, VisibleRow } from "./types";
import { sectionLabelClass, tableSwitchClass } from "./uiStyles";
import { Badge } from "../ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { TableCheckbox } from "../ui/table-checkbox";

type InputCharacterEditSheetProps = {
  /** 編集対象行。null のときはシートを閉じる（フィルタで対象が消えた場合を含む） */
  row: VisibleRow | null;
  /** シートの開閉通知。閉じるときに親側で選択キャラを解除する */
  onOpenChange: (open: boolean) => void;
  ownedPurePiece: number;
  ownedPurePieceByBase: number;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
  onUpdatePurePiece: (name: string, value: number) => void;
  includeSameBasePurePieceForUe2: boolean;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
};

type SheetBodyProps = Omit<InputCharacterEditSheetProps, "row" | "onOpenChange"> & {
  character: MasterCharacter;
  progress: CharacterProgress;
};

// シート内のフィールド1件分をラベル付きで縦に並べる。
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

// 内訳表示の1行（項目名と符号付き数値）を表示する。
function BreakdownLine({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <span className={`inline-flex items-baseline justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </span>
  );
}

// 編集シートの本文。派生値を計算し、全編集項目と必要数の内訳を縦に表示する。
const SheetBody = memo(function SheetBody({
  character,
  progress,
  ownedPurePiece,
  ownedPurePieceByBase,
  onUpdateProgress,
  onUpdatePurePiece,
  includeSameBasePurePieceForUe2,
  starMemoryCalcMode,
  ue1MemoryCalcMode,
}: SheetBodyProps) {
  // 必要メモピ・ピュアピの内訳や最大強化判定などの派生値を一括計算する（テーブル行と同一ロジック）。
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
    <div className="grid gap-5">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold leading-none">
          <span className={character.limited ? "text-limited-text" : "text-normal-text"}>{character.limited ? "限定" : "恒常"}</span>
          <span className="text-tag-separator">/</span>
          <span className={attributeTextClassMap[character.attribute]}>{character.attribute}</span>
          <span className="text-tag-separator">/</span>
          <span className={roleTextClassMap[character.role]}>{character.role}</span>
        </div>
        <SheetTitle className="text-lg">{character.name}</SheetTitle>
        <SheetDescription>変更は即時保存されます</SheetDescription>
      </SheetHeader>

      {/* 最重要情報「あと何個必要か」をファーストビューで確認できるよう、ヘッダー直下へコンパクトに表示する。
          詳細な内訳はシート下部の各セクションで従来どおり確認できる。 */}
      <section
        aria-label="必要数サマリー"
        className="grid grid-cols-2 divide-x divide-white/20 rounded-[10px] border border-white/20 bg-input-bg px-3 py-2.5"
      >
        <div className="grid gap-0.5 pr-3">
          <span className="text-xs font-semibold text-muted">必要メモピ</span>
          <span className="text-lg font-bold leading-tight tabular-nums">{adjustedTotalRemainingMemoryPiece}</span>
        </div>
        <div className="grid gap-0.5 pl-3">
          <span className="text-xs font-semibold text-muted">必要ピュアピ</span>
          {/* ピュアピが意味を持たない（☆6・専用2とも未実装）キャラは値の代わりに「-」を表示する */}
          <span className="text-lg font-bold leading-tight tabular-nums">{isPurePieceImplemented ? totalPurePieceNeeded : "-"}</span>
        </div>
      </section>

      <section>
        <h3 className={sectionLabelClass}>基本</h3>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={`${tableSwitchClass} min-h-9`}>
              <TableCheckbox checked={progress.owned} aria-label={`${character.name}の所持状態`} onCheckedChange={handleOwnedChange} />
              <span>所持</span>
            </label>
            <label className={`${tableSwitchClass} min-h-9`}>
              <TableCheckbox
                checked={progress.limitBreak}
                aria-label={`${character.name}の限界突破状態`}
                onCheckedChange={handleLimitBreakChange}
              />
              <span>限界突破</span>
            </label>
          </div>
          {/* ☆はセグメンテッドコントロール（6ボタン）のため1行を占有する */}
          <FieldRow label="☆">
            <StarSegmentedControl character={character} star={progress.star} isAtMax={isStarAtMax} onUpdateProgress={onUpdateProgress} />
          </FieldRow>
          {/* ステッパーは −/値/+ の横並びのため1行を占有する */}
          <FieldRow label="コネクトRANK">
            <ConnectRankStepper
              character={character}
              connectRank={progress.connectRank}
              isAtMax={isConnectRankAtMax}
              onUpdateProgress={onUpdateProgress}
            />
          </FieldRow>
        </div>
      </section>

      <section>
        <h3 className={sectionLabelClass}>専用装備</h3>
        {/* ステッパーの −/+ に 44px 幅を確保するため、2カラムでなく縦積みにする */}
        <div className="grid gap-3">
          <FieldRow label="専用1">
            <Ue1Stepper character={character} value={ue1CompositeValue} isAtMax={isUe1AtMax} onUpdateProgress={onUpdateProgress} />
          </FieldRow>
          <FieldRow label="専用2">
            <Ue2Stepper character={character} value={ue2Value} isAtMax={isUe2AtMax} onUpdateProgress={onUpdateProgress} />
          </FieldRow>
        </div>
      </section>

      <section>
        <h3 className={sectionLabelClass}>ピース所持数</h3>
        {/* 数値ステッパーは −/入力/+ の横並びのため、2カラムでなく縦積みにする */}
        <div className="grid gap-3">
          <FieldRow label="所持メモピ">
            <OwnedMemoryPieceStepper character={character} ownedMemoryPiece={progress.ownedMemoryPiece} onUpdateProgress={onUpdateProgress} />
          </FieldRow>
          <FieldRow label="所持ピュアピ">
            <OwnedPurePieceStepper
              character={character}
              ownedPurePiece={ownedPurePiece}
              isImplemented={isPurePieceImplemented}
              onUpdatePurePiece={onUpdatePurePiece}
            />
          </FieldRow>
        </div>
      </section>

      <section>
        <h3 className={sectionLabelClass}>その他</h3>
        <div className="grid gap-3">
          <label className={`${tableSwitchClass} min-h-9`}>
            <TableCheckbox
              checked={progress.adventureMemoryPieceTarget === true}
              aria-label={`${character.name}のアドベンチャーメモピ枠`}
              onCheckedChange={handleAdventureMemoryPieceTargetChange}
            />
            <span>アドベンチャーメモピ枠</span>
          </label>
          <FieldRow label="入手日">
            <ObtainedDatePicker character={character} obtainedDate={progress.obtainedDate} onUpdateProgress={onUpdateProgress} />
          </FieldRow>
          <FieldRow label="ガチャ回数">
            <GachaPullCountStepper character={character} gachaPullCount={progress.gachaPullCount} onUpdateProgress={onUpdateProgress} />
          </FieldRow>
        </div>
      </section>

      <section>
        <h3 className={sectionLabelClass}>必要メモピ合計</h3>
        {/* デスクトップでは Tooltip で表示している内訳を、タッチ操作向けにインラインで常時表示する */}
        <div className="grid gap-1.5 rounded-[10px] border border-white/20 bg-input-bg px-3 py-2.5 text-sm">
          <BreakdownLine label="☆" value={`+${starRemainingMemoryPiece}`} />
          <BreakdownLine label="コネクトRANK" value={`+${connectRankRemainingMemoryPiece}`} />
          <BreakdownLine label="専用1" value={`+${ue1RemainingMemoryPiece}`} />
          <BreakdownLine label="限界突破" value={`+${limitBreakRemainingMemoryPiece}`} />
          <BreakdownLine label="所持数" value={`-${progress.ownedMemoryPiece}`} />
          <div className="mt-1 h-px bg-white/20" />
          <BreakdownLine label="合計" value={`${adjustedTotalRemainingMemoryPiece}`} bold />
        </div>
      </section>

      <section>
        <h3 className={sectionLabelClass}>必要ピュアピ合計</h3>
        <div className="grid gap-1.5 rounded-[10px] border border-white/20 bg-input-bg px-3 py-2.5 text-sm">
          <BreakdownLine label="☆6" value={`+${star6PurePieceNeed}`} />
          <BreakdownLine label="所持数" value={`-${ownedPurePiece}`} />
          <div className="h-px bg-white/20" />
          <BreakdownLine label="小計" value={`+${star6PurePieceSubtotal}`} />
          <div className="h-2" />
          <div className="h-px bg-white/20" />
          <BreakdownLine label="専用2" value={`+${ue2PurePieceNeed}`} />
          <BreakdownLine label={`・${character.name}`} value={`-${ownedPurePiece}`} />
          {includeSameBasePurePieceForUe2 && character.implemented.ue2 ? (
            <BreakdownLine label="・同名別衣装" value={`-${sameBasePurePieceUsed}`} />
          ) : null}
          <div className="h-px bg-white/20" />
          <BreakdownLine label="小計" value={`+${ue2PurePieceSubtotal}`} bold />
          <div className="h-2" />
          <div className="h-px bg-white/20" />
          <BreakdownLine label="合計" value={`+${totalPurePieceNeeded}`} bold />
        </div>
      </section>

      <section>
        <h3 className={sectionLabelClass}>メモピ入手</h3>
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
      </section>
    </div>
  );
});

// モバイル向けのキャラ編集ボトムシート。progressFields の共通フィールドを縦に配置し、編集は即時保存する。
export function InputCharacterEditSheet({ row, onOpenChange, ...bodyProps }: InputCharacterEditSheetProps) {
  return (
    <Sheet open={row !== null} onOpenChange={onOpenChange}>
      {/* iOS の safe-area（ホームバー）を padding で回避しつつ、はみ出す分は縦スクロールで閲覧する */}
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        {row ? <SheetBody character={row.character} progress={row.progress} {...bodyProps} /> : null}
      </SheetContent>
    </Sheet>
  );
}
