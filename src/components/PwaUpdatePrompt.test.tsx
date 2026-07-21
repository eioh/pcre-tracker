import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PwaUpdatePrompt, PwaUpdatePromptView } from "./PwaUpdatePrompt";

describe("PwaUpdatePromptView", () => {
  it("needRefresh が true のときバナーを表示する", () => {
    render(<PwaUpdatePromptView needRefresh flushPendingSave={vi.fn()} applyUpdate={vi.fn()} />);

    expect(screen.getByText("新しいバージョンがあります")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
  });

  it("needRefresh が false のときは何も描画しない", () => {
    const { container } = render(
      <PwaUpdatePromptView needRefresh={false} flushPendingSave={vi.fn()} applyUpdate={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("「更新」押下で flushPendingSave → applyUpdate の順で呼ばれる", () => {
    // 呼び出し順を記録し、保存 flush が更新適用より先に実行されることを検証する。
    const calls: string[] = [];
    const flushPendingSave = vi.fn(() => calls.push("flush"));
    const applyUpdate = vi.fn(() => calls.push("apply"));
    render(<PwaUpdatePromptView needRefresh flushPendingSave={flushPendingSave} applyUpdate={applyUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    expect(flushPendingSave).toHaveBeenCalledTimes(1);
    expect(applyUpdate).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["flush", "apply"]);
  });

  it("「後で」押下でバナーが消える", () => {
    render(<PwaUpdatePromptView needRefresh flushPendingSave={vi.fn()} applyUpdate={vi.fn()} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "後で" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("閉じる（×）押下でバナーが消え、更新は適用されない", () => {
    const applyUpdate = vi.fn();
    render(<PwaUpdatePromptView needRefresh flushPendingSave={vi.fn()} applyUpdate={applyUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(applyUpdate).not.toHaveBeenCalled();
  });
});

describe("PwaUpdatePrompt", () => {
  it("非 PROD 環境ではバナーを描画しない", () => {
    // vitest では import.meta.env.PROD が false のため SW 配線の useEffect が早期 return し、
    // needRefresh が立たずバナーは表示されない（この検証は描画結果のみを対象とする）。
    const { container } = render(<PwaUpdatePrompt flushPendingSave={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
