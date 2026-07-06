import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

// Radix Tabs Rootをラップして提供する。
export function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn(className)} {...props} />;
}

// タブボタンを並べるリストを表示する（lineスタイル）。
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto border-b border-white/15 [overscroll-behavior-x:contain]",
        className,
      )}
      {...props}
    />
  );
}

// 選択状態に応じて下線が変わるタブトリガーを表示する（lineスタイル）。
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-4 pb-3 pt-2 text-sm font-medium text-muted transition-colors hover:text-main data-[state=active]:border-accent data-[state=active]:font-bold data-[state=active]:text-accent",
        className,
      )}
      {...props}
    />
  );
}

// 選択中タブに対応するコンテンツを表示する。
export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("data-[state=inactive]:hidden", className)} {...props} />;
}
