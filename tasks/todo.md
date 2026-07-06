# 育成入力タブのスマホ対応(〜375px)実装計画

## 背景・ゴール

- 現状、育成入力タブのテーブルは実幅約 2,205px(`table-fixed` + colgroup。`ui/table.tsx` の `min-w-[1280px]` は下限に過ぎない)で、スマホ(375px)では約6画面分の横スクロールが必要で実用不可。
- ゴール: **768px 未満の画面幅で横スクロールゼロの育成入力 UI** を提供する。デスクトップの既存テーブルは現状維持(リグレッションゼロ)。
- スコープ外: PWA 化、他タブ(ダッシュボード/クラバト/ショップ/計算)のモバイル調整、hover 依存 UI の全面改修。これらは本対応後に別途実施。

## 現状分析(要点)

- テーブルは `src/components/input/InputProgressTable.tsx`。全15列(所持/キャラ/限界突破/☆/RANK/専用1/専用2/アドベンチャー/所持メモピ/所持ピュアピ/入手日/ガチャ回数/必要メモピ合計/必要ピュアピ合計/メモピ入手)。
- `@tanstack/react-virtual` による `<tr>` 仮想化(estimateSize 72、overscan 8)、sticky 2列(left-0 / left-20)+スクロール影の実測描画(ResizeObserver、約50行)。横スクロールを無くせば影機構ごと不要。
- 派生値計算(必要メモピ/ピュアピ内訳、maxed 判定等)と編集ハンドラは `TableRow`(memo 化)内に直書き → モバイル UI で再利用するには抽出が必要(InputProgressTable.tsx:87-115 付近)。
- 状態更新は `onUpdateProgress(name, patch)` / `onUpdatePurePiece(name, value)` → `App.tsx handleUpdateProgress`(App.tsx:229)→ `setState` + `sync.notifyLocalChange()`。モバイル UI も同じ props を呼べば localStorage 保存・D1 同期は不変。
- 表示行の合成(フィルタ・ソート)は `useVisibleRows` → `InputTab` の `visibleRowsWithCurrentProgress`。レイアウト非依存で再利用可。
- `ui/table.tsx` の使用箇所は `InputProgressTable.tsx` と `ConnectRankCalcTab.tsx` の2箇所のみ。後者は `className="min-w-[900px]"` を渡しており tailwind-merge で既に 1280px を上書き済み。
- `useMediaQuery` 系フックは存在しない。viewport meta は設定済み。

## 方式の決定

3案(A: カード縦展開 / B: 列選択コンパクトテーブル / C: マスター/ディテール)を比較し、**C案: マスター/ディテール(一覧+ボトムシート編集)** を採用。

理由:
1. 375px で横スクロールゼロを実現できる唯一の案(B は Select trigger 最小幅の制約で物理的に2〜3列しか収まらない)。
2. 固定高の一覧行は仮想スクロールと最も相性が良く、sticky 列・影計算というモバイルで壊れやすい機構を丸ごと回避。
3. 編集はシート内で既存 `onUpdateProgress` を即時呼ぶだけで、state 更新・D1 同期経路に一切手を入れない。
4. デスクトップのテーブルは無傷でリグレッションリスク最小。
5. タッチで機能しない Tooltip(必要メモピ内訳)を、シート内インライン内訳表示で同時に解決。

### 決定事項(旧・未決事項)

1. ブレークポイントは **768px(Tailwind `md` 未満)でモバイルレイアウト**。shadcn の `useIsMobile` 慣例に合わせる。タブレット縦(768px〜)は既存テーブル+sticky 列で許容。
2. 一覧行のサマリーは **所持チェック・キャラ名/タグ・☆・RANK・必要メモピ合計**。行高は **64px に物理固定**(`h-16 overflow-hidden`)し、収まらないテキストは truncate する。可変高+`measureElement` 方式は複雑化するため不採用。
3. シートは1キャラ完結。前後キャラへの送りナビ(< >)は初期スコープ外。
4. シート内は折りたたみなしで全項目を縦に配置(見出しでグルーピングのみ)。

### 切替方式

CSS のみの切替(両レイアウト同時マウント+`hidden`)は不可:
- 非表示側の `useVirtualizer` が高さ0の scrollElement を計測して全行 or 0行レンダリングになる
- フォーム要素の aria-label が二重化する

→ **matchMedia フック(`useIsMobile`)+条件レンダリング**で片方のみマウントする。

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/hooks/useIsMobile.ts` | 新規 | `window.matchMedia("(max-width: 767px)")` を `useSyncExternalStore` で購読するフック(SPA のため SSR 考慮不要) |
| `src/components/input/rowDerived.ts` | 新規 | `TableRow` 内の派生値計算を純関数 `computeRowDerived(character, progress, ownedPurePiece, ownedPurePieceByBase, opts)` に抽出。単体テスト追加 |
| `src/components/input/progressFields.tsx` | 新規 | フィールド単位の共通コンポーネント(StarSelect / ConnectRankSelect / Ue1Select / Ue2Select / ObtainedDatePicker / クランプ付き数値入力)。テーブル行とシートの両方から使用 |
| `src/components/ui/sheet.tsx` | 新規 | `npx shadcn@latest add sheet` で雛形取得(Radix Dialog ベース)。`side="bottom"` のボトムシート。色は `styles.css` の CSS 変数準拠にカスタマイズ |
| `src/components/input/InputProgressList.tsx` | 新規 | モバイル一覧。props は `InputProgressTable` と同一。div ベース `useVirtualizer`(estimateSize 64)。**行は `h-16 overflow-hidden` で物理的に固定高とし、キャラ名・タグ・サマリーは `min-w-0` + `truncate` で1行に切り詰めて 64px 内に収める**(`estimateSize` は高さを保証しないため、折り返しによる実 DOM 高とのズレ=行の重なり・スクロール破綻を構造的に防ぐ)。行タップで編集シートを開く |
| `src/components/input/InputCharacterEditSheet.tsx` | 新規 | 編集シート。progressFields を縦配置、必要メモピ/ピュアピの内訳をインライン表示。編集は即時 `onUpdateProgress`(下書きバッファなし) |
| `src/components/input/InputProgressTable.tsx` | 変更 | 派生値計算・フィールド UI を rowDerived / progressFields 利用に置換(挙動不変)。`Table` に `className="min-w-[1280px] table-fixed"` を明示 |
| `src/components/ui/table.tsx` | 変更 | `min-w-[1280px]` を共有コンポーネントから削除(呼び出し側指定に統一)。ConnectRankCalcTab は実挙動変化ゼロ |
| `src/components/InputTab.tsx` | 変更 | `useIsMobile()` で `InputProgressTable` / `InputProgressList` を条件レンダリング(渡す props は同一) |

### 実装上の要点

- **シートの選択キャラは name(string)で保持**し、レンダリング毎に `visibleRows` から最新 row を引く(progress オブジェクトは編集の度に再生成されるため、参照保持だと古い値を表示してしまう)。
- シート表示中に対象キャラがフィルタで消えた場合は「row が見つからなければシートを閉じる」。
- モバイルの仮想スクロールコンテナは `h-[70vh]` でなく `h-[70dvh]`(モバイルブラウザの動的ツールバー対策)を採用。
- 仮想化の計測未確定時フォールバック(先頭行表示)は既存テーブルの防御コード(InputProgressTable.tsx:507-527)と同じ戦略を一覧にも移植(jsdom テストもこの経路で通す)。

## 段階分割(コミット単位)

`feature/*` ブランチで作業(AGENTS.md 準拠)。

### ステップ1: `refactor: 共有テーブルの最小幅指定を呼び出し側へ移動`
- `ui/table.tsx` から `min-w-[1280px]` を削除、`InputProgressTable` 側に付与
- 検証: `npm test` / `npm run typecheck`。デスクトップで育成入力・コネクトランク計算タブの見た目確認

### ステップ2: `refactor: 育成入力行の派生値計算とフィールドUIを共通化`
- `rowDerived.ts` + `progressFields.tsx` を抽出し、`InputProgressTable` を置換(挙動不変)
- 検証: 既存 `InputProgressTable.test.tsx` が**無修正で通ること**(挙動不変の証明)。`rowDerived` の単体テスト追加

### ステップ3: `feat: モバイル判定フック useIsMobile を追加`
- フック+テスト(`src/test/setup.ts` に matchMedia モックが無ければ追加)

### ステップ4: `feat: 育成入力タブにモバイル向け一覧と編集シートを追加`
- `sheet.tsx`(shadcn add)、`InputProgressList`、`InputCharacterEditSheet`、`InputTab` の切替
- テスト: 一覧レンダリング(行タップ→シート表示)、シート内編集で `onUpdateProgress` が正しい patch で呼ばれること、フィルタ0件時の空表示。既存テストのヘルパー(`buildCharacter` / `buildProgress` / `selectOptionFromCombobox`)を流用
- 手動確認(`npm run dev` + DevTools 375px):
  - 横スクロールが発生しないこと
  - 仮想化が効いていること(DOM 行数が画面分+overscan のみ)
  - シート編集が一覧・ダッシュボードに即反映されること
  - ログイン状態で D1 同期が走ること(SyncHeader の同期表示)
  - 768px 前後のリサイズでレイアウトが切り替わること
  - PR にスクリーンショット添付(規約)

### ステップ5(必要に応じて): `fix: モバイル表示の微調整`
- シートの safe-area(iOS ホームバー)、日付ピッカーのタッチ操作、フォントサイズ等

## リスク

- テーブル行とシートで UI ロジックが二重化し将来乖離する → ステップ2の共通化が計画の要。progressFields を唯一の実装にする
- `useVirtualizer` + jsdom はテストで計測不能 → 既存テーブルと同じフォールバック行戦略で検証
- Radix Dialog(Sheet)内の Select / Popover(入手日 Calendar)のネスト → Radix はポータルのネストに対応しているが、focus trap との干渉を手動確認
- 767↔768px リサイズで仮想スクロール位置がリセットされる → 実害は小さいが既知の挙動として PR に明記

## レビュー

(実装完了後に記入)
