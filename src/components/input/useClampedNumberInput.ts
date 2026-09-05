import { useCallback, useEffect, useState } from "react";

type ClampedNumberInputResult = {
  value: string;
  /** 表示中の入力文字列が外部の確定値と異なるか。保存表示の判定に利用する */
  isDirty: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** 入力中の文字列（draft）を基準に delta 分歩進し、即コミットする（モバイルのステッパー用） */
  stepBy: (delta: number) => void;
};

// 数値入力フィールドの外部確定値を入力文字列へ同期し、未確定状態・クランプ・コミット処理を共通化するフック。
// externalValue と clamp、onCommit を入力として受け取り、表示値・未確定状態・入力イベント処理を返す。
export function useClampedNumberInput(
  externalValue: number,
  clamp: (value: number) => number,
  onCommit: (value: number) => void,
): ClampedNumberInputResult {
  const [input, setInput] = useState(String(externalValue));

  useEffect(() => {
    setInput(String(externalValue));
  }, [externalValue]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    const clamped = clamp(Number(input) || 0);
    setInput(String(clamped));
    if (clamped !== externalValue) {
      onCommit(clamped);
    }
  }, [clamp, externalValue, input, onCommit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") {
        return;
      }
      handleBlur();
      event.currentTarget.blur();
    },
    [handleBlur],
  );

  // 入力途中（未 blur）の draft 文字列を一度クランプしてから delta 分歩進し、再クランプして即コミットする。
  const stepBy = useCallback(
    (delta: number) => {
      const next = clamp(clamp(Number(input) || 0) + delta);
      setInput(String(next));
      if (next !== externalValue) {
        onCommit(next);
      }
    },
    [clamp, externalValue, input, onCommit],
  );

  return {
    value: input,
    isDirty: input !== String(externalValue),
    onChange: handleChange,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    stepBy,
  };
}
