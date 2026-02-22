# Repository Guidelines

## プロジェクト構成とモジュール配置
アプリ本体は `src/` 配下にあります。
- `src/components/`: UI タブや React コンポーネント（`DashboardTab.tsx`、`InputTab.tsx` など）
- `src/domain/`: ドメインモデル、スキーマ、保存処理、レベル計算ロジック
- `src/utils/`: 画面表示向けの補助処理
- `src/data/characterMaster.json`: 変換後のマスターデータ
- `src/test/setup.ts`: Vitest の共通セットアップ
元データは `character_data.json`、変換スクリプトは `scripts/convert-master.mjs` です。

## ビルド・テスト・開発コマンド
- `npm run dev`: Vite 開発サーバーを起動
- `npm run convert-master`: `character_data.json` から `src/data/characterMaster.json` を再生成
- `npm run build`: データ変換 → TypeScript ビルド → 本番バンドル作成
- `npm run preview`: ビルド成果物をローカル確認
- `npm run typecheck`: 型チェックのみ実行（出力なし）
- `npm test`: Vitest を 1 回実行
- `npm run test:watch`: Vitest をウォッチ実行

## コーディング規約と命名
TypeScript + React 関数コンポーネントを前提とし、インデントは 2 スペースを使用します。
- コンポーネント・型: `PascalCase`
- 変数・関数: `camelCase`
- テストファイル: `*.test.ts`
既存の `src/domain`・`src/components` の命名パターンに合わせてください。
リポジトリ規約として、**すべての関数に日本語コメントを付与**してください。必要に応じて複雑な処理にも日本語コメントを追加します。

## テスト方針
テストは Vitest + Testing Library（`@testing-library/react`, `jsdom`）を使用します。
テストは対象コードの近くに配置し、例として `src/utils/dashboard.test.ts`、`src/domain/storage.test.ts` があります。
マージ前に、スキーマ検証・保存処理・主要な計算ロジックを優先してカバーしてください。

## コミットとプルリクエスト
`main` ブランチで直接作業せず、`develop` または `feature/*` ブランチを使用します。
コミットメッセージは Conventional Commits 形式 `<type>: <description>` を使い、`type` は英語、`description` は日本語で記述します。
例:
- `feat: ダッシュボードに装備進捗の集計を追加`
- `fix: ローカル保存のスキーマ移行漏れを修正`

PR には目的、変更概要、実施した確認（`npm test`、`npm run typecheck`）、UI 変更時のスクリーンショットを含めてください。
