import { createAuthClient } from "better-auth/react";

// better-auth のクライアントインスタンス。
//
// サーバーは basePath `/api/auth`（better-auth デフォルト）で稼働しており、クライアントも同一オリジンのため、
// baseURL を明示せずデフォルト（現在のオリジン + `/api/auth`）に委ねると一致する。
//
// 公式 docs / 型定義（better-auth 1.6 の dist/client/react/index.d.mts）で裏取りした API:
// - `authClient.useSession()` → `{ data, isPending, isRefetching, error, refetch }`。
//     data は未ログイン時 null、ログイン時 `{ session, user }`。user は `{ id, email, name, ... }`。
// - `authClient.signIn.social({ provider, callbackURL })` → OAuth へリダイレクトする。
// - `authClient.signOut()` → セッションを破棄する。
export const authClient = createAuthClient();

// 呼び出し側で扱いやすいよう、よく使う API を名前付きで再輸出する。
export const { useSession, signIn, signOut } = authClient;
