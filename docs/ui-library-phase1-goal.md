# UIライブラリ導入 Phase 1 目標

## 今回のスコープ
- `shadcn/ui` 風の共通 UI 基盤を追加する。
- ヘッダー操作ボタン、タブ切替、入力フィルタ、計算設定を共通部品へ置換する。
- テーブル本体構造は維持し、挙動変更を避ける。

## 変更対象
- `src/components/ui/*`
- `src/lib/utils.ts`
- `src/App.tsx`
- `src/components/InputTab.tsx`
- `src/components/input/InputFilters.tsx`
- `src/components/input/InputMemoryCalcSettings.tsx`
- `tsconfig.app.json`
- `vite.config.ts`

## 非変更方針
- `InputProgressTable` の構造・列仕様・計算ロジックは変更しない。
- `src/domain` / `src/utils` の振る舞いは変更しない。

## 受け入れ条件
- タブとヘッダー操作が従来通り機能する。
- フィルタ条件の変更が従来通り `onSettingsChange` に反映される。
- `npm run typecheck` と `npm test` が通る。

## 想定リスクと対策
- UI構造変更でテストの要素取得が不安定になる可能性。
  - role/name ベースの取得へ寄せて安定化する。
- 置換途中でスタイル責務が混在する可能性。
  - 新規見た目は `src/components/ui` に寄せる。
