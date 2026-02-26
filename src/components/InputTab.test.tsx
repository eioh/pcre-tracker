import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildInitialState } from "../domain/storage";
import { buildDefaultInputViewSettings } from "../domain/uiStorage";
import { masterCharacters } from "../domain/master";
import { InputTab } from "./InputTab";

// InputTabテスト用の共通propsを生成する。
function buildProps() {
  const testMasterCharacters = masterCharacters.slice(0, 5);
  return {
    masterCharacters: testMasterCharacters,
    state: buildInitialState(testMasterCharacters),
    onUpdateProgress: vi.fn(),
    initialSettings: buildDefaultInputViewSettings(),
    onSettingsChange: vi.fn(),
    settingsSyncToken: 0,
  };
}

// 検索入力欄の要素を取得する。
function getSearchInput(): HTMLInputElement {
  return screen.getByPlaceholderText("例: ヒヨリ") as HTMLInputElement;
}

describe("InputTab", () => {
  it("settingsSyncTokenが変わらない限りinitialSettings変更ではローカル入力を維持する", async () => {
    const props = buildProps();
    const { rerender } = render(<InputTab {...props} />);

    fireEvent.change(getSearchInput(), { target: { value: "ユイ" } });
    await waitFor(() => {
      expect(getSearchInput().value).toBe("ユイ");
    });

    const nextSettings = { ...props.initialSettings, searchText: "ヒヨリ" };
    rerender(<InputTab {...props} initialSettings={nextSettings} settingsSyncToken={0} />);

    expect(getSearchInput().value).toBe("ユイ");
  });

  it("settingsSyncToken更新時はinitialSettingsでローカル入力を再同期する", async () => {
    const props = buildProps();
    const { rerender } = render(<InputTab {...props} />);

    fireEvent.change(getSearchInput(), { target: { value: "ユイ" } });
    await waitFor(() => {
      expect(getSearchInput().value).toBe("ユイ");
    });

    const nextSettings = { ...props.initialSettings, searchText: "" };
    rerender(<InputTab {...props} initialSettings={nextSettings} settingsSyncToken={1} />);

    await waitFor(() => {
      expect(getSearchInput().value).toBe("");
    });
  });
});
