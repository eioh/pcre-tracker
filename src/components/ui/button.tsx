import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "outline" | "ghost";
type ButtonSize = "default" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

// ボタンの見た目バリアントに応じたクラスを返す。
function getVariantClass(variant: ButtonVariant): string {
  if (variant === "outline") {
    return "border border-white/20 bg-white/5 text-main hover:border-accent";
  }
  if (variant === "ghost") {
    return "border border-transparent bg-transparent text-muted hover:text-main";
  }
  return "border border-transparent bg-linear-to-r from-accent to-accent-strong text-[#e8fffb] [text-shadow:0_1px_0_rgba(0,0,0,0.28)]";
}

// ボタンサイズに応じたクラスを返す。
function getSizeClass(size: ButtonSize): string {
  if (size === "sm") {
    return "px-3 py-1.5 text-xs";
  }
  return "px-4 py-2.5 text-sm";
}

// 共通スタイルを持つボタンコンポーネント。
export function Button({ className, variant = "default", size = "default", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "cursor-pointer rounded-full font-semibold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-60",
        getVariantClass(variant),
        getSizeClass(size),
        className,
      )}
      {...props}
    />
  );
}
