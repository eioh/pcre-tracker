import { betterAuth } from "better-auth";

// better-auth インスタンスを生成するためのファクトリ。
//
// Cloudflare Workers では env（D1 バインディングやシークレット）はリクエスト時にしか得られないため、
// モジュールスコープでインスタンスを生成できない。よって fetch ハンドラ内でこのファクトリを呼び、
// リクエストごとに betterAuth インスタンスを生成する（調査済みの技術前提どおり）。
//
// D1 対応: better-auth 1.6.x は `database` に D1 バインディング（batch/exec/prepare を持つオブジェクト）を
// 直接渡すと内蔵の D1SqliteDialect を自動選択する。追加アダプタ・パッケージは不要。

// この Worker が env から受け取る認証関連の設定値の型。
export type AuthEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // CSRF 検証・trustedOrigins 用の許可オリジン（カンマ区切り）。
  ALLOWED_ORIGINS: string;
};

// 許可オリジン文字列（カンマ区切り）を配列へ分解する。
// 認証エンドポイントの trustedOrigins と、独自 API の CSRF 検証の双方で共有する。
export function parseAllowedOrigins(allowedOrigins: string): string[] {
  return allowedOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

// env を受け取り、リクエストごとに betterAuth インスタンスを生成する。
export function createAuth(env: AuthEnv) {
  // ソーシャルプロバイダは、対応する clientId/clientSecret が env に存在する場合のみ有効化する。
  // ローカル/テスト環境でシークレット未設定でもインスタンス生成が失敗しないようにするため。
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }

  return betterAuth({
    // D1 バインディングを直接渡す（内蔵 D1 ダイアレクトが自動選択される）。
    database: env.DB,
    // 署名・暗号化に用いるシークレット（wrangler secret で管理。設計書指定）。
    secret: env.BETTER_AUTH_SECRET,
    // baseURL は自動推定に依存せず明示設定する（設計書「better-auth 運用設定」節）。
    baseURL: env.BETTER_AUTH_URL,
    // /api/auth/* の Origin 検証（better-auth 組み込み）で許可するオリジン（設計書指定）。
    trustedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    // GitHub / Google のソーシャルログインのみ。パスワード認証は実装しない（設計書指定）。
    socialProviders,
    user: {
      // アカウント削除 API（/api/auth/* 配下）を有効化する（設計書指定）。
      deleteUser: { enabled: true },
    },
    advanced: {
      // セッション Cookie の属性を明示する（HttpOnly / Secure / SameSite=Lax。設計書指定）。
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      },
    },
  });
}

// createAuth の戻り値型（ルーティング・セッション取得で使う）。
export type Auth = ReturnType<typeof createAuth>;
