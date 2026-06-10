import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StoredStateV1 } from "../domain/types";
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
    onUpdateCharacterPurePiece: vi.fn(),
    initialSettings: buildDefaultInputViewSettings(),
    onSettingsChange: vi.fn(),
    settingsSyncToken: 0,
  };
}

// 検索入力欄の要素を取得する。
function getSearchInput(): HTMLInputElement {
  return screen.getByPlaceholderText("例: ヒヨリ") as HTMLInputElement;
}

// 詳細設定を開いて内部入力欄へアクセスできる状態にする。
function openDetailSettings(): void {
  fireEvent.click(screen.getByRole("button", { name: "詳細設定" }));
}

// 表示中テーブルの先頭データ行に含まれるキャラ名を取得する。
function getFirstBodyRowName(characterNames: string[]): string {
  const firstBodyRow = screen.getAllByRole("row")[1];
  expect(firstBodyRow).toBeDefined();
  const matchedName = characterNames.find((name) => firstBodyRow?.textContent?.includes(name));
  expect(matchedName).toBeDefined();
  return matchedName as string;
}

// 指定キャラの所持メモピだけを差し替えたテスト用stateを生成する。
function buildStateWithMemoryPieces(baseState: StoredStateV1, memoryPieceByName: Record<string, number>): StoredStateV1 {
  const nextProgressByName = { ...baseState.progressByName };
  for (const [name, ownedMemoryPiece] of Object.entries(memoryPieceByName)) {
    const progress = nextProgressByName[name];
    if (!progress) {
      continue;
    }
    nextProgressByName[name] = { ...progress, ownedMemoryPiece };
  }
  return { ...baseState, progressByName: nextProgressByName };
}

describe("InputTab", () => {
  it("検索欄のリセットボタンで文字列を空へ戻せる", async () => {
    const props = buildProps();
    render(<InputTab {...props} />);

    fireEvent.change(getSearchInput(), { target: { value: "ユイ" } });
    await waitFor(() => {
      expect(getSearchInput().value).toBe("ユイ");
    });

    fireEvent.click(screen.getAllByRole("button", { name: "リセット" })[0] as HTMLButtonElement);

    expect(getSearchInput().value).toBe("");
  });

  it("詳細設定は初期表示で閉じており、クリックで展開できる", () => {
    const props = buildProps();
    render(<InputTab {...props} />);

    expect(screen.getByPlaceholderText("例: ヒヨリ")).toBeInTheDocument();
    expect(screen.queryByText("必要メモピ/ハートの欠片計算")).not.toBeInTheDocument();

    openDetailSettings();

    expect(screen.getByText("必要メモピ/ハートの欠片計算")).toBeInTheDocument();
  });

  it("詳細フィルタ未適用時はフィルタ適用中バッジを表示しない", () => {
    const props = buildProps();
    render(<InputTab {...props} />);

    expect(screen.queryByText("フィルタ適用中")).not.toBeInTheDocument();
  });

  it("詳細設定を閉じていて詳細フィルタ適用中ならバッジを表示する", () => {
    const props = buildProps();
    const initialSettings = { ...props.initialSettings, ownedFilter: "owned" as const };
    render(<InputTab {...props} initialSettings={initialSettings} />);

    expect(screen.getByText("フィルタ適用中")).toBeInTheDocument();
  });

  it("詳細設定を開いている間はフィルタ適用中バッジを表示しない", () => {
    const props = buildProps();
    const initialSettings = { ...props.initialSettings, isDetailSettingsOpen: true, ownedFilter: "owned" as const };
    render(<InputTab {...props} initialSettings={initialSettings} />);

    expect(screen.queryByText("フィルタ適用中")).not.toBeInTheDocument();
  });

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

    const nextSettings = { ...props.initialSettings, searchText: "", isDetailSettingsOpen: true };
    rerender(<InputTab {...props} initialSettings={nextSettings} settingsSyncToken={1} />);

    await waitFor(() => {
      expect(getSearchInput().value).toBe("");
    });
  });

  it("検索入力はデバウンス経過後に表示件数へ反映される", async () => {
    vi.useFakeTimers();
    try {
      const props = buildProps();
      render(<InputTab {...props} />);

      expect(screen.getByText("表示件数: 5")).toBeInTheDocument();

      fireEvent.change(getSearchInput(), { target: { value: "一致しない検索語" } });

      expect(screen.getByText("表示件数: 5")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(screen.getByText("表示件数: 0")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("settingsSyncToken更新時は詳細設定の開閉状態も再同期する", async () => {
    const props = buildProps();
    const { rerender } = render(<InputTab {...props} />);

    openDetailSettings();
    expect(screen.getByText("必要メモピ/ハートの欠片計算")).toBeInTheDocument();

    const nextSettings = { ...props.initialSettings, isDetailSettingsOpen: false };
    rerender(<InputTab {...props} initialSettings={nextSettings} settingsSyncToken={1} />);

    await waitFor(() => {
      expect(screen.queryByText("必要メモピ/ハートの欠片計算")).not.toBeInTheDocument();
    });
  });

  it("テーブル値が変わっても手動適用までは現在のソート順を維持する", () => {
    const props = buildProps();
    const characterNames = props.masterCharacters.slice(0, 2).map((character) => character.name);
    const [firstName, secondName] = characterNames;
    expect(firstName).toBeDefined();
    expect(secondName).toBeDefined();
    const initialState = buildStateWithMemoryPieces(props.state, {
      [firstName as string]: 100,
      [secondName as string]: 0,
    });
    const updatedState = buildStateWithMemoryPieces(initialState, {
      [firstName as string]: 0,
      [secondName as string]: 999,
    });
    const initialSettings = {
      ...props.initialSettings,
      isDetailSettingsOpen: true,
      sortKey: "ownedMemoryPiece" as const,
      sortDirection: "desc" as const,
    };
    const { rerender } = render(<InputTab {...props} state={initialState} initialSettings={initialSettings} />);

    expect(getFirstBodyRowName(characterNames)).toBe(firstName);

    rerender(<InputTab {...props} state={updatedState} initialSettings={initialSettings} />);

    expect(getFirstBodyRowName(characterNames)).toBe(firstName);

    fireEvent.click(screen.getByRole("button", { name: "表示に適用" }));

    expect(getFirstBodyRowName(characterNames)).toBe(secondName);
  });
});
