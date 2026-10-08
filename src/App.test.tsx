import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { LocalStorageBackupV1 } from "./domain/backup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// useSync をモックし、セッションや同期ロジックに依存せず App のルーティングを検証する。
const mockUseSync = vi.fn();
// App が useSync へ渡した options の捕捉先。テストから onServerDataAdopted（サーバーデータ採用
// コールバック）を直接呼び、「localStorage 直接書き換え → 採用通知」のフローを再現するために使う。
let capturedUseSyncOptions: { onServerDataAdopted: () => void; onLocalDataCleared: () => void } | null = null;
vi.mock("./hooks/useSync", () => ({
  useSync: (options: { onServerDataAdopted: () => void; onLocalDataCleared: () => void }) => {
    capturedUseSyncOptions = options;
    return mockUseSync();
  },
}));

// authClient はログイン UI が参照するためスタブ化する（実 API を呼ばせない）。
vi.mock("./lib/authClient", () => ({
  authClient: { deleteUser: vi.fn() },
  signIn: { social: vi.fn() },
  signOut: vi.fn(),
}));

// バックアップ適用の失敗を注入できるようにするための差し替え口。既定では実実装へ委譲し、
// 「インポート適用失敗時に保留中の編集が失われないこと」のテストでのみ throw に差し替える。
const { mockApplyBackupPayloadToLocalStorage } = vi.hoisted(() => ({
  mockApplyBackupPayloadToLocalStorage: vi.fn<(payload: LocalStorageBackupV1) => void>(),
}));
vi.mock("./domain/backup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./domain/backup")>();
  mockApplyBackupPayloadToLocalStorage.mockImplementation(actual.applyBackupPayloadToLocalStorage);
  return {
    ...actual,
    applyBackupPayloadToLocalStorage: mockApplyBackupPayloadToLocalStorage,
  };
});

import App from "./App";
import { STORAGE_KEY, buildInitialState } from "./domain/storage";
import { masterCharacters } from "./domain/master";
import { createClanBattleFormation, createClanBattleMonthGroup } from "./domain/clanBattle";
import { UI_STORAGE_KEY } from "./domain/uiStorage";
import type { UseSyncResult } from "./hooks/useSync";
import { isDeviceDataEpochCurrent } from "./domain/deviceData";
import { DEVICE_DATA_EPOCH_STORAGE_KEY } from "./domain/storageKeys";

// useSync の戻り値を未ログイン・同期なしの静的値に固定する（overrides で一部を差し替えられる）。
function stubSync(overrides: Partial<UseSyncResult> = {}): UseSyncResult {
  const value: UseSyncResult = {
    isLoggedIn: false,
    isSessionPending: false,
    userLabel: null,
    status: "logged_out",
    conflict: null,
    notifyLocalChange: vi.fn(),
    notifyLocalDataImported: vi.fn(),
    resolveConflictUseServer: vi.fn(),
    resolveConflictUseLocal: vi.fn(async () => {}),
    stopSync: vi.fn(),
    accountSwitch: null,
    isAccountSwitchBusy: false,
    resolveAccountSwitchCarryOver: vi.fn(async () => {}),
    resolveAccountSwitchDiscard: vi.fn(),
    cancelAccountSwitchAndSignOut: vi.fn(async () => {}),
    hasUnsyncedChanges: vi.fn(() => false),
    ...overrides,
  };
  mockUseSync.mockReturnValue(value);
  return value;
}

// テスト内でパス名を差し替えるヘルパー（history.pushState では jsdom の pathname が変わる）。
function setPathname(pathname: string) {
  window.history.pushState(null, "", pathname);
}

// モバイル幅（768px 未満）でマッチする matchMedia スタブへ差し替える。
function stubMobileMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  // jsdomにページスクロールの実装はないため、画面切り替え時の呼び出しをスタブする。
  vi.stubGlobal("scrollTo", vi.fn());
  mockUseSync.mockReset();
  capturedUseSyncOptions = null;
  stubSync();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setPathname("/");
});

describe("App: プライバシーポリシーのルーティング", () => {
  it("/privacy パスではプライバシーポリシーページを描画する", () => {
    setPathname("/privacy");
    render(<App />);

    expect(screen.getByRole("heading", { name: "プライバシーポリシー" })).toBeInTheDocument();
    // 通常のアプリ見出し（育成トラッカー）は描画されない。
    expect(screen.queryByRole("heading", { name: "育成トラッカー" })).not.toBeInTheDocument();
  });

  it("通常パスではフッターにプライバシーポリシーへの導線がある", () => {
    setPathname("/");
    render(<App />);

    expect(screen.getByRole("heading", { name: "育成トラッカー" })).toBeInTheDocument();
    // フッターのポリシーリンク。
    expect(screen.getByRole("button", { name: "プライバシーポリシー" })).toBeInTheDocument();
  });
});

describe("App: タブナビゲーション", () => {
  // 遅延読み込みタブを2つ（育成入力→ダッシュボード）待つため、テスト全体のタイムアウトを延長する。
  it("モバイルでは短縮ラベルの下部ナビを描画し、タブ切替後も育成入力が DOM に残る", { timeout: 20_000 }, async () => {
    stubMobileMatchMedia();
    // jsdom 未実装の window.scrollTo（仮想化リストが呼ぶ）をスタブし、エラーログを抑止する。
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);

    // 短縮ラベルのタブが存在する（フルラベルと文字列が変わる3件で検証する）。
    expect(screen.getByRole("tab", { name: "集計" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "クラバト" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "ランク計算" })).toBeInTheDocument();
    // デスクトップ用のフルラベルのタブは描画されない。
    expect(screen.queryByRole("tab", { name: "ダッシュボード" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "クラバト編成" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "コネクトランク計算" })).not.toBeInTheDocument();

    // 初期タブ（育成入力）のモバイル一覧が表示されるまで待つ。
    await screen.findAllByRole("button", { name: /の編集シートを開く$/ }, { timeout: 10_000 });

    // 「集計」タップでダッシュボードが表示される（遅延読み込みのため待機する）。
    // Radix Tabs の Trigger は mousedown で選択されるため fireEvent.mouseDown を使う。
    fireEvent.mouseDown(screen.getByRole("tab", { name: "集計" }));
    expect(await screen.findByRole("heading", { name: "進捗ダッシュボード" }, { timeout: 10_000 })).toBeInTheDocument();

    // forceMount 維持: タブ切替後も育成入力のコンテンツが DOM に残る（再マウント回避）。
    expect(screen.getAllByRole("button", { name: /の編集シートを開く$/ }).length).toBeGreaterThan(0);
  });

  it("デスクトップでは従来のフルラベルの上部タブを描画し、下部ナビは描画しない", () => {
    render(<App />);

    // 従来のフルラベルのタブが存在する。
    expect(screen.getByRole("tab", { name: "ダッシュボード" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "クラバト編成" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "コネクトランク計算" })).toBeInTheDocument();
    // モバイル用の短縮ラベルのタブは描画されない。
    expect(screen.queryByRole("tab", { name: "集計" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "ランク計算" })).not.toBeInTheDocument();
  });
});

describe("App: クラバト編成の選択保持", () => {
  // タブ切替で TabsContent がアンマウントされても、選択した編成（とその月の展開）が復元されることを確認する。
  it("既定以外の編成を選択してタブを往復しても同じ編成が選択されたままになる", { timeout: 20_000 }, async () => {
    const olderFormation = createClanBattleFormation("古い月の編成");
    const newerFormation = createClanBattleFormation("新しい月の編成");
    const state = {
      ...buildInitialState(masterCharacters),
      clanBattle: {
        groups: [
          { ...createClanBattleMonthGroup(2020, 1), formations: [olderFormation] },
          { ...createClanBattleMonthGroup(2020, 2), formations: [newerFormation] },
        ],
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeTab: "clan_battle" }));
    render(<App />);

    // 既定では最新月（2020年2月）の編成が選択される。
    expect(await screen.findByDisplayValue("新しい月の編成", {}, { timeout: 10_000 })).toBeInTheDocument();

    // 古い月を展開して既定以外の編成を選択する。
    fireEvent.click(screen.getByRole("button", { name: /2020年1月/, expanded: false }));
    fireEvent.click(screen.getByRole("button", { name: "古い月の編成" }));
    expect(screen.getByDisplayValue("古い月の編成")).toBeInTheDocument();

    // 別タブへ切り替えるとクラバト編成タブはアンマウントされる。
    fireEvent.mouseDown(screen.getByRole("tab", { name: "ダッシュボード" }));
    expect(await screen.findByRole("heading", { name: "進捗ダッシュボード" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("古い月の編成")).not.toBeInTheDocument();

    // 戻ると同じ編成が選択され、その月が展開されている。
    fireEvent.mouseDown(screen.getByRole("tab", { name: "クラバト編成" }));
    expect(await screen.findByDisplayValue("古い月の編成", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2020年1月/, expanded: true })).toBeInTheDocument();
  });
});

describe("App: 画面切り替え時のページスクロール", () => {
  it.each([false, true])("別画面へ切り替えると先頭へ戻り、同じ画面では位置を変えない（mobile=%s）", async (isMobile) => {
    if (isMobile) {
      stubMobileMatchMedia();
    }
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    // 仮想化リストの独自スクロールと区別するため、ショップから開始する。
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeTab: "coin_shop" }));
    render(<App />);
    await screen.findByRole("tab", { name: "ダンジョン" }, { timeout: 10_000 });
    expect(scrollTo).not.toHaveBeenCalled();

    vi.stubGlobal("scrollY", 2396);
    fireEvent.mouseDown(screen.getByRole("tab", { name: isMobile ? "集計" : "ダッシュボード" }));
    await screen.findByRole("heading", { name: "進捗ダッシュボード" }, { timeout: 10_000 });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });

    scrollTo.mockClear();
    fireEvent.mouseDown(screen.getByRole("tab", { name: isMobile ? "集計" : "ダッシュボード" }));
    expect(scrollTo).not.toHaveBeenCalled();

    // 往復時も別画面の位置を復元せず、先頭へ戻す。
    fireEvent.mouseDown(screen.getByRole("tab", { name: "ショップ" }));
    await screen.findByRole("tab", { name: "ダンジョン" });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
  });
});

describe("App: モバイル編集シートの保存インジケータ", () => {
  it("編集直後は保存中を表示し、debounce保存後に保存済みへ戻る", async () => {
    stubMobileMatchMedia();
    // jsdom 未実装の window.scrollTo（仮想化リストが呼ぶ）をスタブし、エラーログを抑止する。
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);

    // 遅延読み込みの育成入力タブ（モバイル一覧）が表示されるまで待ち、先頭行の編集シートを開く。
    // lazy import の初回変換に時間がかかる場合があるため、待機時間を長めに取る。
    const openRowButtons = await screen.findAllByRole("button", { name: /の編集シートを開く$/ }, { timeout: 10_000 });
    fireEvent.click(openRowButtons[0]!);
    const dialog = screen.getByRole("dialog");

    // マウント直後の書き戻し保存では「保存中」を出さず、既定の「保存済み」を表示する。
    expect(within(dialog).getByText("保存済み ✓")).toBeInTheDocument();

    // 編集直後はローカル保存（400ms debounce）の完了待ちのため「保存中」を表示する。
    fireEvent.click(within(dialog).getByRole("button", { name: /の所持メモピ数を増やす$/ }));
    expect(within(dialog).getByText("保存中...")).toBeInTheDocument();

    // debounce 保存の完了で「保存済み」へ戻る。未ログインのため同期系文言は表示しない。
    expect(await within(dialog).findByText("保存済み ✓")).toBeInTheDocument();
    expect(within(dialog).queryByText("同期中...")).toBeNull();
    expect(within(dialog).queryByText("同期エラー")).toBeNull();
  });
});

describe("App: pagehide での防御的 flush", () => {
  // 遅延読み込みタブの表示待ちがあるため、テスト全体のタイムアウトを延長する。
  it("保留中の編集がある状態で pagehide が発火すると最新 state を localStorage へ保存する", { timeout: 20_000 }, async () => {
    stubMobileMatchMedia();
    // jsdom 未実装の window.scrollTo（仮想化リストが呼ぶ）をスタブし、エラーログを抑止する。
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);

    // 遅延読み込みの育成入力タブ（モバイル一覧）が表示されるまで待ち、先頭行の編集シートを開く。
    const openRowButtons = await screen.findAllByRole("button", { name: /の編集シートを開く$/ }, { timeout: 10_000 });
    fireEvent.click(openRowButtons[0]!);
    const dialog = screen.getByRole("dialog");

    // 編集直後（400ms debounce の完了前）に pagehide を発火させる。
    fireEvent.click(within(dialog).getByRole("button", { name: /の所持メモピ数を増やす$/ }));
    fireEvent(window, new Event("pagehide"));

    // 保留中の編集（メモピ 0 → 1）を含む最新 state が同期 flush で保存されている。
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { progressByName: Record<string, { ownedMemoryPiece: number }> };
    expect(Object.values(saved.progressByName).some((progress) => progress.ownedMemoryPiece === 1)).toBe(true);
  });

  it("保留中の編集がなければ pagehide で localStorage を上書きしない（インポート採用データの保護）", async () => {
    // jsdom 未実装の window.scrollTo（仮想化リストが呼ぶ）をスタブし、エラーログを抑止する。
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);

    // 初回マウントの書き戻し保存（400ms debounce）が完了し、保留なしの安定状態になるまで待つ。
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull(), { timeout: 3_000 });

    // インポート/サーバーデータ採用相当: localStorage を直接更新する（in-memory state は旧データのまま）。
    const adoptedPayload = JSON.stringify({ marker: "imported" });
    window.localStorage.setItem(STORAGE_KEY, adoptedPayload);

    // リロード時に発火する pagehide でも、保留中の編集がなければ flush されず採用データが残る。
    fireEvent(window, new Event("pagehide"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(adoptedPayload);
  });
});

describe("App: localStorage 直接書き換えフローでの保留保存キャンセル", () => {
  // モバイル編集シートで1件編集し、debounce 保存（400ms）が保留中の状態を作る共通セットアップ。
  async function renderAndMakePendingEdit() {
    stubMobileMatchMedia();
    // jsdom 未実装の window.scrollTo（仮想化リストが呼ぶ）をスタブし、エラーログを抑止する。
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);
    const openRowButtons = await screen.findAllByRole("button", { name: /の編集シートを開く$/ }, { timeout: 10_000 });
    fireEvent.click(openRowButtons[0]!);
    const dialog = screen.getByRole("dialog");
    // 編集して debounce 保存を保留中（400ms 窓内）にする。
    fireEvent.click(within(dialog).getByRole("button", { name: /の所持メモピ数を増やす$/ }));
  }

  // サーバーデータ採用フローを再現する: useSync（adoptServerPayload）が localStorage を直接
  // 書き換えた直後に onServerDataAdopted を同期的に呼ぶ実装と同じ順序で実行する。
  function adoptServerData(adoptedPayload: string) {
    window.localStorage.setItem(STORAGE_KEY, adoptedPayload);
    expect(capturedUseSyncOptions).not.toBeNull();
    act(() => {
      capturedUseSyncOptions!.onServerDataAdopted();
    });
  }

  it("保留中の編集があっても、採用後の pagehide は採用データを上書きしない", { timeout: 20_000 }, async () => {
    await renderAndMakePendingEdit();

    const adoptedPayload = JSON.stringify({ marker: "server-adopted" });
    adoptServerData(adoptedPayload);

    // 採用完了ダイアログが表示される（採用フローが実際に走った証跡）。
    expect(screen.getByText("サーバーのデータを反映しました")).toBeInTheDocument();

    // 採用時に保留保存がキャンセルされているため、リロード時の pagehide でも上書きされない。
    fireEvent(window, new Event("pagehide"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(adoptedPayload);
  });

  it("保留中の編集があっても、採用後に debounce タイマーが満了する時間が経過しても採用データを上書きしない", { timeout: 20_000 }, async () => {
    await renderAndMakePendingEdit();

    const adoptedPayload = JSON.stringify({ marker: "server-adopted" });
    adoptServerData(adoptedPayload);

    // 採用時にタイマー自体がキャンセルされているため、400ms の debounce 満了時刻を過ぎても
    // 旧 in-memory state の保存は実行されない（キャンセルが無ければここで上書きされる）。
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(adoptedPayload);
  });

  it("インポート適用が失敗した場合、保留中の編集は引き続き保存される", { timeout: 20_000 }, async () => {
    stubMobileMatchMedia();
    // jsdom 未実装の window.scrollTo（仮想化リストが呼ぶ）をスタブし、エラーログを抑止する。
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);
    await screen.findAllByRole("button", { name: /の編集シートを開く$/ }, { timeout: 10_000 });

    // 適用処理の失敗を注入する（実実装は失敗時に localStorage をロールバックして throw する）。
    mockApplyBackupPayloadToLocalStorage.mockImplementationOnce(() => {
      throw new Error("apply failed");
    });

    // モバイルメニューを開き、スキーマ的に妥当なバックアップファイルを選択して確認ダイアログを出す。
    fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
    const backupJson = JSON.stringify({
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      storage: { [STORAGE_KEY]: null, [UI_STORAGE_KEY]: null },
    });
    const backupFile = new File([backupJson], "backup.json", { type: "application/json" });
    // jsdom の File は text() 未実装のため、実ブラウザ相当の挙動をインスタンスに補う
    // （これが無いと handleConfirmImport が text() の TypeError で早期 catch され、
    // 検証対象の「適用失敗」パスに到達しない）。
    Object.defineProperty(backupFile, "text", { value: () => Promise.resolve(backupJson) });
    // メニューシートは Radix のポータルで body 直下に描画されるため、document 全体から探す。
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [backupFile] } });

    // 確認ダイアログ（モーダル）が最前面のうちに、実行ボタンの参照を確保しておく。
    const confirmDialog = screen.getByRole("alertdialog");
    const importButton = within(confirmDialog).getByRole("button", { name: "インポート" });

    // 確認ダイアログが開いた状態で編集し、debounce 保存を保留中（400ms 窓内）にする
    // （編集をインポート実行の直前に置くことで、保留状態のまま適用失敗パスへ入ることを保証する）。
    // モーダルの背後は aria-hidden になるため hidden: true で検索する（fireEvent は直接発火できる）。
    const openRowButtons = screen.getAllByRole("button", { name: /の編集シートを開く$/, hidden: true });
    fireEvent.click(openRowButtons[0]!);
    fireEvent.click(screen.getByRole("button", { name: /の所持メモピ数を増やす$/, hidden: true }));

    // インポートを実行すると適用が失敗し、失敗ダイアログが表示される。
    fireEvent.click(importButton);
    await screen.findByText("インポート失敗");
    // 失敗の注入点が適用処理であること（text()/parse での早期 catch でないこと）を保証する。
    expect(mockApplyBackupPayloadToLocalStorage).toHaveBeenCalledTimes(1);

    // 適用失敗パスではキャンセルが走らないため、保留中の編集（メモピ 0 → 1）は
    // pagehide の flush（または debounce タイマー満了）で引き続き保存される。
    fireEvent(window, new Event("pagehide"));
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { progressByName: Record<string, { ownedMemoryPiece: number }> };
    expect(Object.values(saved.progressByName).some((progress) => progress.ownedMemoryPiece === 1)).toBe(true);
  });
});

// window.location.reload をスパイに差し替える（jsdom の reload は未実装のため）。戻り値の restore で元に戻す。
function stubReload() {
  const reload = vi.fn();
  const originalLocation = window.location;
  Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, reload } });
  return {
    reload,
    restore: () => Object.defineProperty(window, "location", { configurable: true, value: originalLocation }),
  };
}

// 別のタブが端末データの epoch を進めた状況を再現する（このタブの控えとは異なる値を書き込む）。
function simulateEpochBumpedInAnotherTab(): string {
  isDeviceDataEpochCurrent();
  const value = `other-tab-${Math.random()}`;
  window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, value);
  return value;
}

// モバイル編集シートで1件編集し、debounce 保存（400ms）が保留中の状態を作る。
async function renderMobileWithPendingEdit() {
  stubMobileMatchMedia();
  vi.stubGlobal("scrollTo", vi.fn());
  render(<App />);
  const openRowButtons = await screen.findAllByRole("button", { name: /の編集シートを開く$/ }, { timeout: 10_000 });
  fireEvent.click(openRowButtons[0]!);
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /の所持メモピ数を増やす$/ }));
}

describe("App: 別のアカウントのデータの確認ダイアログ", () => {
  it("サーバーにデータがない場合は「引き継ぐ」「初期状態から始める」「ログアウトする」を出す", () => {
    const sync = stubSync({
      isLoggedIn: true,
      status: "idle",
      userLabel: "テスト表示名",
      accountSwitch: {
        userId: "u_new",
        server: { kind: "not_found" },
        localUpdatedAt: "2026-10-01T00:00:00.000Z",
        previousOwnerHasUnsyncedChanges: true,
      },
    });
    render(<App />);

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("別のアカウントのデータがこの端末に残っています")).toBeInTheDocument();
    // 前のアカウントの未同期変更の警告。サーバーがないので更新日時は出さない。
    expect(within(dialog).getByText(/前のアカウントのサーバーへまだ送られていない変更/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/サーバー側の更新/)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "この端末のデータを引き継ぐ" }));
    expect(sync.resolveAccountSwitchCarryOver).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "使わずに初期状態から始める" }));
    expect(sync.resolveAccountSwitchDiscard).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "ログアウトする" }));
    expect(sync.cancelAccountSwitchAndSignOut).toHaveBeenCalledTimes(1);
  });

  it("サーバーにデータがある場合は「サーバーのデータを使う」「上書き」と両方の更新日時を出す", () => {
    const sync = stubSync({
      isLoggedIn: true,
      status: "idle",
      userLabel: "テスト表示名",
      accountSwitch: {
        userId: "u_new",
        server: {
          kind: "found",
          revision: 9,
          payload: { formatVersion: 1, storage: {} } as never,
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
        localUpdatedAt: "2026-09-01T00:00:00.000Z",
        previousOwnerHasUnsyncedChanges: false,
      },
    });
    render(<App />);

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/サーバー側の更新/)).toBeInTheDocument();
    expect(within(dialog).getByText(/この端末の更新/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/前のアカウントのサーバーへまだ送られていない変更/)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "サーバーのデータを使う" }));
    expect(sync.resolveAccountSwitchDiscard).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "この端末のデータでサーバーを上書き" }));
    expect(sync.resolveAccountSwitchCarryOver).toHaveBeenCalledTimes(1);
  });

  it("処理中はすべてのボタンを無効にして処理中を表示する", () => {
    stubSync({
      isLoggedIn: true,
      status: "syncing",
      userLabel: "テスト表示名",
      isAccountSwitchBusy: true,
      accountSwitch: {
        userId: "u_new",
        server: { kind: "not_found" },
        localUpdatedAt: "2026-10-01T00:00:00.000Z",
        previousOwnerHasUnsyncedChanges: false,
      },
    });
    render(<App />);

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent("処理中...");
    expect(within(dialog).getByRole("button", { name: "この端末のデータを引き継ぐ" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "使わずに初期状態から始める" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ログアウトする" })).toBeDisabled();
  });

  it("端末データを削除してサーバーにもデータがないときは、保留中の保存を取り消して再読み込みを案内する", { timeout: 20_000 }, async () => {
    const { reload, restore } = stubReload();
    try {
      await renderMobileWithPendingEdit();
      // useSync が端末データを削除した直後に onLocalDataCleared を呼ぶ順序を再現する。
      window.localStorage.removeItem(STORAGE_KEY);
      act(() => {
        capturedUseSyncOptions!.onLocalDataCleared();
      });

      expect(screen.getByText("この端末のデータを削除しました")).toBeInTheDocument();
      // 保留中の保存は取り消され、pagehide でも debounce 満了でも書き戻されない。
      fireEvent(window, new Event("pagehide"));
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

      // 閉じると再読み込みする（既存のメッセージダイアログは onClick と onOpenChange の両方で閉じ処理が走る）。
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      expect(reload).toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

describe("App: 別のタブで端末データが変わったとき", () => {
  it("epoch キーの storage イベントで同期を止め、閉じられない再読み込み案内を出す", () => {
    const { reload, restore } = stubReload();
    try {
      const sync = stubSync({ isLoggedIn: true, status: "idle", userLabel: "テスト表示名" });
      render(<App />);

      const value = simulateEpochBumpedInAnotherTab();
      act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key: DEVICE_DATA_EPOCH_STORAGE_KEY, newValue: value }));
      });

      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByText("別のタブでこの端末のデータが変更されました")).toBeInTheDocument();
      expect(sync.stopSync).toHaveBeenCalled();
      // Escape では閉じない。
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole("button", { name: "再読み込み" }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it("別のキーの storage イベントや、epoch が変わっていないときは案内を出さない", () => {
    const sync = stubSync();
    render(<App />);
    isDeviceDataEpochCurrent();

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "x" }));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: DEVICE_DATA_EPOCH_STORAGE_KEY,
          newValue: window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY),
        }),
      );
    });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(sync.stopSync).not.toHaveBeenCalled();
  });

  it("別のタブで epoch が進んだ後は、保留中の編集を pagehide でも debounce でも書き戻さない", { timeout: 20_000 }, async () => {
    await renderMobileWithPendingEdit();
    simulateEpochBumpedInAnotherTab();
    // 別のタブが端末データを削除・書き換えた状態を再現する。
    const otherTabValue = JSON.stringify({ marker: "other-tab" });
    window.localStorage.setItem(STORAGE_KEY, otherTabValue);

    fireEvent(window, new Event("pagehide"));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(otherTabValue);
  });
});
