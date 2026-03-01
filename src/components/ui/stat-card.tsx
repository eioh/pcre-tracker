import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Card } from "./card";

type StatCardProps = {
  title: string;
  value: ReactNode;
  subText: ReactNode;
  className?: string;
};

// KPIを統一スタイルで表示するカード。
export function StatCard({ title, value, subText, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-panel-border bg-linear-to-br from-panel-from to-panel-to p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      <h3 className="m-0 text-[0.78rem] font-semibold tracking-[0.06em] text-muted">{title}</h3>
      <p className="mb-1.5 mt-2.5 font-inter text-[clamp(1.2rem,2.8vw,1.9rem)] leading-tight font-normal tabular-nums tracking-tight">
        {value}
      </p>
      <small className="block text-sm text-muted">{subText}</small>
    </Card>
  );
}
