import type { ComponentProps, CSSProperties } from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { ja } from "date-fns/locale";
import { cn } from "../../lib/utils";
import "react-day-picker/dist/style.css";

export type CalendarProps = ComponentProps<typeof DayPicker>;

// shadcn/ui 風の見た目で DayPicker を描画する。
export function Calendar({ className, classNames, showOutsideDays = true, style, ...props }: CalendarProps) {
  const currentYear = new Date().getFullYear();
  const defaultClassNames = getDefaultClassNames();
  const calendarStyle: CSSProperties = {
    ...style,
    "--rdp-accent-color": "#ffffff",
    "--rdp-today-color": "#ffffff",
    "--rdp-accent-background-color": "rgba(255,255,255,0.16)",
  } as CSSProperties;

  return (
    <DayPicker
      locale={ja}
      captionLayout="dropdown"
      fromYear={2018}
      toYear={currentYear + 1}
      showOutsideDays={showOutsideDays}
      style={calendarStyle}
      className={cn("p-2 text-main", className)}
      classNames={{
        ...defaultClassNames,
        button_previous: cn(
          defaultClassNames.button_previous,
          "inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white hover:border-accent",
        ),
        button_next: cn(
          defaultClassNames.button_next,
          "inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white hover:border-accent",
        ),
        chevron: cn(defaultClassNames.chevron, "text-white"),
        dropdowns: cn(defaultClassNames.dropdowns, "flex items-center gap-2"),
        dropdown: cn(
          defaultClassNames.dropdown,
          "appearance-none rounded-lg border border-white/20 bg-[#090e17] px-2 py-1 text-sm text-main outline-none focus:border-accent",
        ),
        selected: cn(defaultClassNames.selected, "bg-accent text-[#071218] hover:bg-accent"),
        today: cn(defaultClassNames.today, "border border-white/50 text-white"),
        ...classNames,
      }}
      {...props}
    />
  );
}
