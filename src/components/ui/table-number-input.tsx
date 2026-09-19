import { forwardRef, useState, type ComponentPropsWithRef } from "react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

type TableNumberInputProps = ComponentPropsWithRef<typeof Input>;

// 入力属性と参照を受け取り、通常は枠なしの値、フォーカス中は数値入力を返す。
// DOM を維持することで、クリック・Tab の移動と既存の確定処理をそのまま利用できる。
// 親セルの内側いっぱいに配置し、文字の周囲もクリック可能にする。内向きの枠で隣のセルを覆わない。
export const TableNumberInput = forwardRef<HTMLInputElement, TableNumberInputProps>(function TableNumberInput(
  { className, onFocus, onBlur, readOnly, ...props },
  ref,
) {
  const [isEditing, setIsEditing] = useState(false);

  // フォーカスイベントを受けて編集を開始し、呼び出し元にもイベントを通知する。
  const handleFocus: NonNullable<TableNumberInputProps["onFocus"]> = (event) => {
    setIsEditing(true);
    onFocus?.(event);
  };

  // フォーカス離脱時は既存の保存処理を呼び、枠なし表示へ戻す。
  const handleBlur: NonNullable<TableNumberInputProps["onBlur"]> = (event) => {
    onBlur?.(event);
    setIsEditing(false);
  };

  return (
    <Input
      ref={ref}
      {...props}
      readOnly={readOnly || !isEditing}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(
        "absolute inset-0 h-full w-full min-w-0 rounded-none px-2 py-2 tabular-nums focus:ring-inset",
        !isEditing && "border-transparent bg-transparent shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none enabled:hover:bg-row-hover enabled:hover:border-panel-border",
        className,
      )}
    />
  );
});
TableNumberInput.displayName = "TableNumberInput";
