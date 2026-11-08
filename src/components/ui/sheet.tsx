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

// ボトムシートを下向きスワイプで閉じる判定のしきい値。
/** これ未満の移動はタップとみなし、ドラッグを始めない（px） */
const SWIPE_START_DISTANCE = 8;
/** 指を離した時点で、シートの高さに対してこの割合以上下げていたら閉じる */
const SWIPE_CLOSE_RATIO = 0.25;
/** これより速く下へ払ったら、距離が足りなくても閉じる（px/ms） */
const SWIPE_CLOSE_VELOCITY = 0.5;
/** 最後の移動からこの時間を超えて止まっていたら、払う速度は 0 とみなす（ms） */
const SWIPE_VELOCITY_WINDOW = 100;
/** 閉じずに元の位置へ戻すアニメーションの時間（ms） */
const SWIPE_SNAP_BACK_MS = 200;

type SwipeState = {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  dragging: boolean;
};

// ドラッグ直後にブラウザが発火する click を握りつぶし、つまんだ位置のボタンが反応しないようにする。
function suppressTrustedClick(event: MouseEvent): void {
  if (event.isTrusted) {
    event.preventDefault();
    event.stopPropagation();
  }
}

// シート本体を画面端から表示する。閉じるボタンを右上に併設する。
// side="bottom" のときは上端につまみを表示し、本文（SheetScrollArea）以外の部分を下へスワイプすると閉じる。
const SheetContent = React.forwardRef<React.ComponentRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  function SheetContent(
    { side = "right", className, children, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, ...props },
    ref,
  ) {
    const isBottom = side === "bottom";
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const swipeRef = React.useRef<SwipeState | null>(null);

    // 外から渡された ref とスワイプ処理用の ref の両方へ要素を渡す。
    const setContentRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    // スワイプの起点を記録する。本文から始まった操作はスクロールに任せて対象外にする。
    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
      onPointerDown?.(event);
      if (!isBottom || event.defaultPrevented) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      if (event.target instanceof Element && event.target.closest("[data-sheet-scroll-area]")) {
        return;
      }
      swipeRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocity: 0,
        dragging: false,
      };
    };

    // 指の移動に合わせてシートを下へずらす。上方向に動いた場合はスワイプをやめる。
    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
      onPointerMove?.(event);
      const swipe = swipeRef.current;
      const element = contentRef.current;
      if (!swipe || !element || swipe.pointerId !== event.pointerId) {
        return;
      }
      const distance = event.clientY - swipe.startY;
      if (!swipe.dragging) {
        if (distance <= -SWIPE_START_DISTANCE) {
          swipeRef.current = null;
          return;
        }
        if (distance < SWIPE_START_DISTANCE) {
          return;
        }
        swipe.dragging = true;
        element.setPointerCapture?.(event.pointerId);
        element.style.transition = "none";
      }
      const elapsed = event.timeStamp - swipe.lastTime;
      if (elapsed > 0) {
        swipe.velocity = (event.clientY - swipe.lastY) / elapsed;
      }
      swipe.lastY = event.clientY;
      swipe.lastTime = event.timeStamp;
      element.style.transform = `translateY(${Math.max(0, distance)}px)`;
    };

    // 指を離したときに、移動量か払う速度が十分なら閉じ、足りなければ元の位置へ戻す。
    const finishSwipe = (event: React.PointerEvent<HTMLDivElement>, canClose: boolean): void => {
      const swipe = swipeRef.current;
      const element = contentRef.current;
      if (!swipe || swipe.pointerId !== event.pointerId) {
        return;
      }
      swipeRef.current = null;
      if (!swipe.dragging || !element) {
        return;
      }
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
      const distance = Math.max(0, event.clientY - swipe.startY);
      const isRecentMove = event.timeStamp - swipe.lastTime <= SWIPE_VELOCITY_WINDOW;
      const velocity = isRecentMove ? swipe.velocity : 0;
      const shouldClose =
        canClose && (distance >= element.offsetHeight * SWIPE_CLOSE_RATIO || velocity >= SWIPE_CLOSE_VELOCITY);
      if (shouldClose) {
        // 閉じる処理は Radix の Close ボタンに任せ、開閉状態の持ち方（制御/非制御）に依存しないようにする。
        closeRef.current?.click();
        return;
      }
      element.addEventListener("click", suppressTrustedClick, { capture: true });
      window.setTimeout(() => element.removeEventListener("click", suppressTrustedClick, { capture: true }), 0);
      element.style.transition = `transform ${SWIPE_SNAP_BACK_MS}ms ease-out`;
      element.style.transform = "";
    };

    // 指を離したときの処理。
    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
      onPointerUp?.(event);
      finishSwipe(event, true);
    };

    // ブラウザに操作を奪われたときは閉じずに元へ戻す。
    const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
      onPointerCancel?.(event);
      finishSwipe(event, false);
    };

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          ref={setContentRef}
          className={cn(sheetVariants({ side }), isBottom && "pt-3", className)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          {...props}
        >
          {isBottom ? (
            <div aria-hidden="true" data-sheet-grabber="" className="mx-auto -mb-1 h-1.5 w-10 shrink-0 touch-none rounded-full bg-white/25" />
          ) : null}
          {children}
          <SheetPrimitive.Close
            ref={closeRef}
            className="absolute right-4 top-4 rounded-[6px] text-muted transition hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
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
// ボトムシートではスワイプで閉じるつかみ所になるため、ブラウザのスクロール操作に奪われないよう touch-none にする。
function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid shrink-0 touch-none gap-1.5 text-left", className)} {...props} />;
}

// ボトムシートの本文。ここだけを縦スクロールさせてタイトル行を常に表示し、ここから始まる操作はスワイプで閉じる対象にしない。
// 左右の余白をスクロール領域に含め、スクロールバーをシートの端に置く。上下の余白は入力欄のフォーカスリングが切れないようにするため。
function SheetScrollArea({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-sheet-scroll-area=""
      className={cn("-mx-5 -my-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1", className)}
      {...props}
    />
  );
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
  SheetScrollArea,
  SheetTitle,
  SheetTrigger,
};
