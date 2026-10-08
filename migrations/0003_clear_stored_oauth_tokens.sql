-- Migration number: 0003 	 2026-10-09T00:00:00.000Z
-- account テーブルに保存済みの OAuth トークン（アクセストークン・リフレッシュトークン・ID トークン）と、
-- その有効期限を削除する（NULL にする）。
--
-- 理由:
-- - このアプリはログイン状態の判定にセッション Cookie だけを使い、プロバイダの API を呼ばないため、
--   保存された OAuth トークンを利用していない。
-- - account.encryptOAuthTokens を有効にする前に保存されたアクセストークン・リフレッシュトークンは
--   平文のまま残っており、better-auth はそれらを暗号化し直さない。不要な値を保持し続けないよう削除する。
--
-- 影響:
-- - 次回ログイン時に better-auth が新しいトークンを保存し直す（アクセストークン・リフレッシュトークンは
--   暗号化して保存され、Google の ID トークンは暗号化の対象外）。
-- - scope、各 ID、作成・更新日時、password 列は変更しない。updatedAt も更新しない。
-- - 何度実行しても結果は同じ（トークンが残っている行だけが対象になる）。
update "account"
set
  "accessToken" = null,
  "refreshToken" = null,
  "idToken" = null,
  "accessTokenExpiresAt" = null,
  "refreshTokenExpiresAt" = null
where
  "accessToken" is not null
  or "refreshToken" is not null
  or "idToken" is not null
  or "accessTokenExpiresAt" is not null
  or "refreshTokenExpiresAt" is not null;
