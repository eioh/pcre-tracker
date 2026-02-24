import { createContext, useContext, type ReactNode } from "react";
import { cn } from "../../lib/utils";

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

// タブの選択状態を子コンポーネントへ共有する。
export function Tabs({ value, onValueChange, children }: TabsProps) {
  return <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>;
}

type TabsListProps = {
  className?: string;
  children: ReactNode;
};

// タブボタンを並べるコンテナを表示する。
export function TabsList({ className, children }: TabsListProps) {
  return (
    <div
      className={cn(
        "inline-flex gap-2 rounded-full border border-white/20 bg-white/5 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
      role="tablist"
      aria-label="画面切り替え"
    >
      {children}
    </div>
  );
}

type TabsTriggerProps = {
  value: string;
  className?: string;
  children: ReactNode;
};

// 選択状態に応じて見た目が変わるタブボタンを表示する。
export function TabsTrigger({ value, className, children }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs");
  }
  const isActive = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cn(
        isActive
          ? "rounded-full bg-linear-to-r from-accent to-accent-strong px-5 py-2.5 text-sm font-extrabold text-[#e8fffb] [text-shadow:0_1px_0_rgba(0,0,0,0.28)]"
          : "cursor-pointer rounded-full bg-transparent px-5 py-2.5 text-sm font-bold text-muted transition hover:text-main",
        className,
      )}
      onClick={() => context.onValueChange(value)}
    >
      {children}
    </button>
  );
}

type TabsContentProps = {
  value: string;
  className?: string;
  children: ReactNode;
};

// 選択中タブと一致するコンテンツのみ表示する。
export function TabsContent({ value, className, children }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within Tabs");
  }
  const hidden = context.value !== value;

  return (
    <div className={className} hidden={hidden} aria-hidden={hidden} role="tabpanel">
      {!hidden ? children : null}
    </div>
  );
}
