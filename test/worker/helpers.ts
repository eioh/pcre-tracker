import { env } from "cloudflare:test";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import type { AuthEnv } from "../../worker/auth";
import { CONNECT_RANK_CALC_STORAGE_KEY, STORAGE_KEY } from "../../src/domain/storageKeys";
import type { SyncPayloadV1 } from "../../src/domain/sync";

// Worker テスト共通のヘルパー。
//
// テストでのセッション生成には better-auth 公式の testUtils プラグインを使う。
// 選定理由: 本アプリはソーシャルログイン専用のため、テスト内で OAuth フローを完走できない。
// Cookie の手動偽造（トークン + HMAC 署名の自作）は署名実装の内部仕様に結合して壊れやすい。
// testUtils プラグインは better-auth 自身の internalAdapter でセッション行を作成し、
// 本体と同じ署名関数で Cookie を生成するため、バージョン間で最も安定する。

// cloudflare:test の env を Worker が期待する AuthEnv として扱う。
// 認証系の変数は vitest.config.worker.ts の miniflare.bindings で固定値を注入している
// （.dev.vars の有無に依存しないため、生成型 Cloudflare.Env には現れず、キャストで補う）。
export const testEnv = env as unknown as AuthEnv;

// テスト時に利用するオリジン（miniflare.bindings の ALLOWED_ORIGINS と一致させる）。
export const TEST_ORIGIN = "http://localhost:5273";

// testUtils プラグインが $context に生やすヘルパーの型（本テストで使う分のみ定義）。
type TestUtilsHelpers = {
  createUser: (overrides?: { id?: string; email?: string; name?: string }) => {
    id: string;
    email: string;
    name: string;
  };
  saveUser: (user: Record<string, unknown>) => Promise<unknown>;
  login: (opts: { userId: string }) => Promise<{ headers: Headers; token: string }>;
};

// テスト専用の better-auth インスタンスを生成する。
// Worker 本体（worker/auth.ts の createAuth）と同じ DB・secret・baseURL を共有するため、
// ここで発行したセッション Cookie は Worker 側の getSession で正しく検証される。
// testUtils プラグインは本番設定に含めず、このテスト専用インスタンスにのみ追加する（公式推奨）。
function createTestAuth(authEnv: AuthEnv) {
  return betterAuth({
    database: authEnv.DB,
    secret: authEnv.BETTER_AUTH_SECRET,
    baseURL: authEnv.BETTER_AUTH_URL,
    plugins: [testUtils()],
  });
}

// テストユーザーを作成し、そのユーザーのセッション Cookie を返す。
export async function createUserWithSession(email?: string): Promise<{ userId: string; cookie: string }> {
  const auth = createTestAuth(testEnv);
  const ctx = (await auth.$context) as unknown as { test: TestUtilsHelpers };
  // ユーザーオブジェクトを生成して DB に保存する（internalAdapter 経由 = 本体と同じ書き込み経路）。
  const user = ctx.test.createUser(email ? { email } : {});
  await ctx.test.saveUser(user);
  // セッション行を作成し、署名済み Cookie 入りの Headers を得る。
  const { headers } = await ctx.test.login({ userId: user.id });
  const cookie = headers.get("cookie");
  if (!cookie) {
    throw new Error("テストセッションの Cookie 生成に失敗しました");
  }
  return { userId: user.id, cookie };
}

// 検証を通過する最小の SyncPayloadV1 を生成する。
// marker には purePieceByCharacterName のキーを指定でき、ユーザー間のデータ隔離検証の目印に使う。
export function buildSyncPayload(marker?: string): SyncPayloadV1 {
  return {
    formatVersion: 1,
    storage: {
      [STORAGE_KEY]: {
        schemaVersion: 1,
        updatedAt: "2026-07-04T00:00:00.000Z",
        progressByName: {},
        purePieceByCharacterName: marker ? { [marker]: 1 } : {},
        purePieceByBaseName: {},
        clanBattle: { groups: [] },
      },
      [CONNECT_RANK_CALC_STORAGE_KEY]: {
        schemaVersion: 1,
        entries: [],
      },
    },
  };
}

// /api/data への GET リクエストを組み立てる。
export function buildGetRequest(cookie: string, origin?: string): Request {
  const headers = new Headers({ Cookie: cookie });
  if (origin !== undefined) {
    headers.set("Origin", origin);
  }
  return new Request(`${TEST_ORIGIN}/api/data`, { method: "GET", headers });
}

// /api/data への PUT リクエストを組み立てる。origin / contentType / body は異常系検証のため上書き可能。
export function buildPutRequest(
  cookie: string,
  body: unknown,
  options: { origin?: string | null; contentType?: string | null; rawBody?: string } = {},
): Request {
  const headers = new Headers({ Cookie: cookie });
  // origin: undefined はデフォルト（正しいオリジン）、null は Origin ヘッダなし、文字列は指定値。
  if (options.origin === undefined) {
    headers.set("Origin", TEST_ORIGIN);
  } else if (options.origin !== null) {
    headers.set("Origin", options.origin);
  }
  // contentType: undefined はデフォルト（application/json）、null はヘッダなし、文字列は指定値。
  if (options.contentType === undefined) {
    headers.set("Content-Type", "application/json");
  } else if (options.contentType !== null) {
    headers.set("Content-Type", options.contentType);
  }
  return new Request(`${TEST_ORIGIN}/api/data`, {
    method: "PUT",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

// 指定テーブルの user_id / userId 該当行数を数える（CASCADE 削除の検証用）。
export async function countRowsForUser(table: string, column: string, userId: string): Promise<number> {
  const row = await testEnv.DB.prepare(`SELECT COUNT(*) AS cnt FROM "${table}" WHERE "${column}" = ?`)
    .bind(userId)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}
