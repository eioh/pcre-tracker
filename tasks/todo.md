# スマホ UI フェーズ2: 入力の高速化 実装計画

フェーズ0(モバイル一覧+編集シート)・フェーズ1(骨格再設計、コミット cc3e800 / 311e947 / 809d61a)は完了済み。作業ブランチ: `feature/mobile-input-layout`。

## 背景・ゴール

編集シート(InputCharacterEditSheet)内の入力操作コストが高い:
- ☆(1〜6)・コネクトRANK(0〜15)・専用1/専用2 が Select ドロップダウン。「1つ上げる」が大半なのに毎回3操作(タップ→スクロール→タップ)。RANK は16択で画面の半分を覆う
- 数値入力(所持メモピ/所持ピュアピ/ガチャ回数)はソフトキーボード必須
- 最重要情報「あと何個必要?」がシート最下部
- 保存フィードバックが固定文言のみ

ゴール: **モバイル編集シートの主要操作を1〜2タップ化し、必要数を最上部に、保存状態を可視化する。デスクトップ(768px 以上)のテーブル内 UI は一切不変。**

スコープ外: 入手日(Popover+Calendar は低頻度入力のため現状維持)、ステッパーの長押し連打、下部固定ナビ(フェーズ3)。

## 前提(コード調査で確認済みの事実)

- `StarSelect` / `ConnectRankSelect` / `Ue1Select` / `Ue2Select` / 数値入力3種は**デスクトップテーブルとモバイルシートで共用**(progressFields.tsx)。直接ステッパー化するとテーブルが壊れる
- `UE1_LEVEL_VALUES = [0, 30, 50, 70, ..., 370]`(31要素、**非連続値**)。「+1」ではなく配列インデックスで1段進める必要がある。`ue1CompositeValue` は `"sp" | "0".."370" | "null"` の複合値で、SP 選択時は `{ ue1Level: 370, ue1SpEquipped: true }` の複合パッチ(progressFields.tsx:99-129 の Ue1Select と同一ロジックが必要)
- `UE2_LEVEL_VALUES = [0..5]` 連続値。`connectRank` は 0..15、`star` は 1..6 のリテラル union(キャスト必要)。`starMax` は `character.implemented.star6 ? 6 : 5`
- 保存経路: 編集 → `handleUpdateProgress`(App.tsx:238-261)→ setState + `sync.notifyLocalChange()`。localStorage 保存は 400ms debounce(App.tsx:126-133)。同期 PUT は 10 秒 debounce(useSync.ts)。**ステッパー連打はタイマー貼り直しのみで PUT レートに影響なし(対策不要と確認済み)**
- `sync.status` は編集直後〜PUT 開始まで最大10秒 `idle` のままなので、保存インジケータの一次情報源には使えない(判断5の根拠)
- `useClampedNumberInput` は draft 文字列 + blur/Enter コミット方式。クランプ関数 `clampOwnedMemoryPiece` はモジュールプライベート(export 追加が必要)
- テスト: `InputProgressTable.test.tsx` はデスクトップ専用(無修正通過=不変の証明)。`InputProgressList.test.tsx` の combobox 系4アサーション+「変更は即時保存されます」文言検証(116行)は書き換え必須。数値系は spinbutton ロール+aria-label 参照のため input を残せば無修正で通る

## 設計判断(確定)

1. **分岐方法: モバイル専用コンポーネントを `src/components/input/mobileFields.tsx` に新設**。progressFields.tsx への変更はクランプ関数の export 追加のみ(既存 export 無改変=デスクトップ完全不変)。共通の見た目は mobileFields 内の `StepperShell` プリミティブ1つに集約(shadcn カタログに無い UI のため ui/ でなく input/ 配下)
2. **専用1の SP は最上段のステップとして統合**: ステップ列 = `[...UE1_LEVEL_VALUES, "sp"(ue1Sp 実装時のみ)]`。Lv.370 で「+」→ SP、SP で「−」→ Lv.370。既存 Select の選択肢順と同一のメンタルモデル。RANK(0=未開放)・UE2 も同じ「値リスト+インデックス歩進」方式で統一。未実装は disabled「-」表示
3. **☆はセグメンテッドコントロール**: 常に 1〜6 の6ボタンを描画し、star6 未実装キャラは「6」を disabled(レイアウトジャンプ回避+情報量)。`aria-pressed` 付きボタン群(radiogroup より既存テスト流儀と親和)。選択中+isAtMax は maxed スタイル(TableSelect の appearance="maxed" と同じ CSS 変数)
4. **数値ステッパー**: `[−][number input][+]`。input は type/aria-label とも既存と同一(既存テスト無修正)。+/− は即コミット、直接入力は従来通り blur/Enter。`useClampedNumberInput` に `stepBy(delta)` を追加(draft 文字列基準でクランプ後歩進→即コミット。既存4プロパティ不変)。−/+ ボタンは `min-h-11 min-w-11`(44px)
5. **保存インジケータの情報源はローカル保存 debounce を一次+ログイン時は sync を補助**: App に `isLocalSavePending` state(保存 effect 拡張、初回マウントは ref スキップ)。`sheetSaveStatus: "saving" | "saved" | "syncing" | "error"` に合成(優先度 saving > syncing/error(ログイン時) > saved)し、`InputTab → InputProgressList → InputCharacterEditSheet` へ prop 1個をバケツリレー(単一プロパティなので Context は過剰)。`SheetDescription` を動的表示に置換、`aria-live="polite"`。sync.status の生値を出さない理由: 編集直後も最大10秒 idle のままで「同期済み」と誤表示されるため
6. **必要数はコンパクトサマリー方式**: ヘッダー直下に「必要メモピ / 必要ピュアピ」の2値サマリー(太字 tabular-nums)を新設し、内訳セクションは現位置維持。内訳ごと上へ移すと☆/RANK がファーストビュー(85dvh)から追い出され、入力高速化の主目的と衝突するため
7. **saveStatus は optional prop(デフォルト "saved")**にして既存テストの props 追加を最小化

## 実装ステップ(コミット単位)

### ステップ1: `feat: 編集シートの☆をセグメンテッドコントロール化`
- `mobileFields.tsx` 新規: `StarSegmentedControl`(StarSelect と同シグネチャ、grid-cols-6、min-h-11)
- `InputCharacterEditSheet.tsx`: ☆を差し替え(1行占有に変更)
- テスト: ☆の combobox 検証をボタンタップに書き換え(「6」タップで `{ star: 6 }`、未実装キャラの「6」disabled)
- 検証: `npm test`(**InputProgressTable.test.tsx 無修正通過**)/ `npm run typecheck`

### ステップ2: `feat: 編集シートのRANKと専用装備をステッパー化`
- `mobileFields.tsx`: `StepperShell` + 値リスト歩進ヘルパー + `ConnectRankStepper` / `Ue1Stepper` / `Ue2Stepper`
- `InputCharacterEditSheet.tsx`: 3フィールド差し替え
- テスト: combobox テストを「+」歩進・SP 到達・上下限 disabled の検証へ書き換え。**「Lv.130 の + が Lv.140 を返す」非連続区間のテストを必ず追加**。期待パッチ(`{ ue1Level: 370, ue1SpEquipped: true }` 等)は不変

### ステップ3: `feat: 編集シートの数値入力にステッパーを追加`
- `useClampedNumberInput.ts`: `stepBy(delta)` 追加(既存 API 不変)
- `progressFields.tsx`: クランプ関数の export 追加のみ
- `mobileFields.tsx`: `OwnedMemoryPieceStepper` / `OwnedPurePieceStepper` / `GachaPullCountStepper`
- `InputCharacterEditSheet.tsx`: 3入力差し替え
- テスト: +/− 即コミット、入力途中(未 blur)に + を押した場合の draft 基準歩進、上限(ガチャ300)/下限0 disabled

### ステップ4: `feat: 編集シートに必要数サマリーをヘッダー直下へ追加`
- `InputCharacterEditSheet.tsx`: ヘッダー直下に2値サマリーボックス(`adjustedTotalRemainingMemoryPiece` / ピュアピ合計)。内訳は現位置維持
- テスト: サマリー表示の検証追加

### ステップ5: `feat: 編集シートに保存インジケータを表示`
- `App.tsx`: `isLocalSavePending` + `sheetSaveStatus` 合成、InputTab へ prop 追加
- `InputTab.tsx` / `InputProgressList.tsx`: prop 中継(デスクトップ分岐は未使用)
- `InputCharacterEditSheet.tsx`: `SheetDescription` を動的表示(保存済み ✓ / 保存中... / 同期中... / 同期エラー、トーン色分け)
- テスト: 文言検証(116行)を saveStatus 別表示に書き換え

### 共通の検証
各ステップで `npm test` / `npm run typecheck`、最終で `npm run build`。**InputProgressTable.test.tsx と InputTab.test.tsx のデスクトップ系テストは全ステップ無修正で通過させる。**

### 手動確認(375×812)
1. ☆: 6ボタンのタップ、star6 未実装の「6」disabled、☆6 で maxed 表示
2. RANK: 「+」15連打で 0→15、タップ毎にサマリー・一覧行の「必要」即時更新、上下限 disabled
3. 専用1: Lv.130→140(非連続区間)、370→SP→370 往復、SP 非実装キャラは 370 で + disabled、未実装キャラは「-」
4. 数値: −/+ で**ソフトキーボードが起動しない**こと、直接入力との共存、ガチャ300上限
5. 保存インジケータ: 編集直後「保存中...」→約0.4秒で「保存済み ✓」。未ログイン時に同期系文言が出ないこと
6. 連打時のフレーム落ちがないか(シート裏の仮想化一覧)
7. デスクトップ: テーブル内 Select・数値入力・Tooltip が完全に従来通り

## リスク

1. **入力途中(未 blur)に +/− を押した場合の基準値**: `stepBy` は draft 文字列を基準にクランプ後歩進する設計で吸収。テストで明示的にカバー
2. **連打時のレンダーコスト**: タップ毎に App 全体再レンダー(既存 Select と同経路、memo 済み)。実機で15連打のもたつきを確認、問題があれば SheetBody への props 安定化を追補
3. **保存インジケータの初回表示**: マウント時の保存 effect で「保存中」が一瞬出ないよう ref スキップ。リセット/インポート直後の挙動も確認
4. **InputProgressList.test.tsx の書き換え**: combobox 系4アサーション+文言1件。発火パッチの期待値は不変なので UI 操作部分のみの置換

## レビュー(2026-07-08 実装完了)

### 実施結果

- [x] ステップ1: `b0c179c` ☆のセグメンテッドコントロール化(常時6ボタン、star6 未実装は disabled)
- [x] ステップ2: `78923c8` RANK・専用装備のステッパー化(StepperShell+値リスト歩進、SP は最上段ステップ)
- [x] ステップ3: `314717a` 数値入力に −/+ 併設(useClampedNumberInput.stepBy 追加、既存 API 不変)
- [x] ステップ4: `3c6bea2` 必要数サマリーをヘッダー直下へ(2値コンパクト、内訳は現位置維持)
- [x] ステップ5: `9a65e26` 保存インジケータ(isLocalSavePending + sheetSaveStatus 合成)

### 検証結果(375×812 実測)

- `npm test` 266 テスト全通過、`npm run typecheck` / `npm run build` 通過
- **InputProgressTable.test.tsx / InputTab.test.tsx は全ステップ無修正で通過**(デスクトップ不変の証明)。デスクトップ実表示も combobox 52個/ステッパー0個で従来通り
- ☆ボタンは 51×44px(44px 基準クリア)、ステッパー12個、−/+ でソフトキーボード起動なし
- RANK ステッパータップ → localStorage 即保存、保存インジケータ「保存中...」(150ms 時点)→「保存済み ✓」(800ms 時点)の遷移を実測確認
- 必要メモピ/ピュアピの2値サマリーがシートを開いた直後のファーストビューに表示
- 非連続区間(Lv.130→140)・SP 往復・上下限 disabled・draft 基準歩進はテストでカバー

### 計画からの逸脱(軽微・報告済み)

- ステッパー化した行は grid-cols-2 でなく全て1行占有(375px では 44px×2 ボタン+中央表示が2カラムに収まらないため)
- 保存インジケータの初回マウントスキップは boolean ref でなく「直近予約 state の参照比較」方式(StrictMode の effect 二重実行で誤点灯するため)
- InputProgressList.test.tsx の既存内訳アサーション1行を getAllByText 化(サマリー追加で同値が2箇所に現れるため)
- App.test.tsx に保存インジケータの結合テストを追加(window.scrollTo スタブ+タイムアウト延長)

### 残課題(今後)

- フェーズ3: 磨き込み(一覧行のチェックボックス拡大・行レイアウト2行化・下部固定ナビ)
- 別途: PWA 化、他タブのモバイル調整、hover 依存改善、タブ切替時のスクロール位置復元

---

## 参考: 完了済みフェーズの記録

- フェーズ0(育成入力のモバイル一覧+編集シート): 8861240 / c25e9f9 / f8a5552 / cc6b2fa / b817e9f
- フェーズ1(骨格再設計): cc3e800(コンパクトヘッダー+⋯メニュー)/ 311e947(ページスクロール化+sticky 検索バー)/ 809d61a(フィルタシート+チップ)。ファーストビューの一覧 3行→9行
- 既知の制約: タブ切替で window スクロール位置がクランプされ一覧先頭に戻ることがある
- 残: フェーズ3(チェックボックス拡大・行レイアウト・下部固定ナビ)、PWA 化、他タブ調整、hover 依存改善
