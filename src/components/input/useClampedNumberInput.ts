import { useCallback, useEffect, useState } from "react";

type ClampedNumberInputResult = {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
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

  return { value: input, onChange: handleChange, onBlur: handleBlur, onKeyDown: handleKeyDown };
}
