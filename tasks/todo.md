# Cloudflare Workers 移行 Phase 1: Workers + Static Assets 化

参照設計書: `docs/design/workers-migration.md`（確定済み設計。再調査・再検討は不要。本計画はその実装手順）

## スコープ

- 段階的移行計画の **Phase 1 のみ**: ホスティングを GitHub Pages → Cloudflare Workers + Static Assets へ移行する。
- データ層は現状の `localStorage` のまま。認証（better-auth）・D1・`/api/data` 実装は Phase 2 以降で行わない。
- 実デプロイ（Cloudflare アカウント・API トークン・カスタムドメイン設定）はユーザー作業のため本セッションでは行わない。コードと CI をデプロイ可能な状態に整えるところまでが完了条件。

## 前提（調査済みの現状）

- React 19 + Vite 7 + TS + Zod の静的 SPA。react-router 不使用（state 駆動のタブ切替のみ）→ SPA フォールバック要件は軽微。
- `vite.config.ts` に `GITHUB_PAGES=true` 時に `base: '/pcre-tracker/'` とする分岐あり。
- CI は `.github/workflows/deploy-pages.yml` 一本: `npm ci` → `npm run generate` + 差分チェック → `npm run test:ci` → `npm run build`（GITHUB_PAGES=true）→ upload-pages-artifact → deploy-pages。
- `wrangler.jsonc` / Worker コード / `@cloudflare/vite-plugin` は存在しない（ゼロから追加）。
- vitest 設定は `vitest.config.ts` に分離済み（vite.config.ts への plugin 追加が vitest に影響しない構成）。

## Todo

- [x] 1. devDependencies 追加: `wrangler`（最新）、`@cloudflare/vite-plugin`（GA 版、Vite 7 対応）
- [x] 2. `wrangler.jsonc` 新規作成
  - `name`, `compatibility_date`（実装日）, `main`（Worker エントリ）
  - `assets.directory`（Vite のクライアントビルド出力ディレクトリを指定。`@cloudflare/vite-plugin` 利用時の正しい値は公式 docs に従う）
  - `assets.not_found_handling: "single-page-application"`（設計書指定）
  - `run_worker_first: ["/api/*"]`（設計書指定）
  - カスタムドメインの route 設定はドメイン名未確定（設計書の未確定事項）のため今回は含めない。ドメイン決定後に追加する旨をコメントで明記
- [x] 3. 最小 Worker 実装（例: `worker/index.ts`）
  - `/api/*` へのリクエストに 404 JSON を返すのみ（Phase 2 で実 API に置換するプレースホルダ）
  - AGENTS.md 規約に従い全関数に日本語コメント
- [x] 4. `vite.config.ts` 更新
  - `@cloudflare/vite-plugin` の `cloudflare()` を plugins に追加
  - `GITHUB_PAGES` による base 切替を削除し `base: '/'` に統一（Workers はドメイン直下配信のため）
- [x] 5. TypeScript 設定
  - Worker コード用の型設定（`wrangler types` による `worker-configuration.d.ts` 生成、または `@cloudflare/workers-types`。公式推奨の方式を採用）
  - `tsconfig.worker.json` を新設し、root `tsconfig.json` の `references` に追加（`tsc -b` の対象に Worker を含める）
  - **`typecheck` スクリプトを `tsc --noEmit` → `tsc -b` に統一**する（現状の `tsc --noEmit` はプロジェクト参照を辿らないため、Worker 側の型エラーを見逃す。`npm run build` の `tsc -b` と挙動を揃える）
- [x] 6. GitHub Actions 更新（`deploy-pages.yml` → 置換）
  - `generate` 差分チェック → `test:ci` → `build` の流れは**維持**（設計書指定）
  - `GITHUB_PAGES=true` 環境変数を削除
  - deploy ステップを `cloudflare/wrangler-action` に差し替え（`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` は GitHub Secrets 参照。Secrets 登録はユーザー作業として README/PR に明記）
  - **job 構成は単一 job に変更**: 現行の 2 job 構成（build → upload-pages-artifact → deploy job）は Pages 専用 artifact 前提のため維持しない。`build` job 内で `npm run build` の直後に `wrangler-action` を実行する（deploy job 側に wrangler.jsonc・Worker ソース・dist が無い問題を回避）
  - `@cloudflare/vite-plugin` 利用時のデプロイコマンドは公式ドキュメントに従う（vite build の出力設定を用いた `wrangler deploy`。設定ファイルパスの指定要否を実装時に公式 docs で確認）
- [x] 7. README のデプロイ・開発手順の記述を更新（GitHub Pages 記述 → Workers 記述）
- [x] 8. 検証（完了の証明）
  - `npm run typecheck` / `npm test` / `npm run build` がすべて成功
  - `vite dev` 起動確認（`@cloudflare/vite-plugin` 併用で HMR + Worker が動くこと、`/api/foo` が 404 JSON を返すこと）
  - `vite preview` または `wrangler dev` でビルド成果物の配信確認（SPA が表示されること）
- [x] 9. レビュー: Claude レビューエージェント + codex（gpt-5.5）非対話モードによるダブルレビュー。指摘対応
- [x] 10. コミット（`develop`、Conventional Commits: type 英語 + description 日本語）。設計書 `docs/design/workers-migration.md` と本計画もコミットに含める

## ユーザー側作業（コード外・本計画のスコープ外）

- Cloudflare アカウント準備、`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` の GitHub Secrets 登録
- カスタムドメインの選定・取得・Workers への紐付け（設計書の未確定事項）
- 初回デプロイの動作確認

## レビューセクション

実施日: 2026-07-04

### 実装結果

- Todo 1〜8 をすべて完了。`wrangler.jsonc` の `assets.directory` は `@cloudflare/vite-plugin` が自動設定するため手動指定しない（公式 docs 準拠、計画からの正当な差異）。
- 型生成は `wrangler types` → `worker-configuration.d.ts`（gitignore 対象）。fresh checkout 対応として CI に `cf-typegen` ステップを typecheck/build より前に配置。
- 検証: `npm run typecheck`（tsc -b）/ `npm test`（126 件全パス）/ `npm run build` 成功。`vite dev` と `vite preview` で SPA 配信・`/api/*` の 404 JSON・SPA フォールバックを確認。`wrangler deploy --dry-run` 成功。

### ダブルレビュー結果

- **codex（gpt-5.5）**: 致命的指摘なし。fresh checkout 相当で cf-typegen → typecheck → build → deploy --dry-run を独自検証し成立を確認。
- **Claude（Opus）レビュー**: 致命的指摘なし。`run_worker_first: ["/api/*"]` 時は非 API パスが Worker を経由せず直接配信されるため最小 Worker で正しいこと、CI ステップ順序、secrets 名、tsconfig 参照整合、GITHUB_PAGES 削除の退行なしを公式 docs 裏取り付きで確認。
- 軽微な備忘: Phase 2（better-auth + D1）着手時に `compatibility_flags: ["nodejs_compat"]` の要否を確認すること。

### 発見した既存バグ（本移行とは無関係）

- `src/data/characterMaster.generated.json` が直近の「ルイズマリー（サマー）追加」時に再生成されておらず stale だった（CI の generate 差分チェックが main マージ時に落ちる状態）。再生成して別コミットで修正。
