import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

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

// 複数選択フィルタを Radix Popover ベースで表示する。
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
      <Label>{title}</Label>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 w-full justify-between rounded-[12px] border-white/20 bg-input-bg px-3 py-2.5 text-sm font-normal text-main",
              "focus-visible:border-accent-strong focus-visible:ring-2 focus-visible:ring-accent-strong/40",
              "overflow-hidden text-ellipsis whitespace-nowrap",
            )}
            aria-label={`${title}フィルタを開く`}
          >
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-left">
              {selectedValues.length === 0 ? emptyLabel : summary}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 grid max-h-60 w-[var(--radix-popover-trigger-width)] gap-2 overflow-auto rounded-[12px] border border-white/20 bg-popover-bg px-2.5 py-2 shadow-panel"
          >
            {options.map((option) => (
              <label key={String(option.value)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-main">
                <Checkbox checked={selectedValues.includes(option.value)} onCheckedChange={() => onToggle(option.value)} />
                <span>{option.label}</span>
              </label>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
