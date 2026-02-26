import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileImportButton } from "./file-import-button";

// FileImportButtonの初期propsを生成する。
function buildProps() {
  return {
    label: "インポート",
    accept: "application/json,.json",
    onSelectFile: vi.fn<(file: File) => void>(),
  };
}

describe("FileImportButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ボタン押下でファイル選択inputのclickを呼び出す", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const props = buildProps();
    render(<FileImportButton {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "インポート" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("ファイル選択時にonSelectFileへ選択ファイルを渡す", () => {
    const props = buildProps();
    const { container } = render(<FileImportButton {...props} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    expect(fileInput).not.toBeNull();
    if (!fileInput) {
      throw new Error("file input not found in DOM");
    }

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(props.onSelectFile).toHaveBeenCalledWith(file);
  });
});
