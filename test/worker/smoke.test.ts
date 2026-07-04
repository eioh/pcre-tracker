import { describe, it, expect } from "vitest";
import worker from "../../worker/index";
import { testEnv, TEST_ORIGIN } from "./helpers";

// Worker テスト基盤（@cloudflare/vitest-pool-workers）と基本ルーティングのスモークテスト。
describe("worker スモークテスト", () => {
  // 未定義の /api/* パスへの fetch が 404 の JSON を返すことを確認する。
  it("/api/foo に対して 404 の JSON を返す", async () => {
    const request = new Request(`${TEST_ORIGIN}/api/foo`);
    const response = await worker.fetch(request, testEnv);

    // ステータスが 404 であること。
    expect(response.status).toBe(404);
    // Content-Type が JSON であること。
    expect(response.headers.get("content-type")).toContain("application/json");
    // ボディが想定した 404 JSON 形状であること。
    const body = (await response.json()) as { error: string; path: string };
    expect(body.error).toBe("not_found");
    expect(body.path).toBe("/api/foo");
  });

  // better-auth のヘルスチェックエンドポイント /api/auth/ok が応答することを確認する。
  it("/api/auth/ok が better-auth から応答する", async () => {
    const response = await worker.fetch(new Request(`${TEST_ORIGIN}/api/auth/ok`), testEnv);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  // セッションなしの /api/auth/get-session が 200 で null を返す（better-auth ハンドラの疎通確認）。
  it("/api/auth/get-session はセッションなしで null を返す", async () => {
    const response = await worker.fetch(new Request(`${TEST_ORIGIN}/api/auth/get-session`), testEnv);
    expect(response.status).toBe(200);
    const body = (await response.json()) as unknown;
    expect(body).toBeNull();
  });
});
