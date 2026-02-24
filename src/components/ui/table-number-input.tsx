import type { InputHTMLAttributes } from "react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

type TableNumberInputProps = InputHTMLAttributes<HTMLInputElement>;

// テーブルセルで使う数値入力の見た目を統一する。
export function TableNumberInput({ className, ...props }: TableNumberInputProps) {
  return <Input className={cn("min-w-32 px-2.5 py-2", className)} {...props} />;
}
