import * as React from "react";
import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

// shadcn/ui 形式の入力コンポーネント。
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, type, ...props }, ref) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-[12px] border border-white/20 bg-input-bg px-3 py-2 text-sm text-main outline-none transition placeholder:text-muted focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
