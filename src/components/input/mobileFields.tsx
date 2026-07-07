import { useCallback, useMemo } from "react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import { cn } from "../../lib/utils";
import { formatUeLevel } from "./formatters";
import type { ProgressPatch } from "./types";

// 進捗更新コールバックの共通型。progressFields と同じく App 側の handleUpdateProgress を受け取る。
type UpdateProgressHandler = (name: string, patch: ProgressPatch) => void;

// コネクトRANKの選択可能値（0=未開放〜15）。値リスト歩進方式で他ステッパーと統一する。
const CONNECT_RANK_VALUES = Array.from({ length: 16 }, (_, index) => index);

// 値リストの現在値から delta 段ずらした値を返す（両端でクランプ）。
// UE1_LEVEL_VALUES のような非連続値でも「1段ずつ」の歩進を保証する。
function stepListValue<T>(values: readonly T[], current: T, delta: number): T {
  const currentIndex = Math.max(0, values.indexOf(current));
  const nextIndex = Math.min(values.length - 1, Math.max(0, currentIndex + delta));
  return values[nextIndex] as T;
}

type StarSegmentedControlProps = {
  character: MasterCharacter;
  star: CharacterProgress["star"];
  isAtMax: boolean;
  onUpdateProgress: UpdateProgressHandler;
};

// モバイル編集シート用の☆セグメンテッドコントロール。
// 常に1〜6の6ボタンを描画してレイアウトを固定し、☆6未実装キャラは「6」だけを無効化する。
export function StarSegmentedControl({ character, star, isAtMax, onUpdateProgress }: StarSegmentedControlProps) {
  // ☆6未実装キャラは選択可能な最大値を☆5に制限する（StarSelect と同じ判定）。
  const starMax = character.implemented.star6 ? 6 : 5;
  // タップされた☆値をそのままパッチとして通知する。
  const handleSelect = useCallback(
    (value: number) => onUpdateProgress(character.name, { star: value as CharacterProgress["star"] }),
    [onUpdateProgress, character.name],
  );
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {Array.from({ length: 6 }, (_, index) => index + 1).map((starOption) => {
        const isSelected = starOption === star;
        const isDisabled = starOption > starMax;
        return (
          <button
            key={starOption}
            type="button"
            disabled={isDisabled}
            aria-pressed={isSelected}
            className={cn(
              "min-h-11 rounded-[10px] border border-white/20 bg-input-bg text-sm font-bold text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              isSelected && (isAtMax ? "border-maxed-border bg-maxed-bg text-maxed-text" : "border-accent bg-selected text-main"),
              isDisabled && "border-disabled-border bg-disabled-bg text-disabled-text",
            )}
            onClick={() => handleSelect(starOption)}
          >
            {starOption}
          </button>
        );
      })}
    </div>
  );
}

// ステッパーの−/+ボタンの共通スタイル。44px 四方のタップターゲットを確保する。
const stepperButtonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-white/20 bg-input-bg text-base font-bold text-main transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-disabled-text";

type StepperShellProps = {
  /** −ボタンの aria-label（必須） */
  decrementLabel: string;
  /** +ボタンの aria-label（必須） */
  incrementLabel: string;
  canDecrement: boolean;
  canIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  /** 中央の値表示（値ステッパーは StepperValue、数値入力ステッパーは input を渡す） */
  children: React.ReactNode;
};

// ステッパー共通プリミティブ。−/+ボタンと中央の値表示を横並びにする。
function StepperShell({
  decrementLabel,
  incrementLabel,
  canDecrement,
  canIncrement,
  onDecrement,
  onIncrement,
  children,
}: StepperShellProps) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-stretch gap-1.5">
      <button type="button" aria-label={decrementLabel} disabled={!canDecrement} className={stepperButtonClass} onClick={onDecrement}>
        −
      </button>
      {children}
      <button type="button" aria-label={incrementLabel} disabled={!canIncrement} className={stepperButtonClass} onClick={onIncrement}>
        ＋
      </button>
    </div>
  );
}

type StepperValueProps = {
  value: string;
  /** 最大強化済みなら maxed スタイル（TableSelect の appearance="maxed" と同じ CSS 変数）で表示する */
  isAtMax?: boolean;
  /** 未実装項目の無効表示 */
  disabled?: boolean;
};

// ステッパー中央の値表示。maxed / 無効の見た目を TableSelect の appearance と揃える。
function StepperValue({ value, isAtMax, disabled }: StepperValueProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-white/20 bg-input-bg px-2.5 text-sm font-bold tabular-nums text-main",
        isAtMax && "border-maxed-border bg-maxed-bg text-maxed-text",
        disabled && "border-disabled-border bg-disabled-bg text-disabled-text",
      )}
    >
      {value}
    </span>
  );
}

type ConnectRankStepperProps = {
  character: MasterCharacter;
  connectRank: CharacterProgress["connectRank"];
  isAtMax: boolean;
  onUpdateProgress: UpdateProgressHandler;
};

// コネクトRANKステッパー。0 は「未開放」として表示する（ConnectRankSelect と同じ表現）。
export function ConnectRankStepper({ character, connectRank, isAtMax, onUpdateProgress }: ConnectRankStepperProps) {
  // 現在値から1段ずらした RANK をパッチとして通知する。
  const handleStep = useCallback(
    (delta: number) => {
      const next = stepListValue(CONNECT_RANK_VALUES, connectRank, delta);
      onUpdateProgress(character.name, { connectRank: next as CharacterProgress["connectRank"] });
    },
    [onUpdateProgress, character.name, connectRank],
  );
  return (
    <StepperShell
      decrementLabel={`${character.name}のコネクトRANKを下げる`}
      incrementLabel={`${character.name}のコネクトRANKを上げる`}
      canDecrement={connectRank > 0}
      canIncrement={connectRank < CONNECT_RANK_VALUES.length - 1}
      onDecrement={() => handleStep(-1)}
      onIncrement={() => handleStep(1)}
    >
      <StepperValue value={connectRank === 0 ? "未開放" : String(connectRank)} isAtMax={isAtMax} />
    </StepperShell>
  );
}

type Ue1StepperProps = {
  character: MasterCharacter;
  /** rowDerived の ue1CompositeValue（SP装備中は "sp"、未実装は "null"） */
  value: string;
  isAtMax: boolean;
  onUpdateProgress: UpdateProgressHandler;
};

// 専用1ステッパー。非連続なレベル値を1段ずつ歩進し、SP実装キャラは Lv.370 の次のステップとして SP を扱う。
// パッチの組み立ては既存 Ue1Select と完全に同一（レベル指定は SP 解除、"sp" は Lv.370＋SP装備）。
export function Ue1Stepper({ character, value, isAtMax, onUpdateProgress }: Ue1StepperProps) {
  // ステップ列: レベル値の昇順 + SP実装キャラのみ最上段に "sp"（既存 Select の選択肢順と同一）。
  const steps = useMemo(
    () => [...UE1_LEVEL_VALUES.map(String), ...(character.implemented.ue1Sp ? ["sp"] : [])],
    [character.implemented.ue1Sp],
  );
  // 1段ずらした複合値を Ue1Select と同じパッチへ変換して通知する。
  const handleStep = useCallback(
    (delta: number) => {
      const next = stepListValue(steps, value, delta);
      if (next === "sp") {
        onUpdateProgress(character.name, { ue1Level: 370, ue1SpEquipped: true });
        return;
      }
      onUpdateProgress(character.name, { ue1Level: Number(next) as CharacterProgress["ue1Level"], ue1SpEquipped: false });
    },
    [steps, value, onUpdateProgress, character.name],
  );
  const decrementLabel = `${character.name}の専用1を下げる`;
  const incrementLabel = `${character.name}の専用1を上げる`;
  // 未実装キャラは操作不能の「-」表示にする（Ue1Select の無効表示と同じ扱い）。
  if (!character.implemented.ue1) {
    return (
      <StepperShell
        decrementLabel={decrementLabel}
        incrementLabel={incrementLabel}
        canDecrement={false}
        canIncrement={false}
        onDecrement={() => {}}
        onIncrement={() => {}}
      >
        <StepperValue value="-" disabled />
      </StepperShell>
    );
  }
  const currentIndex = steps.indexOf(value);
  return (
    <StepperShell
      decrementLabel={decrementLabel}
      incrementLabel={incrementLabel}
      canDecrement={currentIndex > 0}
      canIncrement={currentIndex < steps.length - 1}
      onDecrement={() => handleStep(-1)}
      onIncrement={() => handleStep(1)}
    >
      <StepperValue value={value === "sp" ? "SP" : formatUeLevel(Number(value))} isAtMax={isAtMax} />
    </StepperShell>
  );
}

type Ue2StepperProps = {
  character: MasterCharacter;
  /** rowDerived の ue2Value（未実装は "null"） */
  value: string;
  isAtMax: boolean;
  onUpdateProgress: UpdateProgressHandler;
};

// 専用2ステッパー。0〜5 を1段ずつ歩進する。未実装キャラは操作不能の「-」表示にする。
export function Ue2Stepper({ character, value, isAtMax, onUpdateProgress }: Ue2StepperProps) {
  const steps = useMemo(() => UE2_LEVEL_VALUES.map(String), []);
  // 1段ずらしたレベルを Ue2Select と同じパッチへ変換して通知する。
  const handleStep = useCallback(
    (delta: number) => {
      const next = stepListValue(steps, value, delta);
      onUpdateProgress(character.name, { ue2Level: Number(next) as CharacterProgress["ue2Level"] });
    },
    [steps, value, onUpdateProgress, character.name],
  );
  const decrementLabel = `${character.name}の専用2を下げる`;
  const incrementLabel = `${character.name}の専用2を上げる`;
  if (!character.implemented.ue2) {
    return (
      <StepperShell
        decrementLabel={decrementLabel}
        incrementLabel={incrementLabel}
        canDecrement={false}
        canIncrement={false}
        onDecrement={() => {}}
        onIncrement={() => {}}
      >
        <StepperValue value="-" disabled />
      </StepperShell>
    );
  }
  const currentIndex = steps.indexOf(value);
  return (
    <StepperShell
      decrementLabel={decrementLabel}
      incrementLabel={incrementLabel}
      canDecrement={currentIndex > 0}
      canIncrement={currentIndex < steps.length - 1}
      onDecrement={() => handleStep(-1)}
      onIncrement={() => handleStep(1)}
    >
      <StepperValue value={formatUeLevel(Number(value))} isAtMax={isAtMax} />
    </StepperShell>
  );
}
