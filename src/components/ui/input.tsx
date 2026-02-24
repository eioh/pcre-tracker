import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

// 共通スタイルを持つ入力コンポーネント。
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[12px] border border-white/20 bg-[#090e17d9] px-3 py-2 text-sm text-main outline-none transition placeholder:text-muted focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40",
        className,
      )}
      {...props}
    />
  );
}
