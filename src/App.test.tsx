import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// useSync をモックし、セッションや同期ロジックに依存せず App のルーティングを検証する。
const mockUseSync = vi.fn();
vi.mock("./hooks/useSync", () => ({
  useSync: () => mockUseSync(),
}));

// authClient はログイン UI が参照するためスタブ化する（実 API を呼ばせない）。
vi.mock("./lib/authClient", () => ({
  authClient: { deleteUser: vi.fn() },
  signIn: { social: vi.fn() },
  signOut: vi.fn(),
}));

import App from "./App";

// useSync の戻り値を未ログイン・同期なしの静的値に固定する。
function stubSync() {
  mockUseSync.mockReturnValue({
    isLoggedIn: false,
    isSessionPending: false,
    userLabel: null,
    status: "logged_out",
    conflict: null,
    notifyLocalChange: vi.fn(),
    notifyLocalDataImported: vi.fn(),
    resolveConflictUseServer: vi.fn(),
    resolveConflictUseLocal: vi.fn(),
    stopSync: vi.fn(),
  });
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
  mockUseSync.mockReset();
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
