# スマホ UI フェーズ4: 他タブのモバイル調整 実装計画

フェーズ0〜3(育成入力のスマホ対応、PR #4/#5)は develop にマージ済み。作業ブランチ: `feature/mobile-other-tabs`。

## 背景・ゴール

残る4タブ(集計/クラバト編成/ショップ/ランク計算)の 375px での問題を解消する。方針: 「375px で壊れない・主要操作ができる」を優先し、過剰な再設計はしない。デスクトップ(768px 以上)は一切不変。

## 問題一覧(コード裏取り+375px 実測の両方で確認済み)

| タブ | 問題 | 場所 | 深刻度 |
|---|---|---|---|
| 集計 | ガチャ回数チャートが `min-w-[720px]` + `<BarChart width={720}>` の**固定 px**(CSS だけでは直らない)。縦スクロール箱(`max-h-[520px] overflow-y-auto`)の中に約2.4画面分の横スクロールが入れ子。実測: 720px/コンテナ301px | gacha-pull-chart.tsx:57-60 | 高 |
| 集計 | YAxis のキャラ名幅 96px が 375px では 1/4 超を占有 | 同 :74-82 | 中(同時解決) |
| クラバト | **メンバー並び替えが HTML5 `draggable` のみ → iOS Safari / Android Chrome では drag イベントが発火せずタッチで並び替え不能**(確定)。案内文「ドラッグで並び替えできます」も不正確に | ClanBattleTab.tsx:526-529, 535, 476 | 高 |
| クラバト | メンバーカードが lg 未満で1列スタック、1人約400px×5人で縦に冗長 | 同 :530-663 | 中 |
| クラバト | ゴミ箱系ボタンが ghost/sm(実効約28px)でタップターゲット不足 | 同 :391-399, 654-662 | 中 |
| ショップ | キャラグリッドが全幅 `grid-cols-4`。375px では1セル約75px=全角3文字/行で長名が4段折返し | CoinShopTab.tsx:31 | 高(修正は1行) |
| ランク計算 | 11列テーブルが `min-w-[900px]`。主目的の素材列・集計行がスクロールしないと見えない。実測: 900px/コンテナ333px | ConnectRankCalcTab.tsx:154-201 | 高 |
| ランク計算 | 行の上下移動・削除ボタンが約28px | 同 :442-465 | 中(カード化で同時解決) |

問題なしを確認: StatCard グリッド・分布チャート(ResponsiveContainer)・年 Select、クラバトのサイドバー/TimelineModal/TL textarea、ショップのコインタブ(横スクロールで操作成立)、ランク計算のコンボボックス(320px は 375px に収まる)。**Radix Tooltip はこの4タブでは未使用**(hover 依存調査はクローズ。チャートの recharts ツールチップはタップで出る想定、要実機確認)。

## 設計判断(確定)

1. **ガチャチャート: gacha-pull-chart.tsx 内で `useIsMobile` 分岐**。モバイルは `ResponsiveContainer width="100%"` + min-w なし + `YAxis width={72}`・軸名省略6文字・margin 縮小。**デスクトップ分岐(width=720 固定)は文字通り無改変**。distribution-chart.tsx:81 に ResponsiveContainer の実績パターンあり。**注意: GachaPullChart は `items.length === 0` の早期 return を持つため、`useIsMobile()` は必ずコンポーネント冒頭(早期 return より前)で呼ぶ**(Rules of Hooks 違反防止)
2. **ランク計算: `isMobile ? カードリスト : 既存テーブル(無改変)` 分岐**(InputTab で確立したパターンの踏襲)。行数はユーザー追加式で少数のため仮想化不要。カード構成: 1段目=キャラ名+警告+削除(44px)、2段目=「現在 n → 目標 [Select]」、3段目=素材6種の3列チップ、▲▼移動(44px)。**合計素材カードを先頭に常時表示**。既存の handleMove / rowCosts / totalCost / 永続化をそのまま使う(ロジック追加ゼロ)
3. **クラバト並び替え: モバイルは ▲▼ボタン**(md:hidden で表示)。方向指定の純関数を追加し、既存 `reorderMembers` と同型で実装。「タップ選択→タップ配置」方式は選択状態管理が増える割に編成は最大5人で ▲▼ の連打コストが低いため不採用。`draggable` はデスクトップ用に残し、`GripVertical` は `max-md:hidden`、案内文はブレークポイントで出し分け
4. **クラバトのカード: `max-md:grid-cols-2`** で Select 5個を2列配置(約400px→約250px/人)。シート再設計は過剰につき不採用
5. **ショップ: `grid-cols-2 md:grid-cols-4`** の1行修正
6. **タップターゲット: ゴミ箱系に `max-md:min-h-11 max-md:min-w-11`**
7. **規約: スタイルのみの差は `max-md:` バリアント、構造分岐は `useIsMobile`**。`max-md:` はコードベース初出のため使用箇所にコメントを付ける
8. スコープ外: コインタブ TabsList の横スクロール改善、`window.confirm` のダイアログ化、タブ切替時スクロール位置復元、recharts ツールチップがタップで出ない場合の対応(その場合は降格して据え置き)

## 実装ステップ(コミット単位、工数対効果順)

### ステップ1: `feat: ショップのキャラ一覧をモバイル2列グリッドに変更`(極小)
- CoinShopTab.tsx:31 を `grid-cols-2 md:grid-cols-4` へ
- テスト: CoinShopTab.test.tsx の grid-cols-4 アサートを「`grid-cols-2` と `md:grid-cols-4` の両方を含む」に更新(意図の明確化。**デスクトップ不変証明の意図的例外として PR に明記**)
- 検証: `npm test` / `npm run typecheck`

### ステップ2: `feat: ガチャ回数チャートをモバイルで画面幅に収める`(小〜中)
- gacha-pull-chart.tsx に useIsMobile 分岐(設計判断1)
- テスト: DashboardTab.test.tsx 無修正通過。追加はモバイル時に `min-w-[720px]` クラスが付かないスモーク程度(recharts は jsdom で実描画されないため)
- 検証: `npm test` / `npm run typecheck` + 375px で横スクロール消滅、ツールチップのタップ表示、ResponsiveContainer と縦スクロール箱の相性(ちらつき)確認

### ステップ3: `feat: ランク計算をモバイルでカードリスト表示に変更`(中)
- ConnectRankCalcTab.tsx に useIsMobile 分岐(設計判断2)
- テスト(新規): モバイルスタブで「キャラ追加→カードに現在/目標/素材合計が表示」「▲▼で並び順入替」「削除」。デスクトップ側は `min-w-[900px]` テーブル描画のスモーク1件追加
- 検証: `npm test` / `npm run typecheck`

### ステップ4: `feat: クラバト編成カードをモバイル2列レイアウトに調整`(小〜中)
- ClanBattleTab.tsx: article へ `max-md:grid-cols-2` +名前/削除の col-span 調整、ゴミ箱系へ 44px 確保、GripVertical を `max-md:hidden`
- スタイルのみ(DOM 構造・ハンドラ不変)
- 検証: `npm test` / `npm run typecheck` + 375px 目視

### ステップ5: `feat: クラバト編成のメンバー並び替えにモバイル用の上下ボタンを追加`(中)
- 方向指定の並び替え純関数 `moveMemberByDirection` +各カードに `md:hidden` の ▲▼(aria-label 付き、44px)。案内文を出し分け
- テスト(新規): 純関数のユニットテスト+モバイルレンダリングで ▲▼ により並び替え済み members が onChange に渡ること
- 検証: `npm test` / `npm run typecheck` / `npm run build`(最終)

### 共通の検証
- デスクトップ系テスト(InputProgressTable / InputTab / DashboardTab / App / CoinShopTab※ステップ1で意図的更新)通過=768px 以上不変の証明。デスクトップ分岐コードは diff 上も無改変を保つ
- 関数コメントは日本語

### 手動確認(375×812)
1. 集計: 横スクロールなしで全カード・4分布・ガチャチャート表示、棒タップでツールチップ、年 Select 操作
2. ショップ: 2列グリッドで長名2行以内、5コインタブ切替
3. ランク計算: キャラ追加→カード表示、目標 Select・▲▼・削除タップ操作、合計常時表示
4. クラバト: 年月追加・編成追加・キャラ検索・Select 変更・▲▼並び替え・削除・TL 編集が全てタップで完結
5. デスクトップ(1280px): 4タブ従来と同一(ガチャチャート720px、ランク計算テーブル、D&D、ショップ4列)
6. 下部ナビ(z-40)と各タブ内ポップオーバー/モーダルの重なり正常

## リスク

1. recharts v3 のタッチツールチップ挙動が未検証 → タップで出なければ「棒の長さ+軸で読める」ためスコープ外へ降格可
2. ResponsiveContainer と縦スクロール箱(max-h-[520px])の相性 → モバイル分岐では明示 height(items.length ベース)を渡して回避見込み。実装時にちらつき確認
3. ClanBattleTab はテスト不在 → ステップ5の並び替えテストで最低限の網を張る(統合的にするか純関数に留めるかは工数次第で実装時判断)
4. `max-md:` 初導入による記法混在 → 使用箇所にコメント、設計判断7の規約に従う
5. ランク計算カードの情報密度(素材6種を335pxに収める) → 実装時に微調整。表示値は現テーブルと同一値を出す

## レビュー

### ステップ1〜2(実装済み)

- ステップ1: `5061623` feat: ショップのキャラ一覧をモバイル2列グリッドに変更
- ステップ2: `1a54b8a` feat: ガチャ回数チャートをモバイルで画面幅に収める

### ステップ3〜5(実装済み)

- ステップ3: `02dbae7` feat: ランク計算をモバイルでカードリスト表示に変更
  - ConnectRankCalcTab に useIsMobile 分岐。モバイルはカードリスト(合計カード先頭常時表示+キャラカード)、デスクトップは既存テーブル無改変
  - 新規テスト4件(モバイル: 追加/合計・▲▼・削除、デスクトップ: min-w-[900px] スモーク)
- ステップ4: `930a68e` feat: クラバト編成カードをモバイル2列レイアウトに調整
  - スタイルのみ: article へ max-md:grid-cols-2、名前ブロック/削除ボタンへ max-md:col-span-2、ゴミ箱系へ max-md:min-h-11/min-w-11、GripVertical を max-md:hidden。max-md: 初出箇所に規約コメント付与
- ステップ5: `01fe40b` feat: クラバト編成のメンバー並び替えにモバイル用の上下ボタンを追加
  - 純関数 moveMemberByDirection(端は no-op)+ md:hidden の▲▼(44px、端 disabled)+案内文出し分け。draggable は無改変で温存
  - 新規テスト7件(純関数4+モバイルレンダリング3)

### 検証結果

- `npm test`: 36 files / 287 tests 全通過(デスクトップ系テスト無修正通過)
- `npm run typecheck` / `npm run build`: 通過
- 375px 実測: ランク計算=追加→カード表示(合計と行の素材値が Select 変更へ即時追従)・▲▼・削除・横スクロールなし・タップターゲット44px実測。クラバト=年月追加→編成追加→キャラ追加→☆Select 変更・▲▼並び替え(localStorage 反映確認)・削除・TL 編集が全てタップで完結。0個素材チップは opacity 0.5 で減光
- 1280px 実測: ランク計算=900px テーブル+集計行(モバイルと同一値)、カードなし。クラバト=7カラムグリッド・draggable/Grip 温存・▲▼非表示・従来案内文表示
- 検証データはすべて削除済み(clanBattle.groups=0 / calcEntries=0 / progress 無変更)

### 備考(実装時判断)

- moveMemberByDirection はテストから参照するため export(reorderMembers は非公開のまま無改変)
- 375px のキャラカードでは▲▼列の分だけ素材チップが狭まり「ブロンズ/シルバー/ゴールド」ラベルが truncate される(値は常時全表示、合計カードは全文表示)。リスク5の範囲内として許容

---

## 参考: 完了済みフェーズの記録

- フェーズ0〜2: PR #4 / フェーズ3+サマリー刷新: PR #5(いずれも develop へマージ済み)
- 既知の制約: タブ切替で window スクロール位置がクランプされ一覧先頭に戻ることがある
- 残(フェーズ4後): PWA 化、hover 依存改善(Radix Tooltip はデスクトップテーブルのみと判明)、iOS 実機での safe-area 確認
