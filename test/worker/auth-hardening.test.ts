import { describe, expect, it } from "vitest";
import worker from "../../worker/index";
import { limitAuthRequestBody, MAX_AUTH_BODY_BYTES } from "../../worker/authBody";
import { createAuth, type AuthEnv } from "../../worker/auth";
import { createUserWithSession, testEnv, TEST_ORIGIN } from "./helpers";

// 認証まわりの設定（OAuth state の Cookie 保存・トークン暗号化・レート制限・クライアント IP の取得元）の統合テスト。
//
// better-auth のメモリ上のレート制限カウンタはモジュールスコープで共有されるため、
// テストごとに別の cf-connecting-ip を使い、カウンタが互いに干渉しないようにする。

// GitHub プロバイダを有効にしたテスト用 env（OAuth の実通信は行わないため値はダミーでよい）。
const authTestEnv: AuthEnv = { ...testEnv, GITHUB_CLIENT_ID: "dummy", GITHUB_CLIENT_SECRET: "dummy" };

// 指定テーブルの全行数を数える（ログイン開始・失敗時に DB へ書き込まれていないことの確認用）。
async function countAllRows(table: string): Promise<number> {
  const row = await testEnv.DB.prepare(`SELECT COUNT(*) AS cnt FROM "${table}"`).first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

// /api/auth/sign-in/social（GitHub）へのログイン開始リクエストを組み立てる。
// ip は cf-connecting-ip に、extraHeaders は追加ヘッダ（X-Forwarded-For など）に使う。
function buildSocialSignInRequest(ip: string, extraHeaders: Record<string, string> = {}): Request {
  return new Request(`${TEST_ORIGIN}/api/auth/sign-in/social`, {
    method: "POST",
    headers: {
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      "cf-connecting-ip": ip,
      ...extraHeaders,
    },
    body: JSON.stringify({ provider: "github", callbackURL: "/" }),
  });
}

// Set-Cookie から「名前=値」の部分だけを取り出し、Cookie ヘッダ用の文字列にする。
function toCookieHeader(setCookies: string[]): string {
  return setCookies.map((setCookie) => setCookie.split(";")[0]).join("; ");
}

describe("OAuth ログイン開始（state の Cookie 保存）", () => {
  // ログイン開始で GitHub の認可 URL が返り、state は暗号化 Cookie に入り、verification テーブルには書き込まれない。
  it("sign-in/social は認可 URL と oauth_state Cookie を返し、verification に行を作らない", async () => {
    const response = await worker.fetch(buildSocialSignInRequest("198.51.100.1"), authTestEnv);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { url: string; redirect: boolean };
    expect(body.redirect).toBe(true);
    const authorizeUrl = new URL(body.url);
    expect(authorizeUrl.origin).toBe("https://github.com");
    expect(authorizeUrl.pathname).toBe("/login/oauth/authorize");
    expect(authorizeUrl.searchParams.get("state")).toBeTruthy();

    const stateCookie = response.headers.getSetCookie().find((cookie) => cookie.includes("oauth_state="));
    expect(stateCookie).toBeDefined();
    expect(stateCookie?.toLowerCase()).toContain("httponly");
    expect(stateCookie?.toLowerCase()).toContain("samesite=lax");

    expect(await countAllRows("verification")).toBe(0);
  });
});

describe("認証エンドポイントのボディサイズ上限", () => {
  // 上限を超える本文（巨大な scopes 配列）を better-auth の入力検証に届かせない。
  // 送信元の IP を変えて、レート制限のテストとカウンタが干渉しないようにする。
  // 上限を超えるログイン開始リクエストを組み立てる。withContentLength が false なら本文をストリームで渡す。
  function buildOversizedSignInRequest(ip: string, withContentLength: boolean): Request {
    const body = JSON.stringify({ provider: "github", callbackURL: "/", scopes: Array.from({ length: 20_000 }, (_, i) => i) });
    expect(body.length).toBeGreaterThan(MAX_AUTH_BODY_BYTES);
    const bytes = new TextEncoder().encode(body);
    return new Request(`${TEST_ORIGIN}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { Origin: TEST_ORIGIN, "Content-Type": "application/json", "cf-connecting-ip": ip },
      // ReadableStream で渡すと Content-Length が付かず、実際のバイト数での判定を通る。
      body: withContentLength
        ? bytes
        : new ReadableStream({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          }),
    });
  }

  // 実行環境から届く「body が null でない GET / HEAD」を偽のオブジェクトで再現する（new Request では作れないため）。
  // 本文を外して作り直し、メソッド・URL・Cookie は保つことを確認する。
  it.each(["GET", "HEAD"])("本文付きの %s は本文を外して渡す", async (method) => {
    const url = `${TEST_ORIGIN}/api/auth/get-session`;
    const request = {
      method,
      url,
      body: new ReadableStream(),
      headers: new Headers({ "Content-Length": "0", Cookie: "session=abc" }),
    } as unknown as Request;

    const limited = await limitAuthRequestBody(request);

    expect(limited).toBeInstanceOf(Request);
    const rebuilt = limited as Request;
    expect(rebuilt.body).toBeNull();
    expect(rebuilt.method).toBe(method);
    expect(rebuilt.url).toBe(url);
    expect(rebuilt.headers.get("Cookie")).toBe("session=abc");
  });

  it("Content-Length が上限を超える本文は 413 を返す", async () => {
    const response = await worker.fetch(buildOversizedSignInRequest("198.51.100.10", true), authTestEnv);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: "payload_too_large" });
  });

  it("Content-Length のない本文も実際のバイト数で 413 を返す", async () => {
    const response = await worker.fetch(buildOversizedSignInRequest("198.51.100.11", false), authTestEnv);
    expect(response.status).toBe(413);
  });
});

describe("認証エンドポイントのレート制限（メモリ）", () => {
  // 同じ IP からのログイン開始は 3 回まで許可され、4 回目は 429 になる。
  // X-Forwarded-For を変えても同じ cf-connecting-ip なら制限は解除されず、別 IP は影響を受けない。
  it("同一 IP の 4 回目は 429、X-Forwarded-For を変えても 429、別 IP は 200", async () => {
    const ip = "198.51.100.2";
    for (let i = 0; i < 3; i += 1) {
      const response = await worker.fetch(buildSocialSignInRequest(ip), authTestEnv);
      expect(response.status).toBe(200);
    }

    const fourth = await worker.fetch(buildSocialSignInRequest(ip), authTestEnv);
    expect(fourth.status).toBe(429);

    const spoofed = await worker.fetch(
      buildSocialSignInRequest(ip, { "X-Forwarded-For": "203.0.113.99" }),
      authTestEnv,
    );
    expect(spoofed.status).toBe(429);

    const otherIp = await worker.fetch(buildSocialSignInRequest("198.51.100.3"), authTestEnv);
    expect(otherIp.status).toBe(200);
  });
});

describe("OAuth コールバックの state 検証", () => {
  // コールバックの検証に失敗したときに DB へ何も作られていないことを確認する。
  async function expectNoAuthRows(): Promise<void> {
    expect(await countAllRows("verification")).toBe(0);
    expect(await countAllRows("user")).toBe(0);
    expect(await countAllRows("account")).toBe(0);
  }

  // state Cookie なしのコールバックはエラーページへリダイレクトし、ユーザー・アカウントを作らない。
  it("state Cookie なしのコールバックはエラーへリダイレクトする", async () => {
    const response = await worker.fetch(
      new Request(`${TEST_ORIGIN}/api/auth/callback/github?code=dummy-code&state=invalid-state`, {
        headers: { "cf-connecting-ip": "198.51.100.4" },
        redirect: "manual",
      }),
      authTestEnv,
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "", TEST_ORIGIN);
    expect(location.searchParams.get("error")).toBeTruthy();
    await expectNoAuthRows();
  });

  // ログイン開始で得た正規の state Cookie があっても、state パラメータが一致しなければエラーへリダイレクトする。
  it("state パラメータが Cookie と一致しないコールバックはエラーへリダイレクトする", async () => {
    const ip = "198.51.100.5";
    const signIn = await worker.fetch(buildSocialSignInRequest(ip), authTestEnv);
    expect(signIn.status).toBe(200);
    const cookie = toCookieHeader(signIn.headers.getSetCookie());

    const response = await worker.fetch(
      new Request(`${TEST_ORIGIN}/api/auth/callback/github?code=dummy-code&state=tampered-state`, {
        headers: { Cookie: cookie, "cf-connecting-ip": ip },
        redirect: "manual",
      }),
      authTestEnv,
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "", TEST_ORIGIN);
    expect(location.searchParams.get("error")).toBe("state_mismatch");
    await expectNoAuthRows();
  });
});

describe("認証 API の許可リスト", () => {
  // 送信元の IP を変えて、レート制限のテストとカウンタが干渉しないようにする。
  // ログイン済みの Cookie を付けた POST を組み立てる。
  function buildAuthedPost(path: string, cookie: string, body: unknown): Request {
    return new Request(`${TEST_ORIGIN}${path}`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: TEST_ORIGIN,
        "Content-Type": "application/json",
        "cf-connecting-ip": "198.51.100.20",
      },
      body: JSON.stringify(body),
    });
  }

  // ログイン済みでも update-user は better-auth に届かず、user 行は変わらない（D1 への書き込みが起きない）。
  it("update-user はログイン済みでも 404 で、user 行を更新しない", async () => {
    const { cookie, userId } = await createUserWithSession("allowlist@example.com");
    const before = await testEnv.DB.prepare('SELECT "name", "updatedAt" FROM "user" WHERE "id" = ?').bind(userId).first();

    const response = await worker.fetch(buildAuthedPost("/api/auth/update-user", cookie, { name: "changed" }), testEnv);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
    const after = await testEnv.DB.prepare('SELECT "name", "updatedAt" FROM "user" WHERE "id" = ?').bind(userId).first();
    expect(after).toEqual(before);
  });

  // 未使用の API と、許可リストに似せた経路は、どれも完全一致しないので通さない。
  it.each([
    "/api/auth/sign-in/email",
    "/api/auth/sign-up/email",
    "/api/auth/update-session",
    "/api/auth/list-sessions",
    "/api/auth/link-social",
    "/api/auth/get-access-token",
    "/api/auth/request-password-reset",
    "/api/auth/callback/unknown",
    "/api/auth/callback/github/extra",
    "/api/auth/get-session/",
    "/api/auth//get-session",
    "/api/auth/%75pdate-user",
    "/api/auth/GET-SESSION",
    "/api/auth/",
  ])("%s は 404 を返す", async (path) => {
    for (const method of ["GET", "POST"]) {
      const response = await worker.fetch(
        new Request(`${TEST_ORIGIN}${path}`, { method, headers: { Origin: TEST_ORIGIN, "cf-connecting-ip": "198.51.100.21" } }),
        testEnv,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: "not_found" });
    }
  });

  // 上限を超える本文でも、許可リスト外なら本文を読まずに 404 を返す。
  it("許可リスト外の経路は本文の上限より先に 404 を返す", async () => {
    const response = await worker.fetch(
      new Request(`${TEST_ORIGIN}/api/auth/update-user`, {
        method: "POST",
        headers: { Origin: TEST_ORIGIN, "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.22" },
        body: "x".repeat(MAX_AUTH_BODY_BYTES + 1),
      }),
      testEnv,
    );
    expect(response.status).toBe(404);
  });

  // アプリが使う経路は better-auth に届く（better-auth の応答であり、許可リストの 404 ではない）。
  it.each([
    ["GET", "/api/auth/ok", 200],
    ["GET", "/api/auth/get-session", 200],
    ["GET", "/api/auth/error", 200],
    ["GET", "/api/auth/callback/github", 302],
    ["GET", "/api/auth/callback/google", 302],
  ])("%s %s は better-auth が応答する", async (method, path, status) => {
    const response = await worker.fetch(
      new Request(`${TEST_ORIGIN}${path}`, { method, headers: { "cf-connecting-ip": "198.51.100.23" }, redirect: "manual" }),
      {
        ...authTestEnv,
        GOOGLE_CLIENT_ID: "dummy",
        GOOGLE_CLIENT_SECRET: "dummy",
      },
    );
    expect(response.status).toBe(status);
  });
});

describe("createAuth の設定（回帰ガード）", () => {
  // 認証まわりの防御設定が意図せず外れていないことを確認する。
  it("state の Cookie 保存・トークン暗号化・メモリのレート制限・cf-connecting-ip を設定している", () => {
    const { options } = createAuth(testEnv);
    expect(options.account?.storeStateStrategy).toBe("cookie");
    expect(options.account?.encryptOAuthTokens).toBe(true);
    expect(options.rateLimit?.enabled).toBe(true);
    expect(options.rateLimit?.storage).toBe("memory");
    expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["cf-connecting-ip"]);
    expect(options.advanced?.defaultCookieAttributes).toEqual({ httpOnly: true, secure: true, sameSite: "lax" });
  });

  // リクエストごとに D1 へスキーマを問い合わせないよう、実行時の点検が無効になっていることを確認する。
  it("実行時のスキーマ点検を無効にしている", async () => {
    const context = await createAuth(testEnv).$context;
    expect(context.options.advanced?.database?.validateSchema).toBe(false);
    expect(context.checkSchema).toBeUndefined();
  });

  // 実行時に点検しない代わりに、migrations/ を当てた D1 が better-auth の期待するスキーマと一致することを確認する。
  it("マイグレーション後の D1 は better-auth が期待するスキーマと一致する", async () => {
    const context = await createAuth(testEnv).$context;
    expect(context.explicitSchemaCheck).toBeDefined();
    await expect(context.explicitSchemaCheck?.()).resolves.toBeUndefined();
  });
});
