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

マスターデータ変換のみ実行:

```bash
npm run convert-master
```

## データ構成

- 元データ: `character_data.json`
- 変換後マスター: `src/data/characterMaster.json`

`npm run build` の前に `npm run convert-master` が自動実行されます。

## 保存先

- `localStorage` キー: `pcr_growth_tracker`
- 保存データには `schemaVersion` を持たせ、将来の項目追加時にマイグレーションできる構成です。

## GitHub Pages

- `main` ブランチへの push で `.github/workflows/deploy-pages.yml` が自動デプロイします。
- リポジトリ名が `pcr-my-data` の場合、`vite.config.ts` の `base` は `GITHUB_PAGES=true` 時に `/pcr-my-data/` になります。
