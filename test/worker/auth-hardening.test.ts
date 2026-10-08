import { describe, expect, it } from "vitest";
import worker from "../../worker/index";
import { createAuth, type AuthEnv } from "../../worker/auth";
import { testEnv, TEST_ORIGIN } from "./helpers";

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
});
