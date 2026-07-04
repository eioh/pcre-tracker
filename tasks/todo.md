# Cloudflare Workers 移行 Phase 2: better-auth + D1 導入、`/api/data` 実装

参照設計書: `docs/design/workers-migration.md`（確定済み設計。再調査・再検討は不要。本計画はその実装手順）
Phase 1 の記録は git 履歴（cf1394e の tasks/todo.md）を参照。

## スコープ

- 段階的移行計画の **Phase 2 のみ**: better-auth + D1 の導入と `/api/data` の実装（サーバー側）。
- **フロントエンドの同期層（UI からの同期呼び出し・ログイン UI）は Phase 3**。本フェーズは Worker 側 API とテストまで。
- 実際の D1 データベース作成・OAuth アプリ登録・secrets 設定はユーザー作業。**プレースホルダ `database_id`（全ゼロ UUID）でローカル開発・テストを完結**させる（Cloudflare 公式サンプルと同じ手法。ローカル miniflare は ID を API 照会しない）。

## 調査済みの技術前提（実装時に再調査不要）

- better-auth 最新安定版 1.6.x。**v1.5+ で D1 ネイティブ対応**: `betterAuth({ database: env.DB })` と D1 バインディングを直接渡す。追加アダプタ・パッケージ不要。原子性は D1 `batch()` を内部使用。
- **インスタンスはリクエストごとに生成**（env はリクエスト時にしか得られないため、fetch ハンドラ内でファクトリ関数から生成。モジュールスコープ生成は不可）。
- **`nodejs_compat` フラグが必要**。compatibility_date は 2024-09-23 以降が条件で、現状（2026-07-04）は満たしている。
- スキーマ生成: `npx @better-auth/cli generate` で SQL 出力 → wrangler の migration ファイルに転記 → `wrangler d1 migrations apply <DB> --local`。（CLI の `migrate` は D1 に接続不可のため使わない）
- **D1 は外部キー制約がデフォルト有効**（公式明記。接続ごとのプラグマ設定は不要かつ無効化不可）。`ON DELETE CASCADE` は機能する。設計書の「foreign_keys プラグマ確認」はこの公式仕様確認をもって消化。CASCADE 検証テストは設計書どおり実施する。
- テスト: `@cloudflare/vitest-pool-workers` 現行版（0.18.x）は **Vitest 4.1+ 必須**（peerDeps）。API は `cloudflareTest()` Vite プラグイン方式。D1 へのマイグレーション適用は `readD1Migrations()` + `applyD1Migrations()`。jsdom 環境とは共存不可のため **Vitest multi-project 構成で分離**する。
- Cron: `triggers.crons` + `scheduled` ハンドラ（fetch と同居する `ExportedHandler`）。ローカルは `/cdn-cgi/handler/scheduled` への HTTP リクエストで手動発火可能（vite-plugin 対応済み）。
- アカウント削除: `user.deleteUser.enabled: true` で better-auth 組み込みの delete-user エンドポイント（`/api/auth/*` 配下）が有効化される。独自エンドポイント不要。

## Todo

- [x] 1. **Vitest 4 アップグレード**（vitest-pool-workers の前提条件）
  - `vitest` を 4.1+ へ、`@vitest/*` 関連・`@testing-library/*` の互換確認。公式 3→4 移行ガイドに従う
  - 既存 126 テストが全パスすることを確認してから次へ進む（壊れたら本タスク内で修正）
  - 万一互換問題が解決不能な場合のフォールバック: vitest-pool-workers 0.12.x（Vitest 3 対応最終版）に固定。ただしまず 4 系移行を試す
- [x] 2. **テスト基盤: Vitest multi-project 構成**
  - フロント（jsdom、既存 `vitest.config.ts` 相当）と Worker（`@cloudflare/vitest-pool-workers`、`cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })`）を projects で分離
  - Worker 側 setup で `readD1Migrations()` + `applyD1Migrations()` により D1 にマイグレーション適用
  - `npm test` で両プロジェクトが走ること
- [ ] 3. **wrangler.jsonc 更新**
  - `compatibility_flags: ["nodejs_compat"]` 追加
  - `d1_databases`: binding `DB`、`database_id` はプレースホルダ全ゼロ UUID + 「デプロイ前に `wrangler d1 create`（location hint `apac`、設計書指定）で置換」コメント
  - `triggers.crons`: 日次 1 回（rate_limit 掃除用）
- [ ] 4. **D1 マイグレーション作成**（`migrations/`）
  - better-auth CLI で生成した auth テーブル（user/session/account/verification）の SQL
  - `app_state`（user_id PK・FK `ON DELETE CASCADE` / payload TEXT / revision INTEGER / updated_at / payload_format_version INTEGER）— 設計書「スキーマ」節の通り
  - `rate_limit`（複合 PK (user_id, window_start)・FK `ON DELETE CASCADE` / count INTEGER）
- [ ] 5. **better-auth 統合**（`worker/auth.ts` 等）
  - env を受け取るファクトリでリクエストごとに生成。`database: env.DB`
  - `baseURL`（env 変数、明示設定）/ `trustedOrigins` / `secret`（`BETTER_AUTH_SECRET`）
  - socialProviders: GitHub / Google（clientId/clientSecret は env から）
  - Cookie: `HttpOnly` / `Secure` / `SameSite=Lax`（better-auth デフォルトを確認し、不足があれば明示設定）
  - `user.deleteUser.enabled: true`（アカウント削除。設計書指定）
  - `/api/auth/*` を better-auth ハンドラにルーティング
  - `.dev.vars.example` をコミット（キー一覧のみ）、`.dev.vars` を .gitignore に追加
- [ ] 6. **`SyncPayloadV1` スキーマ**（`src/domain/sync.ts` 新設。Phase 3 でクライアントからも使うため src/domain に置く）
  - 設計書の型定義どおり: `formatVersion: 1` + 対象 2 キー（両方 object 必須、optional/null 不可）
  - **深い検証**: `StoredStateV1` / `ConnectRankCalcStateV1` の既存 Zod スキーマまで検証する。浅い `z.record(z.unknown())` は不可（設計書「入力検証」節）
  - **DOM 非依存モジュールへの分離（必須）**: `STORAGE_KEY`（storage.ts）や `CONNECT_RANK_CALC_STORAGE_KEY` + 計算タブ schema（connectRankCalcStorage.ts）は `window`/`localStorage` を含むファイルにあるため、Worker から直接 import しない。storage キー定数と Zod スキーマを DOM 非依存のモジュール（例: `src/domain/storageKeys.ts` / スキーマ分離ファイル）へ切り出し、既存ブラウザコードはそこから re-export して後方互換を保つ。Worker/sync.ts は分離後のモジュールのみ import する
  - マスターデータとの照合・`reconcileWithMaster` 相当の補正はサーバーでは**行わない**（設計書「信頼境界」節）
- [ ] 7. **`/api/data` 実装**（`worker/` 配下）
  - 共通ミドルウェア（設計書「CSRF 対策」節の 3 点、better-auth 管轄外の独自 API に必須）:
    1. Origin ヘッダ検証: **PUT（状態変更）は Origin 必須かつ許可オリジン一致**（不一致・欠落は拒否）。**GET は Origin 欠落を許可**（same-origin fetch の GET は Origin を送らないのが通常のため）。ただし GET でも Origin が付いていて不一致なら拒否。許可リストは env から
    2. 状態変更リクエスト（PUT）の `Content-Type: application/json` 必須化
    3. 許可メソッド限定（`/api/data` は GET / PUT のみ、他は 405）
  - 認証: better-auth のセッション検証で `user_id` を取得。未認証は 401。**全クエリを `WHERE user_id = ?` でスコープ**（クライアント提供 ID は一切使わない — 設計書「データ隔離」節）
  - `GET /api/data`: 行あり → `{ revision, payload, updatedAt }`、行なし → 404 JSON
  - `PUT /api/data`: リクエスト `{ baseRevision: number | null, payload: SyncPayloadV1 }`
    - ボディサイズ上限 512KB（JSON parse 前に Content-Length とボディ実サイズで確認、超過 413）
    - Zod 深い検証（不正 400）
    - `baseRevision: null`（初回）→ `INSERT ... ON CONFLICT(user_id) DO NOTHING`、挿入 0 件なら 409
    - `baseRevision: number` → `UPDATE ... SET revision = revision + 1 WHERE user_id = ? AND revision = ?`、更新 0 件なら 409
    - 競合判定はサーバー発行 `revision` のみ（クライアントの `updatedAt` は使わない）
  - レート制限（PUT のみ）: 固定ウィンドウ 30 回/5 分、`INSERT ... ON CONFLICT(user_id, window_start) DO UPDATE SET count = count + 1 RETURNING count`、超過 429。`/api/auth/*` は対象外（設計書どおり）
- [ ] 8. **Cron ハンドラ**: `scheduled` で期限切れ `rate_limit` 行を日次削除
- [ ] 9. **テスト**（設計書の必須要件を含む）
  - **データ隔離**: ユーザー A のセッションで B のデータが読めない・書けない（必須）
  - **退会連動削除**: user 行削除で `app_state` / `rate_limit` / セッション系が CASCADE 削除される（必須。可能なら better-auth の delete-user API 経由、困難なら user 行削除で CASCADE を直接検証し、deleteUser 有効化は別途アサート）
  - 楽観ロック: revision 不一致 409 / 初回 INSERT 競合 409 / 正常更新で revision +1
  - 入力検証: キー欠落・null・深い検証違反の 400、512KB 超の 413
  - CSRF ミドルウェア: 不正 Origin 拒否、Content-Type 不正拒否、未許可メソッド 405
  - レート制限: 31 回目の PUT が 429
  - 既存フロントテスト 126 件の全パス維持
- [ ] 10. **CI 更新**: デプロイ前に `wrangler d1 migrations apply <DB> --remote` ステップを追加（DB 未作成のうちは deploy 同様に実行不能だが、secrets 登録後に一体で動く構成にする）
- [ ] 11. **README 更新**: ローカル開発（.dev.vars 準備、マイグレーション適用）、ユーザー作業（D1 作成 `--location apac` 相当、OAuth アプリ登録、`wrangler secret put` 一覧）
- [ ] 12. **検証**: `npm run typecheck` / `npm test`（フロント + Worker 両プロジェクト）/ `npm run build` 全成功。`vite dev` で `/api/auth/*` 応答と `/api/data` の 401 を確認
- [ ] 13. **レビュー**: Claude レビューエージェント + codex（gpt-5.5）ダブルレビュー。指摘対応
- [ ] 14. **コミット**（`develop`、Conventional Commits）

## ユーザー側作業（コード外・本計画のスコープ外）

- `wrangler d1 create <name> --location apac` 実行と `database_id` の差し替え
- GitHub / Google の OAuth アプリ登録（本番 + ローカル用の 2 系統、callback URL: `https://<domain>/api/auth/callback/<provider>`）
- `wrangler secret put`: `BETTER_AUTH_SECRET` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- カスタムドメイン確定と `baseURL` / 許可オリジンの本番値設定

## レビューセクション

（実装完了後に記入）
