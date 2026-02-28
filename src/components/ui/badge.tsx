import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-white/30 bg-white/10 text-main",
        normal: "border-badge-normal-border bg-badge-normal-bg text-badge-normal-text",
        limited: "border-badge-limited-border bg-badge-limited-bg text-badge-limited-text",
        muted: "border-white/20 text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

// shadcn/ui 形式の variants で描画するバッジ。
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
