import type { InputHTMLAttributes } from "react";
import { Checkbox } from "./checkbox";
import { cn } from "../../lib/utils";

type TableCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

// テーブルセルで使うチェックボックスの見た目を統一する。
export function TableCheckbox({ className, ...props }: TableCheckboxProps) {
  return <Checkbox className={cn("h-4 w-4", className)} {...props} />;
}
