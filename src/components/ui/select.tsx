import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

type SelectProps = {
  className?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  onValueChange?: (value: string) => void;
};

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

// children配下を再帰走査してoption要素を抽出する。
function walkOptionNodes(node: React.ReactNode, options: SelectOption[]): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      walkOptionNodes(child, options);
    }
    return;
  }
  if (!React.isValidElement(node)) {
    return;
  }
  const element = node as React.ReactElement<{
    value?: string;
    disabled?: boolean;
    children?: React.ReactNode;
  }>;
  if (element.type === React.Fragment) {
    walkOptionNodes(element.props.children, options);
    return;
  }
  if (element.type !== "option") {
    walkOptionNodes(element.props.children, options);
    return;
  }
  if (typeof element.props.value !== "string" || element.props.value.length === 0) {
    console.warn("Select option の value は空文字以外の文字列で指定してください。");
    return;
  }
  options.push({
    value: element.props.value,
    label: element.props.children,
    disabled: Boolean(element.props.disabled),
  });
}

// option要素のchildrenから選択肢配列を抽出する。
function extractOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  walkOptionNodes(children, options);
  return options;
}

// onValueChange APIで使える Radix Select ラッパー。
export function Select({ className, value, defaultValue, disabled, children, onValueChange }: SelectProps) {
  const options = extractOptions(children);
  const isControlled = value !== undefined;

  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={isControlled ? undefined : defaultValue}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex h-10 w-full items-center justify-between rounded-[12px] border border-white/20 bg-[#090e17d9] px-3 py-2 text-left text-sm leading-none text-main outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40 data-[disabled]:cursor-default data-[disabled]:opacity-60",
          className,
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-50 overflow-hidden rounded-[12px] border border-white/20 bg-[#090e17f5] shadow-panel">
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-main">
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option, index) => (
              <SelectPrimitive.Item
                key={`${option.value}-${index}`}
                value={option.value}
                disabled={option.disabled}
                className="relative flex w-full cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-sm text-main outline-none hover:bg-white/10 data-[state=checked]:bg-[#112336]"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-main">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
