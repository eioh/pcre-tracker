import { useCallback } from "react";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import { cn } from "../../lib/utils";
import type { ProgressPatch } from "./types";

// 進捗更新コールバックの共通型。progressFields と同じく App 側の handleUpdateProgress を受け取る。
type UpdateProgressHandler = (name: string, patch: ProgressPatch) => void;

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
