import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// authClient はログイン UI（SyncHeader）が参照するためスタブ化する（実 API を呼ばせない）。
vi.mock("../lib/authClient", () => ({
  authClient: { deleteUser: vi.fn() },
  signIn: { social: vi.fn() },
  signOut: vi.fn(),
}));

import { MobileHeader } from "./MobileHeader";
import { signOut } from "../lib/authClient";

type Props = ComponentProps<typeof MobileHeader>;

// 未ログイン状態を既定とした props 一式を生成する。
function buildProps(overrides: Partial<Props> = {}): Props {
  return {
    isLoggedIn: false,
    isSessionPending: false,
    userLabel: null,
    status: "logged_out",
    onOpenPrivacyPolicy: vi.fn(),
    onDeleteRequestStart: vi.fn(),
    onBeforeAccountDeleted: vi.fn(),
    onLogoutStart: vi.fn(),
    onDeleteDeviceData: vi.fn(),
    hasUnsyncedChanges: vi.fn(() => false),
    updatedAt: "2026/7/8 12:00:00",
    onExportBackup: vi.fn(),
    onSelectImportFile: vi.fn(),
    onRequestReset: vi.fn(),
    ...overrides,
  };
}

// 「⋯」ボタンを押してメニューシートを開く。
function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "メニューを開く" }));
}

describe("MobileHeader", () => {
  it("⋯ボタンのタップでメニューシートが開き主要項目が表示される", () => {
    render(<MobileHeader {...buildProps()} />);

    // 初期状態ではメニューは表示されない。
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    openMenu();

    expect(screen.getByRole("dialog", { name: "メニュー" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "エクスポート" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "インポート" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存データを初期化" })).toBeInTheDocument();
    expect(screen.getByText("最終更新: 2026/7/8 12:00:00")).toBeInTheDocument();
  });

  it("エクスポート項目のタップでハンドラが発火しシートが閉じる", async () => {
    const props = buildProps();
    render(<MobileHeader {...props} />);

    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "エクスポート" }));

    expect(props.onExportBackup).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("初期化項目のタップで onRequestReset が発火しシートが閉じる", async () => {
    const props = buildProps();
    render(<MobileHeader {...props} />);

    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "保存データを初期化" }));

    expect(props.onRequestReset).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("未ログイン時はメニュー内にログイン導線が表示される", () => {
    render(<MobileHeader {...buildProps()} />);

    openMenu();

    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
  });

  it("ログイン中はメニュー内のログアウトから確認ダイアログを開き、受け取った props で処理する", async () => {
    vi.mocked(signOut).mockResolvedValue({ data: { success: true }, error: null } as never);
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, reload } });
    try {
      const props = buildProps({
        isLoggedIn: true,
        userLabel: "テスト表示名",
        status: "idle",
        hasUnsyncedChanges: vi.fn(() => true),
      });
      render(<MobileHeader {...props} />);

      openMenu();
      fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

      const dialog = screen.getByRole("alertdialog");
      expect(props.hasUnsyncedChanges).toHaveBeenCalled();
      expect(within(dialog).getByText(/サーバーへまだ送られていない変更があります/)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "この端末のデータを削除してログアウト" }));

      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      expect(props.onLogoutStart).toHaveBeenCalledTimes(1);
      expect(props.onDeleteDeviceData).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });
});
