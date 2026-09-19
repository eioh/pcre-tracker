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
    return "cursor-default appearance-none text-disabled-text opacity-100";
  }
  return "";
}

// 値・変更通知・SelectItem を受け取り、クリックで選択肢が開く枠なしのセルを返す。
// 開いている間だけ入力面を表示し、最大強化の印と無効状態は維持する。
// 親セル全体をトリガーにして、セルの端からも選択肢を開けるようにする。
export function TableSelect({ className, appearance = "default", disabled, children, ...props }: TableSelectProps) {
  const effectiveAppearance: TableSelectAppearance = disabled ? "disabled" : appearance;
  const isMaxed = effectiveAppearance === "maxed";
  return (
    <Select disabled={disabled} {...props}>
      <SelectTrigger className={cn(
        "absolute inset-0 h-full w-full min-w-0 rounded-none px-2 py-2 focus:ring-inset [&>svg]:ml-1 [&>svg]:size-3",
        getAppearanceClass(effectiveAppearance),
        "border-transparent bg-transparent shadow-none tabular-nums enabled:hover:bg-row-hover enabled:hover:border-panel-border data-[state=open]:border-accent data-[state=open]:bg-input-bg [&>svg]:opacity-0 enabled:hover:[&>svg]:opacity-70 focus-visible:[&>svg]:opacity-70 data-[state=open]:[&>svg]:opacity-70",
        className,
      )}>
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
