import { Checkbox } from "./checkbox";
import { cn } from "../../lib/utils";

type MultiSelectOption<T extends string | number> = {
  value: T;
  label: string;
};

type MultiSelectFilterProps<T extends string | number> = {
  title: string;
  selectedValues: T[];
  options: MultiSelectOption<T>[];
  emptyLabel: string;
  summary: string;
  className?: string;
  onToggle: (value: T) => void;
};

// 複数選択フィルタをdetails要素ベースで表示する。
export function MultiSelectFilter<T extends string | number>({
  title,
  selectedValues,
  options,
  emptyLabel,
  summary,
  className,
  onToggle,
}: MultiSelectFilterProps<T>) {
  return (
    <div className={cn("grid gap-1.5 text-sm text-muted", className)}>
      <span>{title}</span>
      <details className="multi-select-dropdown relative open:[&>summary]:border-accent-strong">
        <summary className="w-full cursor-pointer list-none select-none overflow-hidden text-ellipsis whitespace-nowrap rounded-[12px] border border-white/20 bg-[#090e17d9] px-3 py-2.5 text-sm text-main outline-none transition [&::-webkit-details-marker]:hidden">
          {selectedValues.length === 0 ? emptyLabel : summary}
        </summary>
        <div className="absolute left-0 top-[calc(100%+6px)] z-10 grid max-h-60 w-full gap-2 overflow-auto rounded-[12px] border border-white/20 bg-[#090e17f5] px-2.5 py-2 shadow-panel">
          {options.map((option) => (
            <label key={String(option.value)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-main">
              <Checkbox checked={selectedValues.includes(option.value)} onChange={() => onToggle(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
