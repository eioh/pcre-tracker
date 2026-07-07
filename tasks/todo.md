# スマホ UI フェーズ3: 磨き込み 実装計画

フェーズ0〜2(モバイル一覧+編集シート、骨格再設計、入力高速化)は PR #4 で develop にマージ済み。作業ブランチ: `feature/mobile-polish`(develop 最新から分岐)。

## 背景・ゴール

残る磨き込み3点(いずれも 768px 未満のみ。デスクトップ不変):
1. 所持チェックボックスが 16px+実効ヒット幅約28px で WCAG 推奨(44px)未満。行タップ(シートを開く)との境界も視覚的に不明
2. 一覧行(64px 1行)の右側に「☆・RANK・必要メモピ・シェブロン」が text-muted で密集し読みづらい
3. タブが上部の横スクロールで、モバイルの定石(下部固定ナビ、親指到達圏)から外れる

## 前提(コード調査で確認済みの事実)

- 一覧行の固定高前提は `InputProgressList.tsx` の `h-16`(L79)と `estimateSize: () => 64`(L135)の2箇所のみ(measureElement 不使用)。行高変更はこの2値の同時変更で完結
- `TableCheckbox` は `cn("h-4 w-4", className)` の薄いラッパーで、twMerge により呼び出し側 `size-6` が後勝ちで確実に上書き可能。デスクトップテーブル・編集シートは className を渡していないため 16px のまま
- `activeTab` は `uiState.activeTab` として uiStorage で永続化済み(スキーマ変更不要)。Tabs は controlled で、`onValueChange` 内の `hasOpenedInput`(forceMount 制御)は Trigger が Radix である限り無変更で済む
- `TabsList`(ui/tabs.tsx)は **CoinShopTab 内のコインタブでも使用** → ui/tabs.tsx のデフォルトスタイル変更は不可(巻き添え)
- シート類は全て z-50、sticky 検索バーは z-10
- **index.html の viewport meta に `viewport-fit=cover` が無い**ため、iOS では `env(safe-area-inset-*)` が常に 0(既存シートの pb は実質無効だった)。下部固定ナビには cover 追加が本命
- テスト: 一覧行系テストは role/テキスト参照のみでレイアウト変更に不感。App.test.tsx にモバイル matchMedia スタブのパターン確立済み

## 設計判断(確定)

1. **チェックボックス拡大は呼び出し側 className 上書き**(`<TableCheckbox className="size-6 [&_svg]:size-4" />`)。ui/ 無改変=デスクトップ構造的に不変。ヒット領域はラベル側で確保: `min-w-11`(44px)+ `justify-center` + **`border-r border-white/10` の縦罫線で「左=チェック / 右=行タップ」の境界を可視化**
2. **行レイアウトは3段スタック**(タグ行 0.72rem / 名前 font-bold / サマリー行)。サマリー行は左寄せで `☆n`・`RANK n` は text-xs text-muted、`必要 n` は **text-sm font-bold text-main に格上げ**。シェブロンは右端縦センター維持。行高は **80px**(`h-20` + `LIST_ROW_HEIGHT_PX = 80` 定数化、両側に相互参照コメント)。タグ+名前を1行に連結する案は長名キャラで truncate 頻発のため不採用。ファーストビュー9行→約7行のトレードオフは可読性優先で許容(窮屈なら 72px へ微調整の余地)
3. **下部ナビは Tabs Root 内にモバイル専用の `TabsPrimitive.List` を条件レンダリング**(`src/components/MobileBottomNav.tsx` 新設、ui/ でなく components/ 直下)。Radix の value/onValueChange・forceMount・hasOpenedInput の経路は完全無変更、tablist/tab の a11y も自動。CSS レスポンシブ化(TabsList の max-md:fixed)はコインタブ巻き添えのため不可、Radix と独立した BottomNav は状態配線の二重化のため不可
   - スタイル: `fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/15 bg-bg-end pb-[env(safe-area-inset-bottom)]`。各 Trigger は `h-14 flex-col`(56px≥44px)+アイコン size-5+ラベル text-[10px]。アクティブは **色+font-bold のみ**(インジケータバーなし)
   - **z-index 設計**: ナビ z-40 < シート/オーバーレイ z-50 → シート表示中はシートが最前面(要件)
   - コンテンツ下部 padding: App ルート div を `isMobile` 時 `pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)]` に(フッターのポリシーリンクがナビに隠れない)
   - `index.html` に `viewport-fit=cover` 追加(env() が実値を返すようになる)
4. **モバイルでは上部 TabsList を非レンダリング**(何も残さない)。現在タブは下部ナビのハイライトで自明。`mb-5` 分ファーストビューがさらに広がる
5. **タブラベルの短縮(モバイルナビのみ、デスクトップ不変)**: 集計(ダッシュボード)/ 育成入力 / クラバト(クラバト編成)/ ショップ / ランク計算(コネクトランク計算)。1タブ 75px(375px÷5)に対し最長5文字=約50px で収まる。「ホーム」はデフォルトタブが育成入力のため誤解を招き不採用
6. hide-on-scroll(スクロール時のナビ自動非表示)は不採用(シンプル第一)

## 実装ステップ(コミット単位)

### ステップ1: `feat: モバイル一覧行の所持チェックのタップ領域を拡大`
- `InputProgressList.tsx` のみ: TableCheckbox に `size-6 [&_svg]:size-4`、label を `flex h-full min-w-11 shrink-0 items-center justify-center border-r border-white/10` へ
- テスト: 既存「所持チェックのタップはシートを開かない」が無修正通過(role/aria-label 不変)。スタイルのみのため追加不要
- 検証: `npm test` / `npm run typecheck`(InputProgressTable.test.tsx 無修正通過=デスクトップ16px不変の証明)

### ステップ2: `feat: モバイル一覧行を2行レイアウト化し行高を80pxへ拡大`
- `InputProgressList.tsx` のみ: `LIST_ROW_HEIGHT_PX = 80` 定数+`estimateSize` 変更、`h-16`→`h-20`(相互参照コメント)、左ブロックをタグ/名前/サマリーの3段グリッドへ再構成
- **テキストノード(`☆3` / `RANK 1` / `必要 N`)は現行と同一文字列を維持**(テスト無修正通過のため)
- 検証: `npm test` / `npm run typecheck` + 375px でスクロール(重なり・空白なし)

### ステップ3: `feat: モバイルのタブ切替を下部固定ナビへ移動`
- 新規 `src/components/MobileBottomNav.tsx`: TabsPrimitive.List/Trigger 直使用、5タブ(アイコンは App.tsx と同じ lucide を流用、ラベルは短縮版)、`aria-label="画面切り替え"`
- `src/App.tsx`: `{isMobile ? <MobileBottomNav /> : (既存 TabsList 無改変)}`、ルート div の pb を isMobile 分岐
- `index.html`: viewport meta に `viewport-fit=cover` 追加
- テスト(App.test.tsx 追加): ※「育成入力」「ショップ」は短縮版とフルラベルが同一文字列のため、検証は**ラベルが変わる3件に絞る**
  - モバイル: 「集計」「クラバト」「ランク計算」の tab が存在し、「ダッシュボード」「クラバト編成」「コネクトランク計算」の tab が不在/「集計」タップでダッシュボード表示+育成入力が DOM 残留(forceMount 維持)
  - デスクトップ: 「ダッシュボード」「クラバト編成」「コネクトランク計算」の tab が従来通り存在し、「集計」「ランク計算」の tab が不在
- 検証: `npm test` / `npm run typecheck` / `npm run build`

### 共通の検証
**InputProgressTable.test.tsx / InputTab.test.tsx / CoinShopTab 系テストは全ステップ無修正通過**(デスクトップ不変の証明)。関数コメントは日本語。

### 手動確認(375×812)
1. チェック: 24px 表示・44px ヒット領域でトグル、シートが開かない、縦罫線で境界視認
2. 行: 80px で名前・サマリーが読める。高速スクロールで重なり/空白なし。フィルタ切替後も末尾までスクロール可
3. 下部ナビ: 5タブが収まる(折返しなし)、切替動作、リロード後の activeTab 復元(uiStorage)
4. **シート/メニューを開くとナビがオーバーレイの下に隠れシートが最前面**
5. フッターのプライバシーポリシーリンクがナビに隠れない
6. ソフトキーボード表示中のナビ挙動が許容範囲か
7. デスクトップ: 上部タブ・テーブル・16px チェック・ショップ内コインタブすべて従来通り

## リスク

1. **`viewport-fit=cover` のグローバル影響**: ページ背景がノッチ/ホームバー下まで伸びる。背景はグラデ一色+px-5 で視覚破綻の可能性は低いが、iOS 実機(横向き含む)で要確認。問題時の代替: cover を見送りナビを pb-2 固定
2. **行高80px でファーストビュー 9行→約7行**: 可読性優先の意図的判断。実機で窮屈なら 72px へ微調整
3. **ナビ(bg-bg-end 単色)とグラデ背景の継ぎ目**: 最下部はほぼ bg-end で馴染む想定。要視認確認(必要なら半透明+backdrop-blur)
4. **タブ切替時のスクロール位置クランプ(既知の制約)**: 下部ナビで切替頻度が上がり顕在化しやすい。本フェーズではスコープ外を維持
5. Android でソフトキーボードの上にナビが乗る場合がある(許容範囲か手動確認)

## レビュー(2026-07-08 実装完了)

### 実施結果

- [x] ステップ1: `90f742d` 所持チェックのタップ領域拡大(24px 表示+44px ヒット領域+縦罫線で境界可視化)
- [x] ステップ2: `b88e950` 一覧行の2行(3段)レイアウト化+行高80px(LIST_ROW_HEIGHT_PX 定数化)
- [x] ステップ3: `5ccac7f` 下部固定ナビ(MobileBottomNav、TabsPrimitive 直使用、viewport-fit=cover 追加)

### 検証結果(375×812 実測)

- `npm test` 268 テスト全通過(新規2件)、`npm run typecheck` / `npm run build` 通過
- **InputProgressTable.test.tsx / InputTab.test.tsx / CoinShopTab 系テストは全ステップ無修正通過**(デスクトップ不変の証明)。デスクトップ実表示も上部タブ・16px チェック・コインタブ従来通り
- チェックラベル実測 44px 幅・チェック 24px、行高 80px、仮想化 translateY が 80px 刻みで整合
- 下部ナビ: 375px を 75px×5 に等分(折返しなし)、高さ56px、画面最下部に密着。アクティブは accent 色+太字
- z-index: シート/メニュー(z-50)がナビ(z-40)より前面に出ることを確認
- フッターのプライバシーポリシーリンクはナビに隠れない(bottom 740px < ナビ top 755px)
- タブ切替・リロード後の activeTab 復元(uiStorage)も確認

### 計画からの逸脱

- なし(Radix Tabs Trigger は mousedown で選択されるため、テストは fireEvent.mouseDown を使用 — 実装への影響なし)

### 残課題(今後)

- iOS 実機での safe-area 確認(viewport-fit=cover の実挙動、横向き回転)— エミュレータでは env() が 0 のため実機必須
- PWA 化(manifest / apple-touch-icon / theme-color / Service Worker)
- 他タブ(集計/クラバト/ショップ/ランク計算)のモバイル微調整(ガチャチャート min-w-[720px] 等)
- hover 依存 UI のタッチフィードバック改善
- タブ切替時の window スクロール位置復元(下部ナビで切替頻度が上がるため優先度上昇の可能性)

---

## 参考: 完了済みフェーズの記録

- フェーズ0(モバイル一覧+編集シート)/ フェーズ1(骨格再設計)/ フェーズ2(入力の高速化): PR #4(bb65877 で develop へマージ済み)。266 テスト、詳細は PR #4 本文
- 既知の制約: タブ切替で window スクロール位置がクランプされ一覧先頭に戻ることがある
- 残(フェーズ3後): PWA 化、他タブのモバイル調整、hover 依存改善
