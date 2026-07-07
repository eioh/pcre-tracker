import type { TooltipContentProps } from "recharts";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { GachaPullChartItem } from "../../utils/dashboard";
import { ChartContainer, ChartTooltip, type ChartConfig } from "./chart";

type GachaPullChartProps = {
  items: GachaPullChartItem[];
  averagePullCount: number;
};

const chartConfig: ChartConfig = {
  gachaPullCount: {
    label: "ガチャ回数",
    color: "var(--color-chart-bar)",
  },
};

// 日付文字列を YYYY/MM/DD 表示へ変換する。
function formatDateForDisplay(value: string): string {
  return value.replace(/-/g, "/");
}

// 軸ラベル用にキャラ名を省略し、長い名前は末尾を ... に置き換える(省略長は画面幅に応じて指定)。
function formatCharacterNameForAxis(value: string, maxLength: number = 7): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

// ガチャ回数グラフ用のツールチップ内容を表示する。
function GachaPullTooltipContent({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const firstItem = payload[0];
  const row = firstItem?.payload as GachaPullChartItem | undefined;
  if (!row) {
    return null;
  }
  return (
    <div className="grid gap-1.5 rounded-[10px] border border-white/20 bg-popover-bg px-3 py-2 text-xs shadow-panel">
      <div className="text-main">{row.name}</div>
      <div className="text-muted">ガチャ回数: {row.gachaPullCount}</div>
      <div className="text-muted">入手日: {formatDateForDisplay(row.obtainedDate)}</div>
    </div>
  );
}

// キャラ名を縦軸に並べ、ガチャ回数を横棒で表示する。
export function GachaPullChart({ items, averagePullCount }: GachaPullChartProps) {
  // フックは早期 return より前に必ず呼ぶ(Rules of Hooks 違反防止)。
  const isMobile = useIsMobile();

  if (items.length === 0) {
    return <p className="m-0 text-sm text-muted">該当データがありません</p>;
  }

  const chartHeight = Math.max(320, items.length * 44);

  // モバイル時は ResponsiveContainer で画面幅に収める。
  // 縦スクロール箱(max-h-[520px])との相性対策として高さは items.length ベースの値を明示的に渡す。
  if (isMobile) {
    return (
      <div className="max-h-[520px] overflow-y-auto pr-2">
        <ChartContainer config={chartConfig} className="min-h-[320px]" style={{ height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={items}
              layout="vertical"
              margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
            >
              <CartesianGrid horizontal={false} stroke="var(--color-chart-grid)" />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-sub)", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                tickFormatter={(value) => formatCharacterNameForAxis(String(value), 6)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-sub)", fontSize: 11 }}
              />
              <ChartTooltip cursor={{ fill: "var(--color-chart-cursor)" }} content={GachaPullTooltipContent} />
              <ReferenceLine
                x={averagePullCount}
                stroke="var(--color-chart-ref)"
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
                label={{
                  value: `平均 ${averagePullCount.toFixed(1)}`,
                  position: "insideTop",
                  fill: "var(--color-sub)",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="gachaPullCount" fill="var(--color-chart-bar)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    );
  }

  return (
    <div className="max-h-[520px] overflow-y-auto pr-2">
      <ChartContainer config={chartConfig} className="min-h-[320px] min-w-[720px]" style={{ height: `${chartHeight}px` }}>
        <BarChart
          width={720}
          height={chartHeight}
          data={items}
          layout="vertical"
          margin={{ top: 16, right: 28, bottom: 8, left: 8 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--color-chart-grid)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-sub)", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tickFormatter={(value) => formatCharacterNameForAxis(String(value))}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-sub)", fontSize: 11 }}
          />
          <ChartTooltip cursor={{ fill: "var(--color-chart-cursor)" }} content={GachaPullTooltipContent} />
          <ReferenceLine
            x={averagePullCount}
            stroke="var(--color-chart-ref)"
            strokeDasharray="6 4"
            ifOverflow="extendDomain"
            label={{
              value: `平均 ${averagePullCount.toFixed(1)}`,
              position: "insideTop",
              fill: "var(--color-sub)",
              fontSize: 11,
            }}
          />
          <Bar dataKey="gachaPullCount" fill="var(--color-chart-bar)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
