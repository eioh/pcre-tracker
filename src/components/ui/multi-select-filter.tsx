import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { isMultiSelected, toggleMultiSelection, type MultiSelection } from "../../domain/multiSelection";
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
  /** 選択状態。null は絞り込みなし（全項目にチェック）、空配列は何も選んでいない状態 */
  selectedValues: MultiSelection<T>;
  options: MultiSelectOption<T>[];
  /** 絞り込みなしのときにトリガーへ表示する文言 */
  allLabel: string;
  /** 何も選んでいないときにトリガーへ表示する文言 */
  noneLabel: string;
  className?: string;
  /** トリガーボタンに追加するクラス。トリガーには絞り込み中かどうかが data-active 属性で付く */
  triggerClassName?: string;
  onValueChange: (value: MultiSelection<T>) => void;
};

// 複数選択フィルタを Radix Popover ベースで表示する。
export function MultiSelectFilter<T extends string | number>({
  title,
  selectedValues,
  options,
  allLabel,
  noneLabel,
  className,
  triggerClassName,
  onValueChange,
}: MultiSelectFilterProps<T>) {
  const optionValues = options.map((option) => option.value);
  const isAllSelected = selectedValues === null;
  const isNoneSelected = selectedValues !== null && selectedValues.length === 0;
  // トリガーの要約は選んだ順ではなく選択肢の順で表示する。
  const summary = isAllSelected
    ? allLabel
    : isNoneSelected
      ? noneLabel
      : options
          .filter((option) => selectedValues.includes(option.value))
          .map((option) => option.label)
          .join(" / ");

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
              triggerClassName,
            )}
            data-active={!isAllSelected}
            aria-label={`${title}フィルタを開く`}
          >
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-left">{summary}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 grid w-[var(--radix-popover-trigger-width)] min-w-44 rounded-[12px] border border-white/20 bg-popover-bg shadow-panel"
          >
            {/* 一括操作は選択肢をスクロールしても隠れないよう、スクロール領域の外に置く */}
            <div className="flex gap-2 border-b border-white/20 px-2.5 py-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 px-2"
                disabled={isAllSelected}
                onClick={() => onValueChange(null)}
              >
                全て選択
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 px-2"
                disabled={isNoneSelected}
                onClick={() => onValueChange([])}
              >
                全て解除
              </Button>
            </div>
            <div className="grid max-h-60 gap-2 overflow-auto px-2.5 py-2">
              {options.map((option) => (
                <label key={String(option.value)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-main">
                  <Checkbox
                    checked={isMultiSelected(selectedValues, option.value)}
                    onCheckedChange={() => onValueChange(toggleMultiSelection(selectedValues, option.value, optionValues))}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
