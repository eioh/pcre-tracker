import { describe, expect, it } from "vitest";
import worker from "../../worker/index";
import {
  buildPutRequest,
  buildSyncPayload,
  countRowsForUser,
  createUserWithSession,
  testEnv,
  TEST_ORIGIN,
} from "./helpers";

// アカウント削除（退会）の連動削除テスト（設計書「アカウント削除・プライバシーポリシー」節の必須要件）。
// better-auth の delete-user API（/api/auth/delete-user）を起点に、
// user / session / account と、FK ON DELETE CASCADE による app_state / rate_limit の
// 連動削除が正しく行われることを検証する。

describe("アカウント削除の連動削除（CASCADE）", () => {
  // 退会 API 経由でユーザーを削除し、全関連テーブルの行が消えることを検証する。
  it("delete-user API で user / session / account / app_state / rate_limit が連動削除される", async () => {
    const { cookie, userId } = await createUserWithSession("delete-me@example.com");

    // app_state と rate_limit の行を作る（PUT 1 回で両方生成される）。
    const putResponse = await worker.fetch(
      buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }),
      testEnv,
    );
    expect(putResponse.status).toBe(200);

    // ソーシャルログイン相当の account 行を直接挿入する（テストセッションは OAuth を経由しないため）。
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      'INSERT INTO account ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), "github-12345", "github", userId, now, now)
      .run();

    // 削除前: 各テーブルに行が存在することを確認する。
    expect(await countRowsForUser("user", "id", userId)).toBe(1);
    expect(await countRowsForUser("session", "userId", userId)).toBe(1);
    expect(await countRowsForUser("account", "userId", userId)).toBe(1);
    expect(await countRowsForUser("app_state", "user_id", userId)).toBe(1);
    expect(await countRowsForUser("rate_limit", "user_id", userId)).toBe(1);

    // better-auth の delete-user API を呼ぶ。
    // 作成直後のセッションは fresh（freshAge 内）のため、パスワードなしでも削除が実行される。
    const deleteResponse = await worker.fetch(
      new Request(`${TEST_ORIGIN}/api/auth/delete-user`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: TEST_ORIGIN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      testEnv,
    );
    expect(deleteResponse.status).toBe(200);
    const deleteBody = (await deleteResponse.json()) as { success: boolean; message: string };
    expect(deleteBody.success).toBe(true);
    expect(deleteBody.message).toBe("User deleted");

    // 削除後: user 本体と、CASCADE 対象の全テーブルから行が消えていることを確認する。
    expect(await countRowsForUser("user", "id", userId)).toBe(0);
    expect(await countRowsForUser("session", "userId", userId)).toBe(0);
    expect(await countRowsForUser("account", "userId", userId)).toBe(0);
    // app_state / rate_limit は better-auth の管轄外であり、FK の ON DELETE CASCADE のみで消える。
    // ここが 0 でない場合はマイグレーションの CASCADE 指定漏れを意味する（設計書の必須検証項目）。
    expect(await countRowsForUser("app_state", "user_id", userId)).toBe(0);
    expect(await countRowsForUser("rate_limit", "user_id", userId)).toBe(0);
  });

  // FK の CASCADE 自体を単独でも検証する（API を経由しない直接削除でも連動することの確認）。
  it("user 行の直接削除でも app_state / rate_limit が CASCADE 削除される", async () => {
    const { cookie, userId } = await createUserWithSession("cascade-direct@example.com");
    await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }), testEnv);
    expect(await countRowsForUser("app_state", "user_id", userId)).toBe(1);
    expect(await countRowsForUser("rate_limit", "user_id", userId)).toBe(1);

    // user 行を直接削除する（D1 は外部キー制約がデフォルト有効のため CASCADE が機能する）。
    await testEnv.DB.prepare('DELETE FROM "user" WHERE id = ?').bind(userId).run();

    expect(await countRowsForUser("app_state", "user_id", userId)).toBe(0);
    expect(await countRowsForUser("rate_limit", "user_id", userId)).toBe(0);
    expect(await countRowsForUser("session", "userId", userId)).toBe(0);
  });
});
