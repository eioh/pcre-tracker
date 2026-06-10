import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Select, SelectContent, SelectTrigger, SelectValue } from "./select";

type TableSelectAppearance = "default" | "maxed" | "disabled";

type TableSelectProps = {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
  className?: string;
  appearance?: TableSelectAppearance;
};

// テーブル用セレクトの表示種別に応じたクラスを返す。
function getAppearanceClass(appearance: TableSelectAppearance): string {
  if (appearance === "maxed") {
    return "border-maxed-border bg-maxed-bg text-maxed-text";
  }
  if (appearance === "disabled") {
    return "cursor-default appearance-none border-disabled-border bg-disabled-bg text-disabled-text opacity-100 [box-shadow:inset_0_0_0_1px_rgba(9,14,23,0.35)]";
  }
  return "";
}

// テーブルセルで使うセレクトの見た目を統一する。
// children に SelectItem を渡して使用する。
export function TableSelect({ className, appearance = "default", disabled, children, ...props }: TableSelectProps) {
  const effectiveAppearance: TableSelectAppearance = disabled ? "disabled" : appearance;
  const isMaxed = effectiveAppearance === "maxed";
  return (
    <Select disabled={disabled} {...props}>
      <SelectTrigger className={cn("min-w-32 px-2.5 py-2", getAppearanceClass(effectiveAppearance), className)}>
        <SelectValue />
        {isMaxed ? (
          // 最大強化済みの状態だけを示す装飾で、Select のクリック判定を妨げない。
          <span
            aria-hidden="true"
            className="pointer-events-none ml-auto size-1.5 shrink-0 rounded-full bg-maxed-dot shadow-[0_0_0_1px_rgba(148,163,184,0.18)]"
          />
        ) : null}
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
