import { cn } from "../../lib/utils";

type DistributionItem = {
  label: string;
  count: number;
};

type DistributionChartProps = {
  title: string;
  items: DistributionItem[];
  emptyMessage?: string;
  className?: string;
};

// 分布データの表示対象をゼロ件以外に絞り込む。
function filterVisibleItems(items: DistributionItem[]): DistributionItem[] {
  return items.filter((item) => item.count > 0);
}

// 分布バーの最大値を計算し、ゼロ除算を防ぐ。
function getMaxCount(items: DistributionItem[]): number {
  if (items.length === 0) {
    return 1;
  }
  return Math.max(...items.map((item) => item.count));
}

// 分布データを棒グラフ風のリストで表示する。
export function DistributionChart({ title, items, emptyMessage, className }: DistributionChartProps) {
  const visibleItems = filterVisibleItems(items);
  const maxCount = getMaxCount(visibleItems);

  return (
    <section
      className={cn(
        "rounded-2xl border border-[#6180b359] bg-linear-to-br from-[#0d1627e8] to-[#0a111de0] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      <h3 className="mb-2.5 mt-0 text-sm font-semibold tracking-[0.06em]">{title}</h3>
      <ul className="m-0 grid list-none gap-2 pr-1.5">
        {visibleItems.length === 0 ? (
          <li className="grid grid-cols-[80px_minmax(0,1fr)_4ch] items-center gap-2 text-sm text-muted">
            {emptyMessage ?? "データがありません"}
          </li>
        ) : (
          visibleItems.map((item, index) => (
            <li key={`${item.label}-${index}`} className="grid grid-cols-[80px_minmax(0,1fr)_4ch] items-center gap-2">
              <span className="text-xs text-[#ccd9f5]">{item.label}</span>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-linear-to-r from-accent to-[#45e6ff]"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
              <strong className="w-[4ch] text-right font-orbitron text-sm tabular-nums">{item.count}</strong>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
