import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrivacyPolicyPage } from "./PrivacyPolicyPage";

describe("PrivacyPolicyPage", () => {
  it("見出しと戻る導線を表示する", () => {
    render(<PrivacyPolicyPage onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "プライバシーポリシー" })).toBeInTheDocument();
    // 戻る導線（複数配置しているため getAllByRole で存在確認する）。
    expect(screen.getAllByRole("button", { name: "アプリに戻る" }).length).toBeGreaterThan(0);
  });

  it("設計書の必須記載事項をすべて含む", () => {
    render(<PrivacyPolicyPage onBack={vi.fn()} />);
    const body = document.body.textContent ?? "";

    // 保存する情報: email・プロバイダ ID・表示名・トークン + 育成データ。
    expect(body).toContain("メールアドレス");
    expect(body).toContain("プロバイダ ID");
    expect(body).toContain("表示名");
    expect(body).toMatch(/トークン/);
    // 二次利用しない旨。
    expect(body).toContain("認証目的にのみ使用");
    expect(body).toMatch(/メールアドレスは画面上には表示しません/);
    // 未ログイン時はサーバーへ送信しない。
    expect(body).toMatch(/サーバーへは一切送信されません/);
    // 端末に内部 ID を保存し、別のアカウントでのログイン時に確認する。ログアウト時に端末データの削除を選べる。
    expect(body).toContain("内部 ID");
    expect(body).toMatch(/別のアカウントでログインしたときに/);
    expect(body).toMatch(/残すか削除するかを選べます/);
    expect(body).toMatch(/削除したアカウントの内部 ID も端末のブラウザに残り/);
    // アカウント削除で認証情報・同期データが連動削除される。
    expect(body).toMatch(/同期済みの育成データが連動して削除/);
    // 7 日間の残存（必須）。
    expect(body).toContain("7 日間");
    expect(body).toMatch(/Time Travel/);
    // セッションに IP アドレス・ユーザーエージェントを保存する。
    expect(body).toContain("IP アドレス");
    expect(body).toContain("ユーザーエージェント");
    // 保存済みのトークンは一度削除済みで、以後のログインで保存されるアクセス・リフレッシュトークンは暗号化する。
    expect(body).toMatch(/保存済みのトークン（スコープを除く）は一度すべて削除しました/);
    expect(body).toMatch(/その削除後のログインで保存されたもの/);
    expect(body).toMatch(/アクセストークンとリフレッシュトークンは暗号化して保存します/);
    expect(body).toContain("ID トークン");
    expect(body).toMatch(/ID トークンは暗号化の対象外/);
    // GitHub / Google は確認済みの同じメールアドレスなら同じアカウント、異なれば別アカウント。
    expect(body).toMatch(/同じメールアドレス/);
    expect(body).toMatch(/同じアカウント/);
    expect(body).toMatch(/別々のアカウント/);
  });

  it("戻るボタンで onBack を呼ぶ", () => {
    const onBack = vi.fn();
    render(<PrivacyPolicyPage onBack={onBack} />);

    fireEvent.click(screen.getAllByRole("button", { name: "アプリに戻る" })[0]!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
