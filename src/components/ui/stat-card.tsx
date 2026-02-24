import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type StatCardProps = {
  title: string;
  value: ReactNode;
  subText: ReactNode;
  className?: string;
};

// KPIを統一スタイルで表示するカード。
export function StatCard({ title, value, subText, className }: StatCardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-[#6180b359] bg-linear-to-br from-[#0d1627e8] to-[#0a111de0] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      <h3 className="m-0 text-[0.78rem] font-semibold tracking-[0.06em] text-muted">{title}</h3>
      <p className="mb-1.5 mt-2.5 font-orbitron text-[clamp(1.2rem,2.8vw,1.9rem)] leading-tight">{value}</p>
      <small className="block text-sm text-muted">{subText}</small>
    </article>
  );
}
