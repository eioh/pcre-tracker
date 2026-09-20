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

// 表示種別を受け取り、最大強化は淡いゴールド、無効状態は淡い文字色のクラスを返す。
// 値そのものを着色し、隣のセルの状態と取り違えないようにする。
function getAppearanceClass(appearance: TableSelectAppearance): string {
  if (appearance === "maxed") {
    return "border-maxed-border bg-maxed-bg text-maxed-value";
  }
  if (appearance === "disabled") {
    return "cursor-default appearance-none text-disabled-text opacity-100";
  }
  return "";
}

// 値・変更通知・SelectItem を受け取り、クリックで選択肢が開く枠なしのセルを返す。
// 開いている間だけ入力面を表示し、最大強化は値の文字色で示す。
// 親セル全体をトリガーにして、セルの端からも選択肢を開けるようにする。
export function TableSelect({ className, appearance = "default", disabled, children, ...props }: TableSelectProps) {
  const effectiveAppearance: TableSelectAppearance = disabled ? "disabled" : appearance;
  return (
    <Select disabled={disabled} {...props}>
      <SelectTrigger className={cn(
        "absolute inset-0 h-full w-full min-w-0 rounded-none px-2 py-2 focus:ring-inset [&>svg]:ml-1 [&>svg]:size-3",
        getAppearanceClass(effectiveAppearance),
        "border-transparent bg-transparent shadow-none tabular-nums enabled:hover:bg-row-hover enabled:hover:border-panel-border data-[state=open]:border-accent data-[state=open]:bg-input-bg [&>svg]:opacity-0 enabled:hover:[&>svg]:opacity-70 focus-visible:[&>svg]:opacity-70 data-[state=open]:[&>svg]:opacity-70",
        className,
      )}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
