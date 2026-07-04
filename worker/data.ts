import { z } from "zod";
import { syncPayloadV1Schema, SYNC_FORMAT_VERSION } from "../src/domain/sync";
import { parseAllowedOrigins, type Auth, type AuthEnv } from "./auth";

// `/api/data` エンドポイントの実装。
//
// 設計書「データ設計」「認証・セキュリティ設計」「乱用対策」節に従い、以下を実装する:
// - CSRF ミドルウェア（Origin 検証 / Content-Type 必須化 / 許可メソッド限定）
// - セッション認証と全クエリの user_id スコープ（データ隔離）
// - ボディサイズ上限 512KB（JSON parse 前に検証）
// - SyncPayloadV1 の深い Zod 検証
// - サーバー発行 revision による楽観ロック
// - PUT の固定ウィンドウレート制限（30 回 / 5 分）

// ペイロードサイズ上限（バイト）。設計書「乱用対策」節の 512KB。
export const MAX_BODY_BYTES = 512 * 1024;

// レート制限の固定ウィンドウ幅（ミリ秒）。5 分。
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

// レート制限の上限回数（ウィンドウあたり）。
export const RATE_LIMIT_MAX_REQUESTS = 30;

// PUT リクエストボディ（{ baseRevision, payload }）の Zod スキーマ。
// baseRevision は「初回アップロード」を表す null か、サーバー発行のリビジョン番号のみを許容する。
const putRequestSchema = z.object({
  baseRevision: z.union([z.null(), z.number().int().min(0)]),
  payload: syncPayloadV1Schema,
});

// エラー応答 JSON を生成する共通ヘルパー。
function errorResponse(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status });
}

// Content-Type ヘッダから MIME タイプ部分（`;` より前）を取り出して application/json か判定する。
function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  const mimeType = contentType.split(";")[0]?.trim().toLowerCase();
  return mimeType === "application/json";
}

// CSRF ミドルウェア相当の事前検証（設計書「CSRF 対策」節の 3 点)。
// 問題があればエラー Response を、通過すれば null を返す。
function validateCsrf(request: Request, allowedOrigins: string[]): Response | null {
  const method = request.method;

  // 1. 許可メソッド限定: /api/data は GET / PUT のみ。
  if (method !== "GET" && method !== "PUT") {
    return errorResponse(405, "method_not_allowed", "GET と PUT のみ利用できます。");
  }

  const origin = request.headers.get("Origin");

  if (method === "PUT") {
    // 2. PUT（状態変更）は Origin 必須かつ許可オリジン一致。欠落・不一致は拒否。
    if (!origin || !allowedOrigins.includes(origin)) {
      return errorResponse(403, "forbidden_origin", "Origin ヘッダが許可されていません。");
    }
    // 3. 状態変更リクエストは Content-Type: application/json 必須。
    if (!isJsonContentType(request.headers.get("Content-Type"))) {
      return errorResponse(415, "unsupported_media_type", "Content-Type は application/json を指定してください。");
    }
  } else {
    // GET は Origin 欠落を許可（same-origin fetch の GET は Origin を送らないのが通常のため）。
    // ただし Origin が付いていて許可リストに一致しない場合は拒否する。
    if (origin !== null && !allowedOrigins.includes(origin)) {
      return errorResponse(403, "forbidden_origin", "Origin ヘッダが許可されていません。");
    }
  }

  return null;
}

// PUT のレート制限（固定ウィンドウ 30 回 / 5 分）を適用する。
// カウンタを原子的に加算し、超過していればエラー Response を、許容内なら null を返す。
async function enforceRateLimit(db: D1Database, userId: string, now: number): Promise<Response | null> {
  // 現在時刻が属するウィンドウの開始時刻（ウィンドウ幅で切り捨て）。
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  // UPSERT + RETURNING でカウントを原子的に加算し、加算後の値を取得する（設計書「乱用対策」節の方式）。
  const row = await db
    .prepare(
      "INSERT INTO rate_limit (user_id, window_start, count) VALUES (?, ?, 1) " +
        "ON CONFLICT(user_id, window_start) DO UPDATE SET count = count + 1 RETURNING count",
    )
    .bind(userId, windowStart)
    .first<{ count: number }>();
  if (row !== null && row.count > RATE_LIMIT_MAX_REQUESTS) {
    return errorResponse(429, "rate_limited", "リクエストが多すぎます。しばらく待ってから再試行してください。");
  }
  return null;
}

// GET /api/data: 認証ユーザー自身の同期データを返す。行が無ければ 404。
async function handleGet(db: D1Database, userId: string): Promise<Response> {
  // データ隔離（設計書の最重要事項）: 必ずセッション由来の user_id でスコープする。
  const row = await db
    .prepare("SELECT payload, revision, updated_at FROM app_state WHERE user_id = ?")
    .bind(userId)
    .first<{ payload: string; revision: number; updated_at: string }>();

  if (row === null) {
    return errorResponse(404, "not_found", "同期データはまだ保存されていません。");
  }

  // payload カラムは SyncPayloadV1 の JSON 文字列。サーバー側で書き込み時に検証済みのため、そのまま返す。
  return Response.json({
    revision: row.revision,
    payload: JSON.parse(row.payload) as unknown,
    updatedAt: row.updated_at,
  });
}

// PUT /api/data: 楽観ロック付きで同期データを保存する。
async function handlePut(db: D1Database, userId: string, request: Request): Promise<Response> {
  // ボディサイズ上限の事前チェック（JSON parse 前。設計書「乱用対策」節）。
  // まず Content-Length ヘッダで早期拒否する（ヘッダは偽装可能なため、後段で実バイト数も検証する）。
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return errorResponse(413, "payload_too_large", "ペイロードが 512KB を超えています。");
  }

  // 実際のボディバイト数を検証する（こちらが確定判定）。
  const bodyBytes = await request.arrayBuffer();
  if (bodyBytes.byteLength > MAX_BODY_BYTES) {
    return errorResponse(413, "payload_too_large", "ペイロードが 512KB を超えています。");
  }

  // JSON として解釈する。構文エラーは 400。
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return errorResponse(400, "invalid_json", "リクエストボディが JSON として解釈できません。");
  }

  // SyncPayloadV1 の深い Zod 検証（キー欠落・null・内側スキーマ違反はすべて 400。設計書「入力検証」節）。
  const validation = putRequestSchema.safeParse(parsedBody);
  if (!validation.success) {
    return errorResponse(400, "invalid_payload", "リクエストボディの形式が不正です。");
  }

  const { baseRevision, payload } = validation.data;
  const payloadText = JSON.stringify(payload);
  const updatedAt = new Date().toISOString();

  if (baseRevision === null) {
    // 初回アップロード: INSERT ... ON CONFLICT DO NOTHING（設計書「行が存在しない場合の作成方式」）。
    // 並行して別端末が先に行を作成していた場合は挿入 0 件となるので 409 を返す。
    const result = await db
      .prepare(
        "INSERT INTO app_state (user_id, payload, revision, updated_at, payload_format_version) " +
          "VALUES (?, ?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING",
      )
      .bind(userId, payloadText, updatedAt, SYNC_FORMAT_VERSION)
      .run();
    if (result.meta.changes === 0) {
      return errorResponse(409, "conflict", "サーバーに既にデータが存在します。最新データを取得してください。");
    }
    return Response.json({ revision: 1, updatedAt });
  }

  // 通常更新: revision 一致時のみ更新する条件付き UPDATE（楽観ロック。設計書「同期方式」節）。
  // 競合判定はサーバー発行 revision のみで行う（クライアントの updatedAt は使わない）。
  const result = await db
    .prepare(
      "UPDATE app_state SET payload = ?, revision = revision + 1, updated_at = ?, payload_format_version = ? " +
        "WHERE user_id = ? AND revision = ?",
    )
    .bind(payloadText, updatedAt, SYNC_FORMAT_VERSION, userId, baseRevision)
    .run();
  if (result.meta.changes === 0) {
    return errorResponse(409, "conflict", "リビジョンが一致しません。最新データを取得してください。");
  }
  return Response.json({ revision: baseRevision + 1, updatedAt });
}

// /api/data のエントリポイント。CSRF 検証 → 認証 → （PUT のみ）レート制限 → 各メソッド処理の順に適用する。
export async function handleDataRequest(request: Request, env: AuthEnv, auth: Auth): Promise<Response> {
  // CSRF ミドルウェア（許可メソッド限定・Origin 検証・Content-Type 必須化）。
  const csrfError = validateCsrf(request, parseAllowedOrigins(env.ALLOWED_ORIGINS));
  if (csrfError !== null) {
    return csrfError;
  }

  // セッション認証。user_id は必ずサーバー側セッションから取得する（クライアント提供 ID は信用しない）。
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return errorResponse(401, "unauthorized", "ログインが必要です。");
  }
  const userId = session.user.id;

  if (request.method === "GET") {
    return handleGet(env.DB, userId);
  }

  // PUT のみレート制限を適用する（設計書「乱用対策」節）。
  const rateLimitError = await enforceRateLimit(env.DB, userId, Date.now());
  if (rateLimitError !== null) {
    return rateLimitError;
  }

  return handlePut(env.DB, userId, request);
}

// 期限切れの rate_limit 行を削除する（日次 Cron Trigger から呼ばれる）。
// 現在のウィンドウより前に開始したウィンドウはすべて期限切れとして削除する。
export async function cleanupExpiredRateLimitRows(db: D1Database, now: number): Promise<void> {
  const currentWindowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  await db.prepare("DELETE FROM rate_limit WHERE window_start < ?").bind(currentWindowStart).run();
}
