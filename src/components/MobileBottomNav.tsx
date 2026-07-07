import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Calculator, Coins, LayoutDashboard, PenLine, Swords } from "lucide-react";

// モバイル専用の下部固定タブナビゲーション。
// 必ず App.tsx の Tabs Root（Radix TabsPrimitive.Root）配下に置かれる前提のコンポーネント。
// TabsPrimitive.List / Trigger を直接使うことで、value/onValueChange・forceMount の経路と
// tablist/tab の a11y を Radix にそのまま任せる（ui/tabs.tsx はコインタブでも使われるため触らない）。
export function MobileBottomNav() {
  return (
    <TabsPrimitive.List
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/15 bg-bg-end pb-[env(safe-area-inset-bottom)]"
      aria-label="画面切り替え"
    >
      <TabsPrimitive.Trigger
        value="dashboard"
        className="flex h-14 flex-col items-center justify-center gap-0.5 text-muted data-[state=active]:font-bold data-[state=active]:text-accent"
      >
        <LayoutDashboard className="size-5" />
        <span className="text-[10px]">集計</span>
      </TabsPrimitive.Trigger>
      <TabsPrimitive.Trigger
        value="input"
        className="flex h-14 flex-col items-center justify-center gap-0.5 text-muted data-[state=active]:font-bold data-[state=active]:text-accent"
      >
        <PenLine className="size-5" />
        <span className="text-[10px]">育成入力</span>
      </TabsPrimitive.Trigger>
      <TabsPrimitive.Trigger
        value="clan_battle"
        className="flex h-14 flex-col items-center justify-center gap-0.5 text-muted data-[state=active]:font-bold data-[state=active]:text-accent"
      >
        <Swords className="size-5" />
        <span className="text-[10px]">クラバト</span>
      </TabsPrimitive.Trigger>
      <TabsPrimitive.Trigger
        value="coin_shop"
        className="flex h-14 flex-col items-center justify-center gap-0.5 text-muted data-[state=active]:font-bold data-[state=active]:text-accent"
      >
        <Coins className="size-5" />
        <span className="text-[10px]">ショップ</span>
      </TabsPrimitive.Trigger>
      <TabsPrimitive.Trigger
        value="connect_rank_calc"
        className="flex h-14 flex-col items-center justify-center gap-0.5 text-muted data-[state=active]:font-bold data-[state=active]:text-accent"
      >
        <Calculator className="size-5" />
        <span className="text-[10px]">ランク計算</span>
      </TabsPrimitive.Trigger>
    </TabsPrimitive.List>
  );
}
