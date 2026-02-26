import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

type CheckboxProps = Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "onCheckedChange" | "onChange"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

// Radix Checkboxの値変化を既存のonChange互換イベントへ変換する。
function toChangeEvent(
  checked: boolean,
  options: { name?: string; value?: string; type?: string },
): React.ChangeEvent<HTMLInputElement> {
  const target = {
    name: options.name ?? "",
    value: options.value ?? "on",
    type: options.type ?? "checkbox",
    checked,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as EventTarget & HTMLInputElement;
  return {
    target,
    currentTarget: target,
    preventDefault: () => {},
    stopPropagation: () => {},
    nativeEvent: {} as Event,
  } as React.ChangeEvent<HTMLInputElement>;
}

// shadcn/ui準拠のチェックボックスコンポーネント。
export function Checkbox({ className, onChange, checked, defaultChecked, name, value, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-[4px] border border-white/40 bg-[#090e17d9] text-accent outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-[#0b2a24]",
        className,
      )}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(nextChecked) => {
        if (!onChange) {
          return;
        }
        onChange(toChangeEvent(nextChecked === true, { name, value: value !== undefined ? String(value) : undefined }));
      }}
      name={name}
      value={value}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
