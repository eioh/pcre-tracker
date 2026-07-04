# プリコネ育成トラッカー

プリンセスコネクト Re:Dive の育成状況を管理する React + TypeScript + Zod アプリです。未ログインでもブラウザ保存（localStorage）で全機能を利用でき、GitHub / Google でログインすると複数端末間でデータを同期できます。

本番: https://pkne.app

## 技術スタック

- React
- TypeScript
- Zod
- Vite

## 開発コマンド

```bash
npm install
npm run cf-typegen  # Cloudflare ランタイム型 (worker-configuration.d.ts) を生成
cp .dev.vars.example .dev.vars  # ローカル用の環境変数を用意（BETTER_AUTH_SECRET にランダム値を設定）
npm run dev         # vite dev。@cloudflare/vite-plugin により SPA の HMR と Worker API を同時起動
```

- `worker-configuration.d.ts` は `wrangler types` の生成物で gitignore 済みです。型チェック前に `npm run cf-typegen` を実行してください（`wrangler.jsonc` 変更後も再実行）。
- `/api/*` へのリクエストは `worker/index.ts` で処理されます。`/api/auth/*` は better-auth（GitHub / Google ソーシャルログイン）、`/api/data` は同期データの GET / PUT を提供します。
- `.dev.vars` は gitignore 済みです。`BETTER_AUTH_SECRET` は任意のランダム文字列（例: `openssl rand -base64 32`）を設定してください。GitHub / Google の `*_CLIENT_ID` / `*_CLIENT_SECRET` は未設定でも起動できます（その場合ソーシャルログインは使えません）。

### D1 マイグレーション（ローカル）

```bash
npx wrangler d1 migrations apply pcre-tracker-db --local  # ローカル（miniflare）の D1 に適用
```

- マイグレーション SQL は `migrations/` にあります。テスト実行時（`npm test` の worker プロジェクト）は自動で適用されるため、テストだけなら手動適用は不要です。
- better-auth の認証テーブル定義を変更した場合は `npx @better-auth/cli generate --config auth-cli.config.ts` で SQL を再生成し、新しいマイグレーションファイルとして `migrations/` に追加してください（適用済みファイルは編集しない）。

## データ構成

- マスター（手編集元）: `src/data/characterMaster.json`
- マスター（生成・アプリ参照）: `src/data/characterMaster.generated.json`
- マスターを更新した場合は `npm run generate` を実行して `searchTokens` を再生成し、生成ファイルをコミットしてください。
- 更新手順: `docs/character-master-update-guide.md`

## 保存先

- `localStorage` キー: `pcr_growth_tracker`（育成データ）ほか。保存データには `schemaVersion` を持たせ、将来の項目追加時にマイグレーションできる構成です。
- ログイン時は育成データとコネクトランク計算タブの 2 キーを D1（`/api/data`）へ同期します（UI 状態は端末ローカルのみ）。localStorage はログイン時もローカルキャッシュ兼オフライン動作用として維持されます。
- 設計の詳細は `docs/design/workers-migration.md` を参照してください。

## デプロイ（Cloudflare Workers + Static Assets）

- ホスティングは Cloudflare Workers + Static Assets です（カスタムドメイン `pkne.app` で稼働中）。
- `main` ブランチへの push で `.github/workflows/deploy.yml` が `wrangler deploy` により自動デプロイします。
- ビルド構成: `vite build` で静的アセットを `dist/client/`、Worker とデプロイ用 `wrangler.json` を `dist/pcre_tracker/` に出力します。`@cloudflare/vite-plugin` が `assets.directory` を自動設定するため、`wrangler.jsonc` では手動指定していません。
- ローカルでのデプロイは `npm run deploy`（`vite build && wrangler deploy`）で実行できます。

### セットアップ手順（本番は設定済み。再構築時の参考）

- GitHub リポジトリの Secrets に以下を登録します:
  - `CLOUDFLARE_API_TOKEN`（Workers デプロイ権限を持つ API トークン。D1 の編集権限も必要）
  - `CLOUDFLARE_ACCOUNT_ID`（Cloudflare アカウント ID）
- カスタムドメインは `wrangler.jsonc` の `routes` に設定済みです（`pkne.app`）。

#### D1 データベースの作成

```bash
npx wrangler d1 create pcre-tracker-db --location apac
```

- 出力された `database_id` を `wrangler.jsonc` の `d1_databases[0].database_id` に設定します（本番 ID は設定済み）。
- 本番 DB へのマイグレーションは CI（`.github/workflows/deploy.yml`）がデプロイ前に `wrangler d1 migrations apply pcre-tracker-db --remote` で自動適用します。

#### OAuth アプリの登録

- GitHub / Google それぞれで OAuth アプリを登録してください（本番用とローカル開発用の 2 系統を分離）。
- callback URL: `https://<ドメイン>/api/auth/callback/github` / `https://<ドメイン>/api/auth/callback/google`（ローカル用は `http://localhost:5273/api/auth/callback/<provider>`）。
- 複数プロバイダのアカウントリンクは未対応です。別プロバイダでログインすると別アカウント扱いになります。

#### Worker シークレットの登録

```bash
npx wrangler secret put BETTER_AUTH_SECRET   # 例: openssl rand -base64 32 で生成
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

- `BETTER_AUTH_URL`（本番 URL）と `ALLOWED_ORIGINS`（許可オリジン。カンマ区切り）は `wrangler.jsonc` の `vars` に設定済みです（`https://pkne.app`）。
