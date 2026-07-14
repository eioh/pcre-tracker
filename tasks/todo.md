# ヘッダーUI刷新: 右上ボタン群をドロップダウンメニューに集約（案A）

## 背景

デスクトップヘッダー右上に「ログイン / エクスポート / インポート / 保存データを初期化」の4ボタン + 最終更新日時が横並びで、ログイン後はさらに「同期ステータス + ユーザー名 + ログアウト + アカウント削除」に膨らむ。項目増加に耐えられるよう、役割別の2ドロップダウンに集約する。

- **データメニュー**（常時表示、トリガー「データ」）: エクスポート / インポート / ─区切り─ / 保存データを初期化（危険色）/ ─区切り─ / フッターに「最終更新: …」
- **アカウントメニュー**: 未ログイン時は従来どおり「ログイン」ボタン（既存ログインダイアログを開く）。ログイン後はユーザー名チップ → メニュー（ヘッダー部: 表示名 + 同期ステータス / ─区切り─ / ログアウト / アカウント削除（危険色））

モバイル（768px未満、`MobileHeader` のボトムシート）は既に集約済みのため**今回は変更しない**。

作業ブランチ: `feature/header-dropdown-menu`（`git fetch` 後、**origin/develop** から作成。リポジトリ規約は feature → develop → main のため PR 先は **develop**）

## 対象ファイルと現状

- `src/App.tsx` 371-411行: デスクトップヘッダー（4ボタン横並び + 最終更新）。各ハンドラ（`handleExportBackup` / `handleSelectImportFile` / リセットダイアログ open）は App が保持
- `src/components/SyncHeader.tsx`: ログインUI本体。未ログイン=ログインボタン+ダイアログ、ログイン後=ステータス文字列+表示名+ログアウト+アカウント削除ボタン+各種ダイアログ。**デスクトップとモバイル(`MobileHeader` のシート内)の両方から使用される**
- `src/components/FileImportButton.tsx`: hidden file input + ボタン
- `src/components/ui/`: DropdownMenu は未導入。`@radix-ui/react-popover` は導入済み

## 設計方針

1. **DropdownMenu コンポーネント新規追加**: AGENTS.md の規約どおり `npx shadcn@latest add dropdown-menu` で雛形取得（`@radix-ui/react-dropdown-menu` が依存に追加される）→ DESIGN.md（スレートナイト）のトークン（`bg-popover-bg` 等の CSS 変数）に合わせてカスタマイズ。compound component（`DropdownMenuTrigger` / `DropdownMenuContent` / `DropdownMenuItem` / `DropdownMenuSeparator` / `DropdownMenuLabel`）をそのまま公開
2. **データメニュー**: 新規コンポーネント `src/components/HeaderDataMenu.tsx`。props でハンドラを受け取る（`onExport` / `onSelectImportFile` / `onRequestReset` / `updatedAtLabel`）
   - インポート: **hidden file input はメニューコンテンツの外**（HeaderDataMenu のルート直下）に置き、メニュー項目の `onSelect` から ref 経由で `click()` する。メニュー閉鎖でコンテンツがアンマウントされても input が消えないようにするため。`FileImportButton` は流用できない場合、input 部分のロジック（accept="application/json"、選択後 value リセット）を踏襲する
   - 初期化: `onSelect` → App の `setIsResetDialogOpen(true)`。確認ダイアログは App 直下にあるためメニュー閉鎖の影響なし（既存のまま）
   - エクスポート: `onSelect` → `handleExportBackup` 直接呼び出し（既存挙動どおり確認なし）
   - フッター: `DropdownMenuLabel`（非インタラクティブ）で「最終更新: …」を表示。App.tsx 409行の表示は撤去
3. **SyncHeader にレイアウト変形を追加**: `variant: "inline" | "dropdown"`（デフォルト `"inline"` で現行挙動維持 = モバイル無変更）
   - `dropdown` 時のログイン後: ユーザー名チップ（表示名 or「ログイン中」+ chevron）をトリガーに DropdownMenu を表示。中身は Label（表示名 + 同期ステータス文字列。`formatSyncStatus` を流用）/ Separator / ログアウト / アカウント削除（危険色）
   - `dropdown` 時の未ログイン: 現行と同じ「ログイン」ボタン（変更なし）
   - **ログインダイアログ・削除確認/結果ダイアログは SyncHeader ルート直下のまま**（メニューコンテンツの子にしない）。メニューが閉じてもダイアログは維持される
   - 同期ステータスの常時表示が失われる代償として、同期エラー時のみチップに警告インジケータ（例: 危険色のドット）を出す
4. **App.tsx デスクトップヘッダー**: `<SyncHeader variant="dropdown" …>` + `<HeaderDataMenu …>` の2要素に置き換え。エクスポート/インポート/初期化ボタンと最終更新表示を撤去。`FileImportButton` はデスクトップから撤去されるがモバイルで使用継続のため削除しない
5. **日本語コメント**: 全関数に付与（リポジトリ規約）

## 実装ステップ

- [x] `git fetch origin && git switch -c feature/header-dropdown-menu origin/develop`
- [x] `npx shadcn@latest add dropdown-menu` → `src/components/ui/dropdown-menu.tsx` をスレートナイトのトークンへカスタマイズ（既存 `select.tsx` / `sheet.tsx` のスタイルを参考）
- [x] `HeaderDataMenu.tsx` 新設（エクスポート / インポート(hidden input はコンテンツ外) / 初期化(危険色) / 最終更新フッター）
- [x] `SyncHeader.tsx` に `variant` prop 追加。`dropdown` 時のログイン後 UI をユーザー名チップ + メニューに変更。ダイアログ群はルート直下のまま維持
- [x] `App.tsx` デスクトップヘッダーを 2 要素構成へ置き換え
- [x] テスト更新・追加:
  - 既存テストで旧ヘッダーボタン参照があれば追随
  - HeaderDataMenu: メニュー展開で3項目+最終更新が出る / エクスポート項目クリックで onExport 発火 / 初期化項目クリックで onRequestReset 発火 / ファイル選択で onSelectImportFile 発火
  - SyncHeader(dropdown): ログイン後にチップ→メニュー展開でログアウト/アカウント削除が出る / ログアウトクリックで signOut / inline(モバイル) が現行どおり
- [x] `npm run typecheck` / `npm test` / `npm run build`（typecheck 緑 / front+worker 全 38 ファイル 301 テスト緑 / build 緑）
- [ ] dev サーバーで実画面確認（未ログイン・メニュー展開・インポートのファイル選択・初期化ダイアログ・モバイル幅で無変更）+ スクリーンショット
  - 実画面確認は実施済み（未ログインヘッダー2要素化・データメニュー展開で3項目+最終更新・初期化ダイアログ表示・モバイル幅は無変更を確認）。スクリーンショットはブラウザペインのキャプチャがタイムアウトするため未取得
- [ ] codex + Claude 系サブエージェントの2系統レビュー → 致命的指摘ゼロまで修正ループ
- [ ] Conventional Commits でコミット → push → **develop 向け** PR 作成（目的 / 変更概要 / 確認結果 / スクリーンショット）

## スコープ外

- MobileHeader / ボトムシートの変更（既に集約済み）
- デスクトップとモバイルのメニュー項目定義の共通化（将来課題）
- ログインダイアログ自体・認証フローの変更
- 「マイページ」「設定」等の新項目追加

## リスク・注意点

- `MobileHeader` はシートを閉じると SyncHeader ごとアンマウントされる制約（MobileHeader.tsx 111-116 コメント）があるが、今回はモバイル無変更なので影響なし。デスクトップ側では同種の罠（ダイアログをメニュー内に置くとメニュー閉鎖で消える）を上記設計で回避する
- Radix DropdownMenu の `onSelect` はデフォルトでメニューを閉じる。ファイル選択ダイアログはユーザージェスチャ内で `input.click()` を同期呼び出しすれば開く想定。挙動が不安定なら `onSelect` 内で `event.preventDefault()` → 手動クローズ順序を制御する
