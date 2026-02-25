import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "../../lib/utils";

type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  label?: string;
};

// セクション間の区切り線を Radix Separator で表示する。
export function Separator({ className, orientation = "horizontal", decorative = true, label, ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      role="separator"
      aria-label={label}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        orientation === "horizontal" ? "h-px w-full bg-[#7a94c547]" : "h-full w-px bg-[#7a94c547]",
        className,
      )}
      {...props}
    />
  );
}
