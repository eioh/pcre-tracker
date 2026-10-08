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
- better-auth の認証テーブル定義を変更した場合は `npx auth@<版> generate --config auth-cli.config.ts --output <出力先>.sql` で SQL を再生成し、新しいマイグレーションファイルとして `migrations/` に追加してください（適用済みファイルは編集しない）。`<版>` には `package-lock.json` に記録された `better-auth` と同じ版を指定します（例: `npx auth@1.6.23 generate ...`）。CLI は devDependencies に含めず、必要なときだけ版を固定して実行します。

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
- `develop` または `main` 向けの PR では `.github/workflows/pr-check.yml` の 2 つのジョブが動きます。どちらも Cloudflare の Secrets を使用せず、本番の D1 マイグレーションやデプロイも実行しません。
  - `verify`: 生成物の整合性、Worker 型生成、テスト、型チェック、本番ビルド、デプロイ用設定の検証（`npm run verify`）を行い、ビルド成果物（`dist/`）をアーティファクトとして保存します。
  - `deploy-dry-run`: 本番の deploy ジョブと同じ手順（`npm ci --ignore-scripts` → 成果物の取得 → デプロイ用設定の検証）の後、`wrangler deploy --dry-run` で公開処理を認証以外まで確認します。
- `main` ブランチへの push で `.github/workflows/deploy.yml` が次の 2 ジョブを順に実行します。
  - `build`: PR と同じ検証（`npm run verify`）と本番ビルドを行い、成果物をアーティファクトとして渡します。このジョブには Secrets を渡しません。
  - `deploy`: GitHub Environment `production` の Secrets を使うジョブです。lockfile に固定された wrangler を `npm ci --ignore-scripts` で入れ、成果物の `wrangler.json` を `scripts/verify-deploy-config.mjs` でリポジトリの `wrangler.jsonc` と照合してから、本番 D1 マイグレーションと `wrangler deploy` を `--config dist/pcre_tracker/wrangler.json` で実行します。
- ワークフローで使う action はフル SHA で固定しています。更新は `.github/dependabot.yml` により、GitHub Actions と npm の更新 PR が月 1 回 `develop` 向けに作られます。
- ビルド構成: `vite build` で静的アセットを `dist/client/`、Worker とデプロイ用 `wrangler.json` を `dist/pcre_tracker/` に出力します。`@cloudflare/vite-plugin` が `assets.directory` を自動設定するため、`wrangler.jsonc` では手動指定していません。
- `scripts/verify-deploy-config.mjs` は、生成された `wrangler.json` のキーを許可リストで確認し、公開先・バインディング・環境変数などが `wrangler.jsonc` と一致することを検証します。`wrangler.jsonc` に新しい設定を追加した場合や、`@cloudflare/vite-plugin` / wrangler の更新で生成物のキーが変わった場合は、このスクリプトの許可リストも更新してください（`npm run verify` と PR の `deploy-dry-run` で検出されます）。
- 手動公開も GitHub Actions の `Deploy to Cloudflare Workers` を `main` ref で実行します。`main` 以外の ref を選んだ場合、build / deploy の両ジョブとも実行されません。
- ローカルでは `npm run verify` で公開前と同じ検証を実行できます。ローカルからのデプロイは、検証や本番 D1 マイグレーションの省略を防ぐため正式な公開経路として提供していません。
- PR の検証をマージ必須にする場合は、GitHub の Ruleset またはブランチ保護で `verify` と `deploy-dry-run` を必須チェックに設定してください。
- `wrangler.jsonc` で `workers_dev` と `preview_urls` を `false` にしており、Worker にはカスタムドメインからのみ到達できます。

### セットアップ手順（本番は設定済み。再構築時の参考）

- GitHub の Settings → Environments で `production` を作成し、デプロイ可能なブランチを `main` のみに制限します。
- `production` の Environment secrets に以下を登録します（リポジトリ全体の Secrets には置きません）:
  - `CLOUDFLARE_API_TOKEN`（対象アカウント・ゾーンに限定した API トークン。Workers のデプロイ権限と D1 の編集権限が必要）
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
- GitHub と Google で確認済みの同じメールアドレスを使うと、同じアカウントとして扱われます（better-auth の既定のアカウントリンク）。メールアドレスが異なる場合は別アカウントになり、手動で統合する機能はありません。

#### Worker シークレットの登録

```bash
npx wrangler secret put BETTER_AUTH_SECRET   # 例: openssl rand -base64 32 で生成
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

- `BETTER_AUTH_URL`（本番 URL）と `ALLOWED_ORIGINS`（許可オリジン。カンマ区切り）は `wrangler.jsonc` の `vars` に設定済みです（`https://pkne.app`）。
