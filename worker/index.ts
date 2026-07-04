/**
 * Cloudflare Workers エントリポイント。
 *
 * 静的アセット（SPA 本体）は `@cloudflare/vite-plugin` と `wrangler.jsonc` の
 * `assets` 設定によって配信され、`run_worker_first: ["/api/*"]` により
 * `/api/*` のみがこの Worker に到達する。
 *
 * Phase 2 で以下を提供する:
 * - `/api/auth/*`: better-auth のハンドラ（ソーシャルログイン・セッション・アカウント削除）
 * - `/api/data`: 同期データの取得・保存（`worker/data.ts`）
 * - `scheduled`: 期限切れ rate_limit 行の日次掃除（Cron Trigger）
 */
import { createAuth, type AuthEnv } from "./auth";
import { cleanupExpiredRateLimitRows, handleDataRequest } from "./data";

// この Worker が参照する env の型。
// シークレット（wrangler secret / .dev.vars）は wrangler types の生成型に安定して現れないため、
// 生成型に依存せず必要なバインディング・変数を明示した AuthEnv を用いる。
type WorkerEnv = AuthEnv;

export default {
  /**
   * すべての受信リクエストを処理するハンドラ。
   * `run_worker_first` の設定上、ここに到達するのは基本的に `/api/*` のリクエストのみ。
   *
   * @param request 受信した HTTP リクエスト
   * @param env バインディング（D1）とシークレット・環境変数
   * @returns 各 API ハンドラの応答、未定義パスは 404 の JSON レスポンス
   */
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    // better-auth が管理する認証エンドポイント（/api/auth/*）。
    // env はリクエスト時にしか得られないため、インスタンスはリクエストごとにファクトリで生成する。
    if (url.pathname.startsWith("/api/auth/")) {
      const auth = createAuth(env);
      return auth.handler(request);
    }

    // 同期データ API（/api/data）。CSRF 検証・認証・レート制限は handleDataRequest 内で行う。
    if (url.pathname === "/api/data") {
      const auth = createAuth(env);
      return handleDataRequest(request, env, auth);
    }

    // 上記以外の /api/* は未定義エンドポイントとして 404 JSON を返す。
    return Response.json(
      {
        error: "not_found",
        message: "Unknown API endpoint.",
        path: url.pathname,
      },
      { status: 404 },
    );
  },

  /**
   * Cron Trigger（wrangler.jsonc の triggers.crons、日次）で呼び出されるハンドラ。
   * 期限切れとなった rate_limit のウィンドウ行をまとめて削除する（設計書「乱用対策」節）。
   *
   * @param controller スケジュール実行の情報（発火時刻等）
   * @param env バインディング（D1）
   */
  async scheduled(controller: ScheduledController, env: WorkerEnv): Promise<void> {
    await cleanupExpiredRateLimitRows(env.DB, controller.scheduledTime);
  },
} satisfies ExportedHandler<WorkerEnv>;
