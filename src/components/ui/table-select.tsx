import type { ReactNode } from "react";
import { Select } from "./select";
import { cn } from "../../lib/utils";

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
    return "border-[#74d6c6] bg-[#0b1a22] text-[#d9fff7] ring-1 ring-[#74d6c6]/70";
  }
  if (appearance === "disabled") {
    return "cursor-default appearance-none border-[#788aad38] bg-[#070b12bf] text-[#9fb0cf] opacity-100 [box-shadow:inset_0_0_0_1px_rgba(9,14,23,0.35)]";
  }
  return "";
}

// テーブルセルで使うセレクトの見た目を統一する。
export function TableSelect({ className, appearance = "default", disabled, ...props }: TableSelectProps) {
  const effectiveAppearance: TableSelectAppearance = disabled ? "disabled" : appearance;
  return (
    <Select
      disabled={disabled}
      className={cn("min-w-32 px-2.5 py-2", getAppearanceClass(effectiveAppearance), className)}
      {...props}
    />
  );
}
