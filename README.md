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

- マスター: `src/data/characterMaster.json`
- マスターを更新した場合は `npm run generate` を実行して `searchTokens` を再生成し、生成後の JSON をコミットしてください。
- 更新手順: `docs/character-master-update-guide.md`

## 保存先

- `localStorage` キー: `pcr_growth_tracker`
- 保存データには `schemaVersion` を持たせ、将来の項目追加時にマイグレーションできる構成です。

## GitHub Pages

- `main` ブランチへの push で `.github/workflows/deploy-pages.yml` が自動デプロイします。
- リポジトリ名が `pcr-my-data` の場合、`vite.config.ts` の `base` は `GITHUB_PAGES=true` 時に `/pcr-my-data/` になります。
