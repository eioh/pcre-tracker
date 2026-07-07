import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

// ラベルに対応するセレクトを開き、指定した表示名の項目を選択する。
function selectComboboxOption(label: string, optionLabel: string): void {
  const labelElement = screen.getAllByText(label).find((element) => element.tagName.toLowerCase() === "label");
  expect(labelElement).toBeDefined();
  const field = labelElement?.closest("div");
  expect(field).not.toBeNull();
  fireEvent.click(within(field as HTMLElement).getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
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

// 指定キャラの所持状態だけを差し替えたテスト用stateを生成する。
function buildStateWithOwnedFlags(baseState: StoredStateV1, ownedByName: Record<string, boolean>): StoredStateV1 {
  const nextProgressByName = { ...baseState.progressByName };
  for (const [name, owned] of Object.entries(ownedByName)) {
    const progress = nextProgressByName[name];
    if (!progress) {
      continue;
    }
    nextProgressByName[name] = { ...progress, owned };
  }
  return { ...baseState, progressByName: nextProgressByName };
}

// モバイル判定（max-width: 767px）へ常にマッチする matchMedia のスタブを生成する。
function stubMobileMatchMedia(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );
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

  it("詳細設定のフィルタ変更は表示に適用ボタンなしでテーブルへ反映される", () => {
    const props = buildProps();
    const [ownedCharacter, unownedCharacter] = props.masterCharacters;
    expect(ownedCharacter).toBeDefined();
    expect(unownedCharacter).toBeDefined();
    const ownedByName = Object.fromEntries(props.masterCharacters.map((character) => [character.name, false]));
    const state = buildStateWithOwnedFlags(props.state, { ...ownedByName, [ownedCharacter?.name ?? ""]: true });
    render(<InputTab {...props} state={state} />);

    expect(screen.getByText("表示件数: 5")).toBeInTheDocument();

    openDetailSettings();
    selectComboboxOption("所持", "所持のみ");

    expect(screen.getByText("表示件数: 1")).toBeInTheDocument();
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

  it("デスクトップ幅ではテーブルレイアウトを表示しモバイル一覧は出さない", () => {
    // setup.ts の matchMedia スタブは常に非マッチ（= デスクトップ扱い）を返す。
    const props = buildProps();
    render(<InputTab {...props} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /の編集シートを開く/ })).not.toBeInTheDocument();
  });

  it("モバイル幅では一覧レイアウトを表示しテーブルは出さない", () => {
    stubMobileMatchMedia();
    try {
      const props = buildProps();
      render(<InputTab {...props} />);

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /の編集シートを開く/ }).length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("モバイル幅ではフィルタボタンのタップでフィルタシートが開き詳細設定パネルは出さない", () => {
    stubMobileMatchMedia();
    try {
      const props = buildProps();
      render(<InputTab {...props} />);

      // モバイルでは詳細設定パネル（開閉ボタン）をレンダリングしない。
      expect(screen.queryByRole("button", { name: "詳細設定" })).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "フィルタ" }));

      expect(screen.getByRole("dialog", { name: "絞り込みと表示設定" })).toBeInTheDocument();
      // シート内にフィルタと計算モードの両設定が表示される。
      expect(screen.getByText("必要メモピ/ハートの欠片計算")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("モバイル幅では所持のみチップのタップで絞り込みと再タップ解除ができる", () => {
    stubMobileMatchMedia();
    try {
      const props = buildProps();
      const [ownedCharacter] = props.masterCharacters;
      expect(ownedCharacter).toBeDefined();
      const ownedByName = Object.fromEntries(props.masterCharacters.map((character) => [character.name, false]));
      const state = buildStateWithOwnedFlags(props.state, { ...ownedByName, [ownedCharacter?.name ?? ""]: true });
      render(<InputTab {...props} state={state} />);

      expect(screen.getByText("表示件数: 5")).toBeInTheDocument();

      const ownedChip = screen.getByRole("button", { name: "所持のみ" });
      fireEvent.click(ownedChip);

      expect(ownedChip).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("表示件数: 1")).toBeInTheDocument();

      fireEvent.click(ownedChip);

      expect(ownedChip).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText("表示件数: 5")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("モバイル幅では所持のみと未所持のみチップが相互排他で切り替わる", () => {
    stubMobileMatchMedia();
    try {
      const props = buildProps();
      const [ownedCharacter] = props.masterCharacters;
      expect(ownedCharacter).toBeDefined();
      const ownedByName = Object.fromEntries(props.masterCharacters.map((character) => [character.name, false]));
      const state = buildStateWithOwnedFlags(props.state, { ...ownedByName, [ownedCharacter?.name ?? ""]: true });
      render(<InputTab {...props} state={state} />);

      const ownedChip = screen.getByRole("button", { name: "所持のみ" });
      const unownedChip = screen.getByRole("button", { name: "未所持のみ" });

      fireEvent.click(ownedChip);
      expect(ownedChip).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(unownedChip);

      expect(unownedChip).toHaveAttribute("aria-pressed", "true");
      expect(ownedChip).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText("表示件数: 4")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("モバイル幅ではフィルタ適用数がフィルタボタンのバッジへ表示される", () => {
    stubMobileMatchMedia();
    try {
      const props = buildProps();
      const initialSettings = {
        ...props.initialSettings,
        ownedFilter: "owned" as const,
        limitedFilter: "limited" as const,
      };
      render(<InputTab {...props} initialSettings={initialSettings} />);

      const filterButton = screen.getByRole("button", { name: /フィルタ/ });
      expect(within(filterButton).getByText("2")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("モバイル幅ではシート内リセットでフィルタ適用バッジが消える", () => {
    stubMobileMatchMedia();
    try {
      const props = buildProps();
      const initialSettings = { ...props.initialSettings, ownedFilter: "owned" as const };
      render(<InputTab {...props} initialSettings={initialSettings} />);

      const filterButton = screen.getByRole("button", { name: /フィルタ/ });
      const ownedChip = screen.getByRole("button", { name: "所持のみ" });
      expect(within(filterButton).getByText("1")).toBeInTheDocument();
      // チップとシート内 Select は同一 state のため、初期設定の所持フィルタがチップにも反映される。
      expect(ownedChip).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(filterButton);
      const dialog = screen.getByRole("dialog", { name: "絞り込みと表示設定" });
      fireEvent.click(within(dialog).getByRole("button", { name: "リセット" }));

      // シート表示中は外側が aria-hidden になるため、保持済みの要素参照で属性を検証する。
      expect(within(filterButton).queryByText("1")).not.toBeInTheDocument();
      expect(ownedChip).toHaveAttribute("aria-pressed", "false");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
