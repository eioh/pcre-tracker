import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "../../lib/utils";

type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  label?: string;
};

// セクション間の区切り線を Radix Separator で表示する。
export function Separator({ className, orientation = "horizontal", decorative, label, ...props }: SeparatorProps) {
  const resolvedDecorative = decorative ?? label == null;
  return (
    <SeparatorPrimitive.Root
      aria-label={resolvedDecorative ? undefined : label}
      decorative={resolvedDecorative}
      orientation={orientation}
      className={cn(
        orientation === "horizontal" ? "h-px w-full bg-[#7a94c547]" : "h-full w-px bg-[#7a94c547]",
        className,
      )}
      {...props}
    />
  );
}
