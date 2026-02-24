import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "normal" | "limited" | "muted";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

// バッジの種別に応じた見た目クラスを返す。
function getBadgeVariantClass(variant: BadgeVariant): string {
  if (variant === "normal") {
    return "border-[#67b8ffa6] bg-[#1c4e7a4f] text-[#a9ddff]";
  }
  if (variant === "limited") {
    return "border-[#ff7e63b3] bg-[#7b2c2552] text-[#ffb19f]";
  }
  if (variant === "muted") {
    return "border-white/20 text-muted";
  }
  return "border-white/30 bg-white/10 text-main";
}

// テキスト情報を強調表示する汎用バッジ。
export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap",
        getBadgeVariantClass(variant),
        className,
      )}
      {...props}
    />
  );
}
