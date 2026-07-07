# スマホ UI フェーズ1: 画面骨格の再設計 実装計画

前フェーズ(育成入力のモバイル一覧+編集シート、コミット 8861240〜b817e9f)は完了済み。本フェーズはその上に積む。作業ブランチ: `feature/mobile-input-layout`。

## 背景・ゴール

実測済みの課題(いずれも 375×812 での測定):
- ファーストビューの 72% をヘッダー(タイトル+ログイン/エクスポート/インポート/初期化+最終更新)・タブ・詳細設定・検索が占有し、キャラ一覧は下部 227px のみ
- 「詳細設定」展開時は高さ 1,286px・セレクト 10 個が縦一列に挿入される
- 一覧が `h-[70dvh]` の内部スクローラーで、ページスクロールと二重(ページ 1,283px + 内部 21,824px)

ゴール: **768px 未満で「コンパクトヘッダー+sticky 検索/チップバー+ページスクロール1本の一覧」という骨格にする。デスクトップ(768px 以上)は見た目・挙動とも一切不変。**

スコープ外: ステッパー化などの入力 UI 改善(フェーズ2)、下部固定ナビ(フェーズ3)、タブ切替時のスクロール位置復元。

## 前提(コード調査で確認済みの事実)

- ヘッダーは App.tsx:309-349 に直書き。エクスポート/インポート/初期化のハンドラは `useCallback` 済みで props 化しやすく、確認ダイアログ群は App ルートに独立(ヘッダー構造に非依存 → メニュー化してもダイアログは無改修)
- `SyncHeader.tsx` の `formatSyncStatus` はモジュール内プライベート(ステータス表示だけ取り出す口がない → export する)
- InputTab のフィルタ/ソート/計算モード state はローカル useState → `onSettingsChange` → App `uiState.input` → `saveUiState` の一方向。`InputFilters` / `InputMemoryCalcSettings` は純 presentational で置き場所を変えても状態経路は無傷。`inputToolbarClass` は lg 未満 `grid-cols-1` なのでシートに入れても自然に縦1列
- `hasActiveDetailFilter`(InputTab.tsx:270-282)が既に9種の詳細フィルタの非デフォルト判定を持つ(件数化の土台)
- `@tanstack/react-virtual@^3.13.19` に `useWindowVirtualizer` あり(確認済み)
- sticky の障害物なし: `tableWrapClass` の `[contain:layout_paint_size]` はデスクトップテーブル専用(使用箇所は InputProgressTable.tsx:391 のみ)。モバイル一覧の祖先チェーン(body / App ルート / Tabs / TabsContent / section)に overflow 指定なし。ただし詳細設定アニメーション用ラッパー(InputTab.tsx:352 の `overflow-hidden`)の内側には sticky を置かないこと
- `TabsContent value="input"` は初回表示後 forceMount + `display:none`。非表示中は offsetTop が計測不能になる点に注意(リスク2参照)
- `InputViewSettings`(uiStorage.ts)のスキーマ変更は不要

## 設計判断(確定)

1. **スマホのヘッダー構成**: タイトル(縮小)+ 同期ステータス(ログイン時のみ、短いテキスト。収まらなければドットに落とす)+ 「⋯」ボタンの1〜2行。サブタイトル2行はスマホ非表示。エクスポート/インポート/初期化/最終更新/ログイン導線は ⋯ メニューへ(未ログイン時はメニュー先頭に「ログイン」)
2. **⋯メニューは既存 Sheet(`side="bottom"`)を再利用**(DropdownMenu の新規依存は追加しない)。項目タップ時はシートを閉じてから App 側ハンドラを呼ぶ
3. **分岐方法**: `MobileHeader` コンポーネント新設 + App.tsx で `isMobile ? <MobileHeader/> : (既存 JSX 無改変)`。CSS だけの分岐(両方マウント)は SyncHeader のダイアログ・aria 二重化のため不可(前フェーズと同じ判断)
4. **window スクロール化**: モバイル専用の `InputProgressList` 内部で `useVirtualizer` → `useWindowVirtualizer` に置換(コンポーネント境界が既に分岐を担うため追加分岐不要)。行配置は `translateY(start - scrollMargin)`。jsdom 用フォールバック行戦略は維持。**`scrollMargin` は ref 直参照ではなく state で管理**する: ref 更新は再レンダーを起こさず、ヘッダー高の変化・sticky バーの変化・タブ再表示・回転/リサイズで offsetTop が変わっても virtualizer に反映されないため(ズレると行の空白・重なり・タップ位置ズレになる)。`useLayoutEffect` + `ResizeObserver`(一覧要素と祖先の変化)+ `window resize` で `getBoundingClientRect().top + window.scrollY` を再計測して setState し、変化時は `virtualizer.measure()` を呼ぶ
5. **sticky 検索/チップバー**: モバイルでは section② のパネル枠をやめ、「sticky バー(検索+チップ+フィルタボタン、不透明背景+z-10)」+「素の一覧」に組み替え。表示件数はチップ行の右端
6. **フィルタシート**: `InputFilterSheet` は `open` / `onOpenChange` / `children` のみ受ける薄いコンポーネント。配線済み `<InputFilters/>` + `<Separator/>` + `<InputMemoryCalcSettings/>` は InputTab 側で children として渡す(30 props の再宣言をしない)
7. **チップ**: 初期は「所持のみ」「未所持のみ」の2個(`setOwnedFilter` トグル、相互排他)。チップ行は `overflow-x-auto` にして将来の追加(限定のみ等)を容易に。チップとシート内 Select は同一 state なので自動同期
8. **適用中バッジ**: `activeDetailFilterCount`(useMemo)を追加し「フィルタ」ボタンに件数表示。既存 `hasActiveDetailFilter` は `count > 0` に置換(デスクトップのバッジ挙動は不変)。ソート・計算モードは件数に含めない(現行の線引きを踏襲)
9. **シートの開閉はローカル state**(永続化しない)。シート閉時の自動「表示に適用」はしない(デスクトップと挙動差を作らない)
10. **詳細設定パネル(section①)はモバイルで非レンダリング**(フィルタシートに置換)。`isDetailSettingsOpen` state はデスクトップ用に残す

## 実装ステップ(コミット単位)

### ステップ1: `feat: スマホ向けコンパクトヘッダーとメニューシートを追加`

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/components/SyncHeader.tsx` | 変更 | `formatSyncStatus` に export を付けるのみ |
| `src/components/MobileHeader.tsx` | 新規 | コンパクトヘッダー+⋯メニュー(Sheet)。props: `updatedAt`、`onExportBackup`、`onSelectImportFile: (file: File) => void`、`onRequestReset`、SyncHeader 用一式。**インポート項目は既存 `FileImportButton`(hidden file input 内蔵)をメニュー項目スタイルで埋め込む**(`onSelectImportFile` をメニュー項目から直接呼ぶ設計は File が無く成立しない)。ファイル選択完了時にシートを閉じてからハンドラを呼ぶ。他項目はタップで `setOpen(false)` → ハンドラ |
| `src/App.tsx` | 変更 | `useIsMobile()` 追加、header 内を `isMobile ? <MobileHeader/> : (既存 JSX)` で分岐。ハンドラはそのまま渡す |

- テスト: `MobileHeader.test.tsx` 新規(⋯タップでメニュー表示、項目タップでハンドラ発火+シートが閉じる、未ログイン時にログインが出る)。既存 `App.test.tsx` がデスクトップ経路のまま通ること
- 手動確認(375px): ヘッダー占有の縮小、メニューからエクスポート/インポート/初期化/ログインの各ダイアログ動作(**Sheet 上に AlertDialog が重なるネストと focus trap を重点確認**)。768px 以上で差分ゼロ

### ステップ2: `feat: モバイル一覧をページスクロールへ変更し検索バーを固定表示にする`

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/components/input/InputProgressList.tsx` | 変更 | `useWindowVirtualizer` へ置換、`h-[70dvh] overflow-y-auto` を撤去し自然高、`translateY(start - scrollMargin)`、フォールバック維持。scrollMargin は state 管理(useLayoutEffect + ResizeObserver + resize で再計測、設計判断4参照) |
| `src/components/InputTab.tsx` | 変更 | return を `isMobile` で JSX 分岐(state・ハンドラは共有)。モバイル側: sticky 検索バー+表示件数+一覧。詳細設定パネルはこのステップでは従来通り表示(差分の独立性のため。ステップ3で置換) |

- テスト: `InputProgressList.test.tsx` がフォールバック経路で通ること(必要最小の修正のみ)。`InputTab.test.tsx` のモバイルテストが通ること
- 手動確認(375px): ページスクロール1本(document.scrollingElement.scrollHeight が一覧全長を含む・内部スクローラー不在)、DOM 行数が画面分+overscan のみ、検索バー固定、タブ切替→復帰でクラッシュしない。768px 以上: テーブルの内部スクロールは従来通り

### ステップ3: `feat: モバイルのフィルタをボトムシートへ移動しクイックフィルタチップを追加`

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/components/input/InputFilterSheet.tsx` | 新規 | `open` / `onOpenChange` / `children`。Sheet `side="bottom"` + `max-h-[85dvh]` + 内部スクロール |
| `src/components/InputTab.tsx` | 変更 | `activeDetailFilterCount` 追加(`hasActiveDetailFilter` を置換)。sticky バーにチップ2個+「フィルタ」ボタン(件数 Badge)。シート children に既存フィルタ UI を配線。モバイルで section① を非レンダリング化 |

- テスト: モバイル幅で「フィルタ」ボタン→シート表示、チップタップで表示件数変化、バッジ件数、シート内リセットで件数クリア。**デスクトップの既存テスト(詳細設定パネル系)が無修正で通ること(不変の証明)**
- 手動確認(375px): チップ⇔シート内 Select の同期、シート内 MultiSelectFilter(Popover)の表示、リセット/表示に適用、リロード後のフィルタ維持(uiState 永続化)

### 共通の検証
各ステップで `npm test` / `npm run typecheck`、最終で `npm run build`。PR に 375px スクリーンショット(ファーストビュー・メニューシート・フィルタシート)+768px 無変化確認を添付。関数コメントは日本語。

## リスク

1. **Sheet 上に SyncHeader の AlertDialog が重なるネスト**: Radix のポータルスタックで動く想定(編集シート内 Select で実績あり)だが focus trap・オーバーレイの重なりを手動確認。問題があれば「メニューを閉じてからダイアログを開く」方式(open を App 側へ引き上げ)に切替
2. **forceMount 中(display:none)の useWindowVirtualizer**: 非表示中は offsetTop が 0 になるが、scrollMargin は state 管理+ResizeObserver 再計測(設計判断4)で復帰時に追従する設計。タブ往復での描画崩れがないか手動確認は必須
3. **タブ切替時の window スクロール位置クランプ**(一覧の深い位置→短いタブ→復帰で先頭に戻る): フェーズ1では許容し PR に明記。必要ならフェーズ2で sessionStorage 退避
4. **シート表示中の body スクロールロック**: Radix Dialog の仕様通りだが、iOS での背景スクロール貫通を手動確認
5. **InputTab の JSX 分岐による検索ブロックの重複**: state・ハンドラは単一なので許容。乖離が気になる場合のみ検索ブロックを小さなローカルコンポーネントに括る(過剰抽象化はしない)

## レビュー(2026-07-08 実装完了)

### 実施結果

- [x] ステップ1: `cc3e800` スマホ向けコンパクトヘッダーとメニューシート(MobileHeader 新設、SyncHeader をシート内埋め込み、FileImportButton に className prop 追加)
- [x] ステップ2: `311e947` モバイル一覧のページスクロール化+sticky 検索バー(useWindowVirtualizer、scrollMargin は state + ResizeObserver 管理)
- [x] ステップ3: `809d61a` フィルタのボトムシート化+チップ(InputFilterSheet 新設、activeDetailFilterCount、チップ2個+件数バッジ)

### 検証結果(375×812 実測)

- `npm test` 250 テスト全通過(新規9件追加)、`npm run typecheck` / `npm run build` 通過。デスクトップの既存テストは無修正で全通過
- 最初のキャラ行: フェーズ1前 y=585 → **y=246**。ファーストビューの表示行数 約3行 → **9行**
- ページスクロール1本(22,268px、内部スクローラー0件)。深部 scrollY=12,000 で行ギャップ 0px、詳細設定展開による一覧位置移動(約1,200px)でも行ズレなし(scrollMargin 追従を確認)
- 検索バーは深スクロール中も上部固定。チップ⇔シート内 Select の双方向同期、バッジ件数、シート内 10 セレクトの表示を確認
- ⋯メニュー(ログイン/エクスポート/インポート/初期化/最終更新)動作、Sheet 上の AlertDialog ネスト正常
- デスクトップ(961px): フルヘッダー・詳細設定パネル・テーブル内部スクロールすべて従来通り、モバイル要素の混入なし

### 計画からの逸脱(いずれも軽微・報告済み)

- FileImportButton に optional className prop を追加(メニュー項目スタイル埋め込みの最小手段、未指定時は従来と同一出力)
- updatedAt はフォーマット済み文字列で MobileHeader に渡す(formatUpdatedAt が App プライベートのため)
- SyncHeader のログイン系タップ時はメニューシートを閉じない(閉じるとアンマウントでダイアログが消えるため)
- モバイル一覧の外側は overflow-x-hidden も撤去し描画クリップのみの overflow-hidden に(overflow-x だけ残すと overflow-y が auto に計算され内部スクローラーが復活するため)

### 既知の制約(PR に明記)

- タブ切替で window スクロール位置がクランプされ、育成入力へ戻ると先頭付近に戻ることがある(フェーズ2以降で必要なら sessionStorage 退避)

### 残課題(今後のフェーズ)

- フェーズ2: 入力の高速化(☆/RANK のステッパー化、数値 +/-、シート項目順の入れ替え、保存インジケータ)
- フェーズ3: 磨き込み(チェックボックス拡大、行レイアウト、下部固定ナビ)
- 別途: PWA 化、他タブのモバイル調整、hover 依存改善

---

## 参考: 前フェーズ(完了済み)の記録

- 育成入力タブのモバイル一覧+編集シート: コミット 8861240 / c25e9f9 / f8a5552 / cc6b2fa / b817e9f。241 テスト通過、375px 実機確認済み
- 残課題(本フェーズ以降): フェーズ2=入力の高速化(ステッパー化・シート項目順・保存インジケータ)、フェーズ3=磨き込み(チェックボックス拡大・行2行化・下部固定ナビ)、別途 PWA 化・他タブ調整・hover 依存改善
