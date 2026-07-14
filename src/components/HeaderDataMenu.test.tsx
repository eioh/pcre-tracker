import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderDataMenu } from "./HeaderDataMenu";

// HeaderDataMenu の初期 props を生成する。
function buildProps() {
  return {
    onExport: vi.fn(),
    onSelectImportFile: vi.fn<(file: File) => void>(),
    onRequestReset: vi.fn(),
    updatedAtLabel: "2026/7/15 12:00:00",
  };
}

// トリガーの「データ」ボタンからメニューを展開する。
// jsdom は PointerEvent 未実装で pointerdown 経由では開けないため、キーボード操作（Enter）で開く。
function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: /データ/ }), { key: "Enter" });
}

describe("HeaderDataMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("メニュー展開でエクスポート・インポート・初期化の3項目と最終更新が表示される", () => {
    const props = buildProps();
    render(<HeaderDataMenu {...props} />);

    openMenu();

    expect(screen.getByRole("menuitem", { name: "エクスポート" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "インポート" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "保存データを初期化" })).toBeInTheDocument();
    expect(screen.getByText("最終更新: 2026/7/15 12:00:00")).toBeInTheDocument();
  });

  it("エクスポート項目の選択で onExport が発火する", () => {
    const props = buildProps();
    render(<HeaderDataMenu {...props} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "エクスポート" }));

    expect(props.onExport).toHaveBeenCalledTimes(1);
  });

  it("初期化項目の選択で onRequestReset が発火する", () => {
    const props = buildProps();
    render(<HeaderDataMenu {...props} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "保存データを初期化" }));

    expect(props.onRequestReset).toHaveBeenCalledTimes(1);
  });

  it("インポート項目の選択で hidden file input の click が呼ばれる", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const props = buildProps();
    render(<HeaderDataMenu {...props} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "インポート" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("ファイル選択で onSelectImportFile へ選択ファイルが渡り value がリセットされる", () => {
    const props = buildProps();
    const { container } = render(<HeaderDataMenu {...props} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    expect(fileInput).not.toBeNull();
    if (!fileInput) {
      throw new Error("file input not found in DOM");
    }

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(props.onSelectImportFile).toHaveBeenCalledWith(file);
    // 同一ファイルの再選択に備えて value がリセットされる。
    expect(fileInput.value).toBe("");
  });

  it("hidden file input はメニューコンテンツの外にあり、メニュー閉鎖後も残る", () => {
    const props = buildProps();
    const { container } = render(<HeaderDataMenu {...props} />);

    // メニュー未展開（= コンテンツ未マウント）でも input が存在する。
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });
});
