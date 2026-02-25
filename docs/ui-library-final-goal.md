# UIライブラリ完全導入の最終目標

## 目的
- 画面全体の UI を `src/components/ui` の共通部品で統一し、画面ごとの重複スタイルを削減する。
- 新規機能追加時に、既存 UI の再利用だけで実装できる状態にする。

## 完了条件
- `App`、`InputTab`、`DashboardTab`、`input/*` が共通 UI 部品を利用している。
- 画面固有の色・余白・境界線指定が最小化され、variants で管理されている。
- `uiStyles.ts` の役割がテーブル固有または廃止可能な範囲まで縮小されている。
- `npm run typecheck` と `npm test` が継続的に通る。

## 達成状況（2026-02-24）
- 達成済み
- Phase 1: 完了（ヘッダー + 入力画面フィルタ/設定の共通部品化）
- Phase 2: 完了（テーブル操作UIの共通化）
- Phase 3: 完了（ダッシュボードカード/分布表示の共通化とスタイル集約）
- 追補（2026-02-25）: `Select` の `onValueChange` 統一、`FileImportButton` 導入、`Separator` 利用統一を反映
- 追補（2026-02-25）: `AlertDialog` による標準ダイアログ撤廃、`ui/table` / `ui/field` への構造移行を反映

## 最終構成
- 共通部品: Button / Input / Checkbox / Select / Tabs / Separator / AlertDialog / Field / Table / 複数選択UI / Table操作UI / StatCard / DistributionChart
- 画面: ヘッダー、タブ、フィルタ、計算設定、テーブル操作UI、ダッシュボードカード

## 非対象
- ドメインロジック（`src/domain`）
- 集計ロジック（`src/utils`）
