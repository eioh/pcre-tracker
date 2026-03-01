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
npm run dev
```

## データ構成

- マスター（手編集元）: `src/data/characterMaster.json`
- マスター（生成・アプリ参照）: `src/data/characterMaster.generated.json`
- マスターを更新した場合は `npm run generate` を実行して `searchTokens` を再生成し、生成ファイルをコミットしてください。
- 更新手順: `docs/character-master-update-guide.md`

## 保存先

- `localStorage` キー: `pcr_growth_tracker`
- 保存データには `schemaVersion` を持たせ、将来の項目追加時にマイグレーションできる構成です。

## GitHub Pages

- `main` ブランチへの push で `.github/workflows/deploy-pages.yml` が自動デプロイします。
- リポジトリ名が `pcre-tracker` の場合、`vite.config.ts` の `base` は `GITHUB_PAGES=true` 時に `/pcre-tracker/` になります。
