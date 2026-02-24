import { cn } from "../../lib/utils";

type SeparatorProps = {
  className?: string;
  label?: string;
};

// セクション間の区切り線を表示するコンポーネント。
export function Separator({ className, label }: SeparatorProps) {
  return <div className={cn("h-px bg-[#7a94c547]", className)} role="separator" aria-label={label} />;
}
