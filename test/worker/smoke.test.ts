import { describe, it, expect } from "vitest";
import worker from "../../worker/index";

// Worker テスト基盤（@cloudflare/vitest-pool-workers）が正しく動作するかを確認するスモークテスト。
// Phase 1 の worker/index.ts は /api/* に 404 JSON を返す最小プレースホルダのため、
// その挙動を miniflare 実行環境上で検証する。
describe("worker スモークテスト", () => {
  // /api/foo への fetch が 404 の JSON を返すことを確認する。
  it("/api/foo に対して 404 の JSON を返す", async () => {
    // Worker の fetch ハンドラへ直接リクエストを投げる。
    // Phase 1 の fetch は (request) のみを受け取るシグネチャのため、そのまま呼び出す。
    const request = new Request("http://example.com/api/foo");
    const response = await worker.fetch(request);

    // ステータスが 404 であること。
    expect(response.status).toBe(404);
    // Content-Type が JSON であること。
    expect(response.headers.get("content-type")).toContain("application/json");
    // ボディが想定した 404 JSON 形状であること。
    const body = (await response.json()) as { error: string; path: string };
    expect(body.error).toBe("not_found");
    expect(body.path).toBe("/api/foo");
  });
});
