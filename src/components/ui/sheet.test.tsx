import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetScrollArea, SheetTitle } from "./sheet";

const SHEET_HEIGHT = 400;

// テスト用のシートを開いた状態で描画する。
function renderSheet(side: "bottom" | "right" = "bottom") {
  const onOpenChange = vi.fn();
  render(
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>シート見出し</SheetTitle>
          <SheetDescription>説明</SheetDescription>
        </SheetHeader>
        <SheetScrollArea>
          <button type="button">本文のボタン</button>
        </SheetScrollArea>
      </SheetContent>
    </Sheet>,
  );
  return { onOpenChange, dialog: screen.getByRole("dialog") };
}

// 指定した要素から下方向へドラッグする。各移動の間に経過時間を進める。
function drag(target: Element, moves: Array<{ dy: number; afterMs: number }>, releaseAfterMs = 0): void {
  fireEvent.pointerDown(target, { pointerId: 1, pointerType: "touch", clientY: 100 });
  for (const move of moves) {
    vi.advanceTimersByTime(move.afterMs);
    fireEvent.pointerMove(target, { pointerId: 1, pointerType: "touch", clientY: 100 + move.dy });
  }
  vi.advanceTimersByTime(releaseAfterMs);
  const lastDy = moves.at(-1)?.dy ?? 0;
  fireEvent.pointerUp(target, { pointerId: 1, pointerType: "touch", clientY: 100 + lastDy });
}

describe("SheetContent のスワイプで閉じる操作", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "performance", "setTimeout", "clearTimeout"] });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(SHEET_HEIGHT);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("ボトムシートの上端につまみを表示する", () => {
    const { dialog } = renderSheet();

    expect(dialog.querySelector("[data-sheet-grabber]")).not.toBeNull();
  });

  it("タイトル行をシートの高さの4分の1以上下げて離すと閉じる", () => {
    const { onOpenChange } = renderSheet();

    drag(screen.getByText("シート見出し"), [{ dy: 150, afterMs: 400 }], 300);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("少しだけゆっくり下げて離すと閉じずに元の位置へ戻る", () => {
    const { onOpenChange, dialog } = renderSheet();

    drag(screen.getByText("シート見出し"), [{ dy: 40, afterMs: 400 }], 300);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("");
  });

  it("距離が短くても素早く下へ払うと閉じる", () => {
    const { onOpenChange } = renderSheet();

    drag(screen.getByText("シート見出し"), [{ dy: 10, afterMs: 50 }, { dy: 60, afterMs: 50 }]);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ドラッグ中は指の位置に合わせてシートを下へずらす", () => {
    const { dialog } = renderSheet();
    const header = screen.getByText("シート見出し");

    fireEvent.pointerDown(header, { pointerId: 1, pointerType: "touch", clientY: 100 });
    vi.advanceTimersByTime(50);
    fireEvent.pointerMove(header, { pointerId: 1, pointerType: "touch", clientY: 180 });

    expect(dialog.style.transform).toBe("translateY(80px)");
  });

  it("本文（スクロール領域）から始めた操作では閉じない", () => {
    const { onOpenChange, dialog } = renderSheet();

    drag(screen.getByRole("button", { name: "本文のボタン" }), [{ dy: 300, afterMs: 50 }]);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("");
  });

  it("上方向へ動かした場合は閉じない", () => {
    const { onOpenChange } = renderSheet();

    drag(screen.getByText("シート見出し"), [{ dy: -200, afterMs: 50 }]);

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("ブラウザに操作を奪われた（pointercancel）ときは閉じずに戻す", () => {
    const { onOpenChange, dialog } = renderSheet();
    const header = screen.getByText("シート見出し");

    fireEvent.pointerDown(header, { pointerId: 1, pointerType: "touch", clientY: 100 });
    vi.advanceTimersByTime(50);
    fireEvent.pointerMove(header, { pointerId: 1, pointerType: "touch", clientY: 350 });
    fireEvent.pointerCancel(header, { pointerId: 1, pointerType: "touch", clientY: 350 });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("");
  });

  it("右側のシートではつまみを出さず、スワイプでも閉じない", () => {
    const { onOpenChange, dialog } = renderSheet("right");

    drag(screen.getByText("シート見出し"), [{ dy: 300, afterMs: 50 }]);

    expect(dialog.querySelector("[data-sheet-grabber]")).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
