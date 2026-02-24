import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

// 共通スタイルを持つチェックボックスコンポーネント。
export function Checkbox({ className, ...props }: CheckboxProps) {
  return <input type="checkbox" className={cn("h-4 w-4 accent-accent [color-scheme:dark]", className)} {...props} />;
}
