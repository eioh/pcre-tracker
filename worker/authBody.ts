import { readBodyWithLimit } from "./data";

// /api/auth/* のリクエストボディ上限（バイト）。本アプリが使う認証 API の本文は数百バイト程度。
// better-auth の入力検証（zod）は上限のない配列の要素ごとにエラーを積み上げるため、巨大な本文で
// メモリを使い切らせる攻撃を、検証より前に本文の大きさで断つ。
export const MAX_AUTH_BODY_BYTES = 16 * 1024;

// 上限超過を表す 413 の JSON レスポンスを生成する。
function payloadTooLargeResponse(): Response {
  return Response.json({ error: "payload_too_large", message: "リクエストボディが大きすぎます。" }, { status: 413 });
}

/**
 * /api/auth/* のリクエストボディを上限付きで読み込み、better-auth に渡すリクエストを作り直す。
 *
 * @param request 受信した HTTP リクエスト
 * @returns 上限内なら本文を読み込み済みのリクエスト、超えていれば 413 の JSON レスポンス
 */
export async function limitAuthRequestBody(request: Request): Promise<Request | Response> {
  if (request.body === null) {
    return request;
  }
  // Content-Length で早期に拒否し、偽装や未指定に備えて実際のバイト数でも確かめる。
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null && Number(contentLength) > MAX_AUTH_BODY_BYTES) {
    return payloadTooLargeResponse();
  }
  const body = await readBodyWithLimit(request, MAX_AUTH_BODY_BYTES);
  if (body === null) {
    return payloadTooLargeResponse();
  }
  return new Request(request, { body });
}
