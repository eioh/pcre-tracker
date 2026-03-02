import { cn } from "../../lib/utils";
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { TooltipContentProps } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "./chart";

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

const chartConfig: ChartConfig = {
  count: {
    label: "件数",
    color: "var(--color-chart-bar)",
  },
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

// 表示件数に応じてチャート高さを決定し、余白が過剰にならないよう調整する。
function getChartHeight(itemCount: number): number {
  const rowHeight = 42;
  const basePadding = 28;
  return Math.max(160, basePadding + itemCount * rowHeight);
}

// 分布グラフ用のツールチップ内容を表示する。
function DistributionTooltipContent({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const row = payload[0]?.payload as DistributionItem | undefined;
  if (!row) {
    return null;
  }
  return (
    <div className="grid gap-1.5 rounded-[10px] border border-white/20 bg-popover-bg px-3 py-2 text-xs shadow-panel">
      <div className="text-main">{row.label}</div>
      <div className="text-muted">件数: {row.count}</div>
    </div>
  );
}

// 分布データを棒グラフ風のリストで表示する。
export function DistributionChart({ title, items, emptyMessage, className }: DistributionChartProps) {
  const visibleItems = filterVisibleItems(items);
  const maxCount = getMaxCount(visibleItems);
  const chartHeight = getChartHeight(visibleItems.length);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-panel-border bg-linear-to-br from-panel-from to-panel-to p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      <h3 className="mb-2.5 mt-0 text-sm font-semibold tracking-[0.06em]">{title}</h3>
      {visibleItems.length === 0 ? (
        <p className="m-0 text-sm text-muted">{emptyMessage ?? "データがありません"}</p>
      ) : (
        <ChartContainer config={chartConfig} className="h-auto w-full">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={visibleItems} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }}>
              <XAxis type="number" hide domain={[0, maxCount]} />
              <YAxis
                type="category"
                dataKey="label"
                width={76}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-sub)", fontSize: 13 }}
              />
              <ChartTooltip cursor={{ fill: "var(--color-chart-cursor)" }} content={DistributionTooltipContent} />
              <Bar
                dataKey="count"
                radius={[6, 6, 6, 6]}
                fill="var(--color-chart-bar)"
                background={{ fill: "rgba(255, 255, 255, 0.12)", radius: 6 }}
              >
                <LabelList
                  dataKey="count"
                  position="right"
                  fill="var(--color-main)"
                  fontSize={12}
                  fontWeight={700}
                  className="font-inter tabular-nums"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </section>
  );
}
