import type { TooltipProps } from "recharts";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { GachaPullChartItem } from "../../utils/dashboard";
import { ChartContainer, ChartTooltip, type ChartConfig } from "./chart";

type GachaPullChartProps = {
  items: GachaPullChartItem[];
  averagePullCount: number;
};

const chartConfig: ChartConfig = {
  gachaPullCount: {
    label: "ガチャ回数",
    color: "#4f8dff",
  },
};

// 日付文字列を YYYY/MM/DD 表示へ変換する。
function formatDateForDisplay(value: string): string {
  return value.replace(/-/g, "/");
}

// 軸ラベル用にキャラ名を省略し、長い名前は末尾を ... に置き換える。
function formatCharacterNameForAxis(value: string): string {
  const maxLength = 7;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

// ガチャ回数グラフ用のツールチップ内容を表示する。
function GachaPullTooltipContent({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const firstItem = payload[0];
  const row = firstItem?.payload as GachaPullChartItem | undefined;
  if (!row) {
    return null;
  }
  return (
    <div className="grid gap-1.5 rounded-[10px] border border-white/20 bg-[#090e17f5] px-3 py-2 text-xs shadow-panel">
      <div className="text-main">{row.name}</div>
      <div className="text-muted">ガチャ回数: {row.gachaPullCount}</div>
      <div className="text-muted">入手日: {formatDateForDisplay(row.obtainedDate)}</div>
    </div>
  );
}

// キャラ名を横軸にしたガチャ回数の棒グラフを表示する。
export function GachaPullChart({ items, averagePullCount }: GachaPullChartProps) {
  if (items.length === 0) {
    return <p className="m-0 text-sm text-muted">該当データがありません</p>;
  }

  const chartWidth = Math.max(720, items.length * 46);
  return (
    <div className="overflow-x-auto">
      <ChartContainer config={chartConfig} className="h-[320px] min-w-[720px]" style={{ width: `${chartWidth}px` }}>
        <BarChart width={chartWidth} height={320} data={items} margin={{ top: 16, right: 12, bottom: 16, left: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" />
          <XAxis
            dataKey="name"
            tickFormatter={(value) => formatCharacterNameForAxis(String(value))}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={88}
            tickMargin={10}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#c8d8f6", fontSize: 11 }}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#c8d8f6", fontSize: 12 }} />
          <ChartTooltip cursor={{ fill: "rgba(69,230,255,0.08)" }} content={<GachaPullTooltipContent />} />
          <ReferenceLine
            y={averagePullCount}
            stroke="#9ac0ff"
            strokeDasharray="6 4"
            ifOverflow="extendDomain"
            label={{
              value: `平均 ${averagePullCount.toFixed(1)}`,
              position: "insideTopRight",
              fill: "#c8d8f6",
              fontSize: 11,
            }}
          />
          <Bar dataKey="gachaPullCount" fill="#4f8dff" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
