import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// 共通スタイルを持つセレクトコンポーネント。
export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-[12px] border border-white/20 bg-[#090e17d9] px-3 py-2 text-sm text-main outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40",
        className,
      )}
      {...props}
    />
  );
}
