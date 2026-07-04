import { render, screen } from "@testing-library/react";
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

beforeEach(() => {
  window.localStorage.clear();
  mockUseSync.mockReset();
  stubSync();
});

afterEach(() => {
  vi.restoreAllMocks();
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
