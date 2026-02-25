import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/utils";

type FieldProps = ComponentPropsWithoutRef<"label">;
type FieldLabelProps = {
  children: ReactNode;
  className?: string;
};
type FieldControlProps = ComponentPropsWithoutRef<"div">;

// 入力項目をラベル込みで縦並び表示する。
export function Field({ className, ...props }: FieldProps) {
  return <label className={cn("grid gap-1.5 text-sm text-muted", className)} {...props} />;
}

// 入力項目名を表示する。
export function FieldLabel({ children, className }: FieldLabelProps) {
  return <span className={cn(className)}>{children}</span>;
}

// 入力コントロール群のレイアウトを統一する。
export function FieldControl({ className, ...props }: FieldControlProps) {
  return <div className={cn(className)} {...props} />;
}
