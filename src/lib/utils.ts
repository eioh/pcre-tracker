import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui 互換でクラス名を正規化して連結する。
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
