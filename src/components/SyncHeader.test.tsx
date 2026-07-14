import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// authClient をテストから差し替える（deleteUser の戻り値を制御するため）。
const mockDeleteUser = vi.fn();
vi.mock("../lib/authClient", () => ({
  authClient: { deleteUser: () => mockDeleteUser() },
  signIn: { social: vi.fn() },
  signOut: vi.fn(),
}));

import { SyncHeader } from "./SyncHeader";
import { signOut } from "../lib/authClient";

// window.location.reload をスパイに差し替えるためのユーティリティ。
const reloadSpy = vi.fn();

beforeEach(() => {
  mockDeleteUser.mockReset();
  reloadSpy.mockReset();
  // jsdom の location.reload を差し替える（削除成功時のリロードを検証・抑止するため）。
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ログイン中の SyncHeader を既定 props で描画するヘルパー。
function renderLoggedIn(overrides?: Partial<Parameters<typeof SyncHeader>[0]>) {
  const onOpenPrivacyPolicy = vi.fn();
  const onDeleteRequestStart = vi.fn();
  const onBeforeAccountDeleted = vi.fn();
  render(
    <SyncHeader
      isLoggedIn
      isSessionPending={false}
      userLabel="テスト表示名"
      status="idle"
      onOpenPrivacyPolicy={onOpenPrivacyPolicy}
      onDeleteRequestStart={onDeleteRequestStart}
      onBeforeAccountDeleted={onBeforeAccountDeleted}
      {...overrides}
    />,
  );
  return { onOpenPrivacyPolicy, onDeleteRequestStart, onBeforeAccountDeleted };
}

describe("SyncHeader: PII（email 非表示）", () => {
  it("userLabel が email でも表示名でもない汎用表記時に email が DOM に出ない", () => {
    // userLabel は表示名のみ（App 側で email フォールバックを排除済み）。null 時は汎用表記になる。
    renderLoggedIn({ userLabel: null });
    expect(screen.getByText("ログイン中")).toBeInTheDocument();
    // email 形式の文字列が DOM 全体に一切現れないことを検証する。
    expect(document.body.textContent ?? "").not.toMatch(/@/);
  });

  it("表示名が渡された場合はそれを表示する", () => {
    renderLoggedIn({ userLabel: "テスト表示名" });
    expect(screen.getByText("テスト表示名")).toBeInTheDocument();
  });
});

describe("SyncHeader: アカウント削除フロー", () => {
  it("確認ダイアログで削除すると deleteUser を呼び後処理を行う", async () => {
    mockDeleteUser.mockResolvedValue({ data: { success: true }, error: null });
    const { onDeleteRequestStart, onBeforeAccountDeleted } = renderLoggedIn();

    // 削除ボタン → 確認ダイアログ。
    fireEvent.click(screen.getByRole("button", { name: /アカウント削除/ }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/取り消せません/)).toBeInTheDocument();
    // 削除内容の明示（サーバー削除・localStorage 残存・7 日間残存）。
    expect(within(dialog).getByText(/この端末に保存された育成データは削除されず/)).toBeInTheDocument();
    expect(within(dialog).getByText(/最大 7 日間/)).toBeInTheDocument();

    // 確定。
    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(mockDeleteUser).toHaveBeenCalledTimes(1));
    // 削除前に同期停止、成功時に後処理（メタ破棄）が呼ばれる。
    expect(onDeleteRequestStart).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onBeforeAccountDeleted).toHaveBeenCalledTimes(1));
    // 成功結果ダイアログが出る。
    await waitFor(() => expect(screen.getByText("アカウントを削除しました")).toBeInTheDocument());
    // 閉じるとリロードする。
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("SESSION_EXPIRED 時は再ログイン案内を表示し後処理を行わない", async () => {
    mockDeleteUser.mockResolvedValue({
      data: null,
      error: { status: 400, statusText: "Bad Request", code: "SESSION_EXPIRED", message: "Session expired." },
    });
    const { onBeforeAccountDeleted } = renderLoggedIn();

    fireEvent.click(screen.getByRole("button", { name: /アカウント削除/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(screen.getByText("再ログインが必要です")).toBeInTheDocument());
    expect(screen.getByText(/再ログインしてからやり直してください/)).toBeInTheDocument();
    // 削除は成立していないので後処理は呼ばれない。
    expect(onBeforeAccountDeleted).not.toHaveBeenCalled();
    // 案内を閉じてもリロードしない。
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("確認ダイアログでキャンセルすると何も起きない", () => {
    const { onDeleteRequestStart, onBeforeAccountDeleted } = renderLoggedIn();

    fireEvent.click(screen.getByRole("button", { name: /アカウント削除/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "キャンセル" }));

    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(onDeleteRequestStart).not.toHaveBeenCalled();
    expect(onBeforeAccountDeleted).not.toHaveBeenCalled();
  });
});

describe("SyncHeader: dropdown 変形（デスクトップヘッダー）", () => {
  // ユーザー名チップからメニューを展開する。
  // jsdom は PointerEvent 未実装で pointerdown 経由では開けないため、キーボード操作（Enter）で開く。
  function openAccountMenu(chipName: string | RegExp) {
    fireEvent.keyDown(screen.getByRole("button", { name: chipName }), { key: "Enter" });
  }

  it("ログイン後はユーザー名チップが表示され、メニューにステータス・ログアウト・アカウント削除が出る", () => {
    renderLoggedIn({ variant: "dropdown", userLabel: "テスト表示名", status: "idle" });

    // inline のボタン群は出ず、チップだけが出る。
    expect(screen.queryByRole("button", { name: /ログアウト/ })).not.toBeInTheDocument();
    openAccountMenu(/テスト表示名/);

    // ヘッダーラベルに表示名と同期ステータスが出る。
    expect(screen.getByText("同期済み")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "ログアウト" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "アカウント削除" })).toBeInTheDocument();
  });

  it("ログアウト項目の選択で signOut が呼ばれる", () => {
    renderLoggedIn({ variant: "dropdown" });

    openAccountMenu(/テスト表示名/);
    fireEvent.click(screen.getByRole("menuitem", { name: "ログアウト" }));

    expect(vi.mocked(signOut)).toHaveBeenCalledTimes(1);
  });

  it("アカウント削除項目の選択でメニューが閉じても確認ダイアログが表示される", () => {
    renderLoggedIn({ variant: "dropdown" });

    openAccountMenu(/テスト表示名/);
    fireEvent.click(screen.getByRole("menuitem", { name: "アカウント削除" }));

    // ダイアログは SyncHeader ルート直下にあるため、メニュー閉鎖後も表示される。
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(within(screen.getByRole("alertdialog")).getByText(/取り消せません/)).toBeInTheDocument();
  });

  it("同期エラー時はチップに危険色ドットのインジケータが出る", () => {
    renderLoggedIn({ variant: "dropdown", status: "error" });
    // role="status" の名前は内容から算出されないため、ライブリージョンの読み上げ内容（sr-only テキスト）を検証する。
    expect(screen.getByRole("status")).toHaveTextContent("同期エラー");
  });

  it("同期エラーでなければチップにインジケータが出ない", () => {
    renderLoggedIn({ variant: "dropdown", status: "idle" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("未ログイン時は dropdown でも従来どおりログインボタンが出る", () => {
    render(
      <SyncHeader
        isLoggedIn={false}
        isSessionPending={false}
        userLabel={null}
        status="logged_out"
        onOpenPrivacyPolicy={vi.fn()}
        onDeleteRequestStart={vi.fn()}
        onBeforeAccountDeleted={vi.fn()}
        variant="dropdown"
      />,
    );
    expect(screen.getByRole("button", { name: /ログイン/ })).toBeInTheDocument();
  });
});

describe("SyncHeader: ログインダイアログのポリシーリンク", () => {
  it("未ログイン時のログインダイアログにポリシーリンクがある", () => {
    const onOpenPrivacyPolicy = vi.fn();
    render(
      <SyncHeader
        isLoggedIn={false}
        isSessionPending={false}
        userLabel={null}
        status="logged_out"
        onOpenPrivacyPolicy={onOpenPrivacyPolicy}
        onDeleteRequestStart={vi.fn()}
        onBeforeAccountDeleted={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ログイン/ }));
    const link = screen.getByRole("button", { name: "プライバシーポリシー" });
    fireEvent.click(link);
    expect(onOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
  });
});
