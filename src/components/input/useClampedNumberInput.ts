import { useCallback, useEffect, useState } from "react";

type ClampedNumberInputResult = {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** 入力中の文字列（draft）を基準に delta 分歩進し、即コミットする（モバイルのステッパー用） */
  stepBy: (delta: number) => void;
};

// 数値入力フィールドの状態管理・クランプ・コミット処理を共通化するフック。
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

  return { value: input, onChange: handleChange, onBlur: handleBlur, onKeyDown: handleKeyDown, stepBy };
}
