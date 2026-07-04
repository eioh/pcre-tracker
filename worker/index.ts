/**
 * Cloudflare Workers エントリポイント。
 *
 * Phase 1 では `/api/*` 配下のリクエストに 404 JSON を返す最小プレースホルダのみを提供する。
 * 静的アセット（SPA 本体）は `@cloudflare/vite-plugin` と `wrangler.jsonc` の
 * `assets` 設定によって配信され、`run_worker_first: ["/api/*"]` により
 * `/api/*` のみがこの Worker に到達する。
 * 実際の API（認証・同期など）は Phase 2 以降でここに実装する。
 */
export default {
  /**
   * すべての受信リクエストを処理するハンドラ。
   * `run_worker_first` の設定上、ここに到達するのは基本的に `/api/*` のリクエストのみ。
   * Phase 1 では未実装 API として 404 JSON を返す。
   *
   * @param request 受信した HTTP リクエスト
   * @returns 404 の JSON レスポンス
   */
  fetch(request: Request): Response {
    // リクエスト URL からパス名を取り出し、404 応答に含めて未実装であることを示す。
    const url = new URL(request.url);
    return Response.json(
      {
        error: "not_found",
        message: "API is not implemented yet (Phase 1).",
        path: url.pathname,
      },
      { status: 404 },
    );
  },
} satisfies ExportedHandler;
