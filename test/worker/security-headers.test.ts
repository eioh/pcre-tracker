import { describe, expect, it } from "vitest";
import worker from "../../worker/index";
import { withApiSecurityHeaders } from "../../worker/securityHeaders";
import { createUserWithSession, testEnv, TEST_ORIGIN } from "./helpers";

// /api/* の応答に付けるセキュリティ関連ヘッダ（nosniff / no-store）のテスト。

// 応答に nosniff と no-store が付いていることを確認する。
function expectApiSecurityHeaders(response: Response): void {
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
}

describe("withApiSecurityHeaders", () => {
  // ステータス・Location・本文と、複数の Set-Cookie をそのまま引き継いだうえでヘッダを付ける。
  it("複数の Set-Cookie・ステータス・本文を保ったままヘッダを付ける", async () => {
    const headers = new Headers({ Location: "/after" });
    headers.append("Set-Cookie", "first=1; Path=/; HttpOnly");
    headers.append("Set-Cookie", "second=2; Path=/; HttpOnly");
    const original = new Response("body-text", { status: 302, headers });

    const secured = withApiSecurityHeaders(original);
    expect(secured.status).toBe(302);
    expect(secured.headers.get("Location")).toBe("/after");
    expect(secured.headers.getSetCookie()).toEqual(["first=1; Path=/; HttpOnly", "second=2; Path=/; HttpOnly"]);
    expectApiSecurityHeaders(secured);
    expect(await secured.text()).toBe("body-text");
  });

  // 応答側で Cache-Control を指定している場合は上書きしない。
  it("既存の Cache-Control は尊重する", () => {
    const original = new Response(null, { status: 204, headers: { "Cache-Control": "private, max-age=60" } });
    const secured = withApiSecurityHeaders(original);
    expect(secured.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("Worker の /api/* 応答ヘッダ", () => {
  // better-auth・同期 API・未定義パスのいずれの応答にもヘッダが付く。
  it("/api/auth/ok・/api/data・未定義パスに nosniff と no-store が付く", async () => {
    for (const path of ["/api/auth/ok", "/api/data", "/api/unknown"]) {
      const response = await worker.fetch(new Request(`${TEST_ORIGIN}${path}`), testEnv);
      expectApiSecurityHeaders(response);
    }
  });

  // ログアウトのように複数の Cookie を消す応答でも、Set-Cookie がすべて残る。
  it("ログアウト応答の複数の Set-Cookie が保たれる", async () => {
    const { cookie } = await createUserWithSession();
    const response = await worker.fetch(
      new Request(`${TEST_ORIGIN}/api/auth/sign-out`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: TEST_ORIGIN, "Content-Type": "application/json" },
        body: "{}",
      }),
      testEnv,
    );
    expect(response.status).toBe(200);
    expectApiSecurityHeaders(response);
    const setCookies = response.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThanOrEqual(2);
    expect(setCookies.some((setCookie) => setCookie.includes("session_token="))).toBe(true);
  });
});
