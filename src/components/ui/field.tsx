import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type FieldProps = LabelHTMLAttributes<HTMLLabelElement>;
type FieldLabelProps = {
  children: ReactNode;
  className?: string;
};
type FieldControlProps = HTMLAttributes<HTMLDivElement>;

// 入力項目をラベル込みで縦並び表示する。
// 単一入力はラベル内ラップで十分だが、複合入力は htmlFor/id で明示的に関連付ける。
export function Field({ className, ...props }: FieldProps) {
  return <label className={cn("grid gap-1.5 text-sm text-muted", className)} {...props} />;
}

// 入力項目名を表示する。
// 複合入力では Field に htmlFor を設定し、主要コントロールの id と対応させる。
export function FieldLabel({ children, className }: FieldLabelProps) {
  return <span className={cn(className)}>{children}</span>;
}

// 入力コントロール群のレイアウトを統一する。
export function FieldControl({ className, ...props }: FieldControlProps) {
  return <div className={cn(className)} {...props} />;
}
