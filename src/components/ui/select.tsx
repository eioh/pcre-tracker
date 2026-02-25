import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

type OptionElement = React.ReactElement<{ value?: string; children?: React.ReactNode }>;

type SelectProps = {
  className?: string;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  disabled?: boolean;
  children?: React.ReactNode;
  onValueChange?: (value: string) => void;
};

// option要素のchildrenから選択肢配列を抽出する。
function extractOptions(children: React.ReactNode): Array<{ value: string; label: string }> {
  const nodes = React.Children.toArray(children).filter(React.isValidElement) as OptionElement[];
  return nodes.map((node) => ({
    value: String(node.props.value ?? ""),
    label: typeof node.props.children === "string" ? node.props.children : String(node.props.children ?? ""),
  }));
}

// onValueChange APIで使える Radix Select ラッパー。
export function Select({ className, value, defaultValue, disabled, children, onValueChange }: SelectProps) {
  const options = extractOptions(children);
  const currentValue = value !== undefined ? String(Array.isArray(value) ? value[0] ?? "" : value) : undefined;
  const initialValue =
    defaultValue !== undefined ? String(Array.isArray(defaultValue) ? defaultValue[0] ?? "" : defaultValue) : undefined;

  return (
    <SelectPrimitive.Root
      value={currentValue}
      defaultValue={initialValue}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex h-10 w-full items-center justify-between rounded-[12px] border border-white/20 bg-[#090e17d9] px-3 py-2 text-left text-sm text-main outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40 data-[disabled]:cursor-default data-[disabled]:opacity-60",
          className,
        )}
      >
        <SelectPrimitive.Value className="leading-none" />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-50 overflow-hidden rounded-[12px] border border-white/20 bg-[#090e17f5] shadow-panel">
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex w-full cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-sm text-main outline-none hover:bg-white/10 data-[state=checked]:bg-[#112336]"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
