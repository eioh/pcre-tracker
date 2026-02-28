import * as React from "react";
import { cn } from "../../lib/utils";
import { Tooltip as RechartsTooltip } from "recharts";

export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  config: ChartConfig;
  children: React.ReactNode;
};

// チャート設定からCSS変数を組み立てて配色を統一する。
function buildChartStyle(config: ChartConfig): React.CSSProperties {
  const styles: React.CSSProperties = {};
  for (const [key, item] of Object.entries(config)) {
    if (!item.color) {
      continue;
    }
    styles[`--color-${key}` as keyof React.CSSProperties] = item.color;
  }
  return styles;
}

// shadcn/ui 形式で Recharts の表示領域と配色変数を提供する。
export function ChartContainer({ config, className, children, ...props }: ChartContainerProps) {
  return (
    <div
      data-slot="chart"
      className={cn("h-[320px] w-full text-main", className)}
      style={buildChartStyle(config)}
      {...props}
    >
      {children}
    </div>
  );
}

// Recharts Tooltip を shadcn 風チャート部品として再エクスポートする。
export const ChartTooltip = RechartsTooltip;
