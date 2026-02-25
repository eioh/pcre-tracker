import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-linear-to-r from-accent to-accent-strong text-[#e8fffb] [text-shadow:0_1px_0_rgba(0,0,0,0.28)]",
        outline: "border border-white/20 bg-white/5 text-main hover:border-accent",
        ghost: "border border-transparent bg-transparent text-muted hover:text-main",
      },
      size: {
        default: "px-4 py-2.5 text-sm",
        sm: "px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

// shadcn/ui 形式の variants で描画するボタン。
export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
