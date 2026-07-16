# 育成入力: 「専用1SP」実装有無フィルタの追加

## 背景

育成入力タブのフィルタには「専用1」マルチセレクト(未実装 / 各レベル / SP)があり、専用1の実装有無(`character.implemented.ue1`)で絞り込める。これに加えて、**専用1SPがゲームに実装されているか**(`character.implemented.ue1Sp`)で絞り込むフィルタを追加する。

- マスタデータ `implemented.ue1Sp` は既に存在する(例: ヒヨリ=true、ユイ=false)。データ追加は不要
- 既存「専用1」フィルタの「SP」選択肢は進捗(`progress.ue1SpEquipped`=ユーザーがSP装備済みか)を見るもので、実装有無フィルタとは別物。既存フィルタは変更しない

## 設計方針

「限定」「限界突破」等と同じ**単一Selectフィルタ**として「専用1SP」を新設する。2値(実装済み/未実装)+「すべて」なので、マルチセレクトではなくSelectが最もシンプル。

- 型: `Ue1SpImplementedFilter = "all" | "implemented" | "unimplemented"`(`limitedFilter` のパターンに準拠)
- 判定: `implemented` → `character.implemented.ue1Sp === true`、`unimplemented` → `=== false`
- UI: ラベル「専用1SP」、選択肢「すべて / 実装済みのみ / 未実装のみ」。配置は「専用1」マルチセレクトの直後
- 永続化・リセット・「表示に適用」の二段構えも既存Selectフィルタと同一挙動

## 対象ファイル(既存の limitedFilter パターンに完全準拠)

1. `src/domain/uiStorage.ts`
   - `Ue1SpImplementedFilter` 型追加(:13 付近)
   - `InputViewSettings` にフィールド追加(:41 付近)
   - 許容値配列 `UE1_SP_IMPLEMENTED_FILTER_VALUES` 追加(:65 付近)
   - `defaultInputViewSettings` に `"all"` 追加(:98 付近)
   - 永続化スキーマに `z.unknown().optional()` 追加(:119 付近)
   - `normalizeEnumValue` 呼び出し追加(:199 付近)
   - フィルタリセット対象に追加(リセット用オブジェクトがあれば)
2. `src/components/InputTab.tsx`
   - `AppliedDisplaySettings` の Pick 対象・`buildAppliedDisplaySettings`・`useState`・`useVisibleRows` への引数・`hasActiveFilter` 判定・リセット処理・`<InputFilters>` props に追加(既存 `limitedFilter` の各箇所に並べる)
   - **`settingsSyncToken` 用 useEffect(:319 付近)に `setUe1SpImplementedFilter(initialSettings.ue1SpImplementedFilter)` を追加**(データ読込・外部同期時の再同期漏れ防止。codex レビュー指摘)
3. `src/components/input/InputFilters.tsx`
   - props 追加、`resetFilters` に追加、「専用1」の直後に `<Select>` ブロック追加(「限定」ブロックのコピーで文言変更)
4. `src/components/input/useVisibleRows.ts`
   - params 追加、ループ内に判定追加:
     `filter !== "all"` のとき `character.implemented.ue1Sp !== (filter === "implemented")` なら `continue`
   - **行計算 `useMemo` の依存配列に `ue1SpImplementedFilter` を追加**(漏れると Select 変更が即時反映されない。codex レビュー指摘)。テストでも `rerender` で `"all"`→各条件へ変更した際の即時反映を検証する

ソート列は追加しない(既存の「専用1」ソートで SP は最上位扱い済み。今回はフィルタのみ)。

## 実装ステップ

- [x] `git fetch origin` → `git switch -c feature/ue1sp-implemented-filter origin/develop`(規約: feature → develop → main)
- [x] 上記4ファイルの実装(全関数に日本語コメント、AGENTS.md 規約準拠)
- [x] テスト追加・更新:
  - `useVisibleRows` 系テスト: 実装済みのみ/未実装のみ/すべて の絞り込み + rerender 即時反映(新規 `useVisibleRows.test.ts`、4件)
  - `InputFilters.test.tsx`: 「専用1SP」Select の表示・変更ハンドラ・リセット動作
  - `uiStorage.test.ts`: 不正値が `"all"` に正規化されること
  - `InputTab.test.tsx`: `settingsSyncToken` 変更時に本フィルタが `initialSettings` へ再同期されること
- [x] `npm run typecheck` / `npm test` / `npm run build`(typecheck 緑 / 39ファイル307テスト緑 / build 緑)
- [x] dev サーバーで実画面確認(「専用1」と「専用2」の間に表示・「実装済みのみ」で341→33件、ユイ除外/ヒヨリ残留・リセットで復帰)
- [x] codex + Claude 系サブエージェントの2系統レビュー → **両系統とも致命的指摘ゼロ**(codex 側で typecheck/test/build も再確認済み)
- [x] Conventional Commits でコミット(push/PR はユーザー確認後)

## レビュー(結果)

計画どおり実装完了。ブランチ `feature/ue1sp-implemented-filter`(origin/develop 基点)、7ファイル変更+新規テスト1ファイル。

- `uiStorage.ts`: `Ue1SpImplementedFilter = "all" | "implemented" | "unimplemented"` を LimitedFilter パターン準拠で追加(型・設定・許容値・デフォルト・スキーマ・正規化)
- `InputTab.tsx`: state 配線一式 + `settingsSyncToken` useEffect での再同期(codex プランレビュー指摘を反映)
- `InputFilters.tsx`: 「専用1」直後に単一 Select(すべて/実装済みのみ/未実装のみ)。モバイルは同一インスタンス共有のため自動対応
- `useVisibleRows.ts`: `implemented.ue1Sp` 判定 + useMemo 依存配列追加(codex プランレビュー指摘を反映)
- 検証: typecheck / test(39ファイル307テスト)/ build 全緑。実画面確認済み
- レビュー: codex(gpt-5.6-sol)+ Claude サブエージェントの2系統とも致命的指摘ゼロ。プランからの逸脱なし

## スコープ外

- 既存「専用1」フィルタの挙動変更(SP選択肢は進捗ベースのまま)
- ソート列の追加
- クラバトタブ等、育成入力以外のフィルタ
