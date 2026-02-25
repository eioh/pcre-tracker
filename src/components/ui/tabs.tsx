import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

// Radix Tabs Rootをラップして提供する。
export function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn(className)} {...props} />;
}

// タブボタンを並べるリストを表示する。
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex gap-2 rounded-full border border-white/20 bg-white/5 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
      {...props}
    />
  );
}

// 選択状態に応じて見た目が変わるタブトリガーを表示する。
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "cursor-pointer rounded-full px-5 py-2.5 text-sm font-bold text-muted transition hover:text-main data-[state=active]:bg-linear-to-r data-[state=active]:from-accent data-[state=active]:to-accent-strong data-[state=active]:font-extrabold data-[state=active]:text-[#e8fffb] data-[state=active]:[text-shadow:0_1px_0_rgba(0,0,0,0.28)]",
        className,
      )}
      {...props}
    />
  );
}

// 選択中タブに対応するコンテンツを表示する。
export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn(className)} {...props} />;
}
