import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

// 背景オーバーレイを表示する。
const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return <SheetPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/65", className)} {...props} />;
});
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

// 表示位置（side）ごとのシート本体のクラスを定義する。
const sheetVariants = cva("fixed z-50 flex flex-col gap-4 border-white/20 bg-popover-bg p-5 shadow-panel", {
  variants: {
    side: {
      top: "inset-x-0 top-0 rounded-b-[12px] border-b",
      bottom: "inset-x-0 bottom-0 rounded-t-[12px] border-t",
      left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r",
      right: "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l",
    },
  },
  defaultVariants: {
    side: "right",
  },
});

type SheetContentProps = React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & VariantProps<typeof sheetVariants>;

// シート本体を画面端から表示する。閉じるボタンを右上に併設する。
const SheetContent = React.forwardRef<React.ComponentRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  function SheetContent({ side = "right", className, children, ...props }, ref) {
    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
          {children}
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-[6px] text-muted transition hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
            <X className="size-5" />
            <span className="sr-only">閉じる</span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

// タイトル・説明のヘッダー領域を表示する。
function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-1.5 text-left", className)} {...props} />;
}

// 操作ボタンのフッター領域を表示する。
function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

// シートタイトルを表示する。
const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return <SheetPrimitive.Title ref={ref} className={cn("text-base font-semibold text-main", className)} {...props} />;
});
SheetTitle.displayName = SheetPrimitive.Title.displayName;

// シート説明文を表示する。
const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted", className)} {...props} />;
});
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
