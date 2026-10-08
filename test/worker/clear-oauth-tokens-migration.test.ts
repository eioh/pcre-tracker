import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../../worker/index";
import { buildGetRequest, createUserWithSession, testEnv, TEST_ORIGIN } from "./helpers";

// マイグレーション 0003（保存済み OAuth トークンの削除）の効果を検証する。
// マイグレーションはセットアップ（apply-migrations.ts）で全テストの前に適用済みのため、
// ここでは「トークン入りの account 行を挿入 → 0003 の SQL を再実行 → 結果を確認」という手順で検証する。

// 対象マイグレーションのファイル名（readD1Migrations が返す name と一致させる）。
const MIGRATION_NAME = "0003_clear_stored_oauth_tokens.sql";

// account テーブルの 1 行（本テストで確認する列のみ）。
type AccountRow = {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scope: string | null;
  password: string | null;
  createdAt: string;
  updatedAt: string;
};

// readD1Migrations が読み込んだ 0003 のクエリ群を取り出す（ファイル内容を分割済みの SQL 文の配列）。
function getMigrationQueries(): string[] {
  const migration = env.TEST_MIGRATIONS?.find((m) => m.name === MIGRATION_NAME);
  if (!migration) {
    throw new Error(`${MIGRATION_NAME} が TEST_MIGRATIONS に見つかりません`);
  }
  return migration.queries;
}

// 0003 のクエリを DB に対して順に実行する。
async function runMigration(): Promise<void> {
  for (const query of getMigrationQueries()) {
    await testEnv.DB.prepare(query).run();
  }
}

// account 行を挿入し、その id を返す。トークン類は引数で指定する（省略した列は NULL）。
async function insertAccount(
  userId: string,
  values: Partial<Omit<AccountRow, "id" | "userId" | "createdAt" | "updatedAt">> & {
    accountId: string;
    providerId: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await testEnv.DB.prepare(
    `INSERT INTO account ("id", "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken",
      "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope", "password", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      values.accountId,
      values.providerId,
      userId,
      values.accessToken ?? null,
      values.refreshToken ?? null,
      values.idToken ?? null,
      values.accessTokenExpiresAt ?? null,
      values.refreshTokenExpiresAt ?? null,
      values.scope ?? null,
      values.password ?? null,
      "2026-07-04T00:00:00.000Z",
      "2026-07-05T00:00:00.000Z",
    )
    .run();
  return id;
}

// id を指定して account 行を取得する。
async function findAccount(id: string): Promise<AccountRow | null> {
  return testEnv.DB.prepare('SELECT * FROM account WHERE "id" = ?').bind(id).first<AccountRow>();
}

describe("マイグレーション 0003: 保存済み OAuth トークンの削除", () => {
  // トークンと有効期限だけが NULL になり、それ以外の列は変わらないことを検証する。
  it("トークンと有効期限を NULL にし、ID・scope・日時などは保持する", async () => {
    const { userId } = await createUserWithSession("clear-tokens@example.com");
    const googleId = await insertAccount(userId, {
      accountId: "google-12345",
      providerId: "google",
      accessToken: "plain-access-token",
      refreshToken: "plain-refresh-token",
      idToken: "plain-id-token",
      accessTokenExpiresAt: "2026-07-04T01:00:00.000Z",
      refreshTokenExpiresAt: "2026-08-04T00:00:00.000Z",
      scope: "openid,email,profile",
    });
    const githubId = await insertAccount(userId, {
      accountId: "github-67890",
      providerId: "github",
      accessToken: "plain-github-token",
      scope: "read:user,user:email",
    });

    await runMigration();

    for (const [id, accountId, providerId, scope] of [
      [googleId, "google-12345", "google", "openid,email,profile"],
      [githubId, "github-67890", "github", "read:user,user:email"],
    ] as const) {
      const row = await findAccount(id);
      expect(row).not.toBeNull();
      // トークンと有効期限は削除される。
      expect(row!.accessToken).toBeNull();
      expect(row!.refreshToken).toBeNull();
      expect(row!.idToken).toBeNull();
      expect(row!.accessTokenExpiresAt).toBeNull();
      expect(row!.refreshTokenExpiresAt).toBeNull();
      // それ以外の列は変わらない（updatedAt も更新しない）。
      expect(row!.accountId).toBe(accountId);
      expect(row!.providerId).toBe(providerId);
      expect(row!.userId).toBe(userId);
      expect(row!.scope).toBe(scope);
      expect(row!.password).toBeNull();
      expect(row!.createdAt).toBe("2026-07-04T00:00:00.000Z");
      expect(row!.updatedAt).toBe("2026-07-05T00:00:00.000Z");
    }
  });

  // password 列はトークン削除の対象外であることを検証する（credential 行を想定）。
  it("password 列は変更しない", async () => {
    const { userId } = await createUserWithSession("clear-tokens-password@example.com");
    const id = await insertAccount(userId, {
      accountId: userId,
      providerId: "credential",
      password: "hashed-password",
    });

    await runMigration();

    const row = await findAccount(id);
    expect(row!.password).toBe("hashed-password");
  });

  // 2 回実行しても失敗せず、結果が変わらない（冪等である）ことを検証する。
  it("繰り返し実行しても結果が変わらない", async () => {
    const { userId } = await createUserWithSession("clear-tokens-twice@example.com");
    const id = await insertAccount(userId, {
      accountId: "google-twice",
      providerId: "google",
      accessToken: "plain-access-token",
      refreshToken: "plain-refresh-token",
      idToken: "plain-id-token",
      scope: "openid,email,profile",
    });

    await runMigration();
    const afterFirst = await findAccount(id);
    await runMigration();
    const afterSecond = await findAccount(id);

    expect(afterFirst!.accessToken).toBeNull();
    expect(afterSecond).toEqual(afterFirst);
  });

  // トークン削除後も、セッション Cookie によるログイン状態の確認と同期 API が使えることを検証する。
  it("トークン削除後もセッションの取得と同期 API の認証が成功する", async () => {
    const { userId, cookie } = await createUserWithSession("clear-tokens-session@example.com");
    await insertAccount(userId, {
      accountId: "github-session",
      providerId: "github",
      accessToken: "plain-github-token",
      scope: "read:user,user:email",
    });

    await runMigration();

    const sessionResponse = await worker.fetch(
      new Request(`${TEST_ORIGIN}/api/auth/get-session`, { headers: { Cookie: cookie } }),
      testEnv,
    );
    expect(sessionResponse.status).toBe(200);
    const sessionBody = (await sessionResponse.json()) as { user: { id: string } } | null;
    expect(sessionBody?.user.id).toBe(userId);

    // 同期 API の認証も通る（未認証なら 401。データ未保存のため 404 になる）。
    const dataResponse = await worker.fetch(buildGetRequest(cookie), testEnv);
    expect(dataResponse.status).toBe(404);
  });
});
