# プリコネ育成トラッカー

プリンセスコネクト Re:Dive の育成状況をブラウザ保存で管理する React + TypeScript + Zod アプリです。

## 技術スタック

- React
- TypeScript
- Zod
- Vite

## 開発コマンド

```bash
npm install
npm run cf-typegen  # Cloudflare ランタイム型 (worker-configuration.d.ts) を生成
npm run dev         # vite dev。@cloudflare/vite-plugin により SPA の HMR と Worker API を同時起動
```

- `worker-configuration.d.ts` は `wrangler types` の生成物で gitignore 済みです。型チェック前に `npm run cf-typegen` を実行してください（`wrangler.jsonc` 変更後も再実行）。
- `/api/*` へのリクエストは `worker/index.ts` で処理されます（Phase 1 では未実装のプレースホルダとして 404 JSON を返します）。

## データ構成

- マスター（手編集元）: `src/data/characterMaster.json`
- マスター（生成・アプリ参照）: `src/data/characterMaster.generated.json`
- マスターを更新した場合は `npm run generate` を実行して `searchTokens` を再生成し、生成ファイルをコミットしてください。
- 更新手順: `docs/character-master-update-guide.md`

## 保存先

- `localStorage` キー: `pcr_growth_tracker`
- 保存データには `schemaVersion` を持たせ、将来の項目追加時にマイグレーションできる構成です。

## デプロイ（Cloudflare Workers + Static Assets）

- ホスティングは Cloudflare Workers + Static Assets です（GitHub Pages からの移行 Phase 1）。
- `main` ブランチへの push で `.github/workflows/deploy.yml` が `wrangler deploy` により自動デプロイします。
- ビルド構成: `vite build` で静的アセットを `dist/client/`、Worker とデプロイ用 `wrangler.json` を `dist/pcre_tracker/` に出力します。`@cloudflare/vite-plugin` が `assets.directory` を自動設定するため、`wrangler.jsonc` では手動指定していません。
- ローカルでのデプロイは `npm run deploy`（`vite build && wrangler deploy`）で実行できます。

### 事前準備（ユーザー作業）

- GitHub リポジトリの Secrets に以下を登録してください:
  - `CLOUDFLARE_API_TOKEN`（Workers デプロイ権限を持つ API トークン）
  - `CLOUDFLARE_ACCOUNT_ID`（Cloudflare アカウント ID）
- カスタムドメインは未確定のため `wrangler.jsonc` に `routes` は未設定です。ドメイン確定後に追記してください。
