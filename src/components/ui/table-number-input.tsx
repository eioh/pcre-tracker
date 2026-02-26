import { forwardRef, type ComponentPropsWithRef } from "react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

type TableNumberInputProps = ComponentPropsWithRef<typeof Input>;

// テーブルセルで使う数値入力の見た目を統一する。
export const TableNumberInput = forwardRef<HTMLInputElement, TableNumberInputProps>(function TableNumberInput(
  { className, ...props },
  ref,
) {
  return <Input ref={ref} className={cn("min-w-32 px-2.5 py-2", className)} {...props} />;
});
TableNumberInput.displayName = "TableNumberInput";
