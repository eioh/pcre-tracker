// /api/* の応答に付けるセキュリティ関連ヘッダの処理。
// Worker のエントリモジュール（worker/index.ts）からはハンドラ以外を export しないため、別モジュールに分けている。

/**
 * API 応答にセキュリティ関連のヘッダを付ける。
 * 静的アセットのヘッダは public/_headers で付くが、Worker が返す /api/* の応答には付かないためここで補う。
 * - X-Content-Type-Options: nosniff（Content-Type の推測を禁止）
 * - Cache-Control: no-store（応答側で Cache-Control を指定していない場合のみ。認証情報・同期データをキャッシュさせない）
 * 応答のヘッダは不変な場合があるため、本文・ステータス・ヘッダ（複数の Set-Cookie を含む）を引き継いだ複製に付ける。
 *
 * @param response 各 API ハンドラが返した応答
 * @returns ヘッダを付けた応答の複製
 */
export function withApiSecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("X-Content-Type-Options", "nosniff");
  if (!secured.headers.has("Cache-Control")) {
    secured.headers.set("Cache-Control", "no-store");
  }
  return secured;
}
