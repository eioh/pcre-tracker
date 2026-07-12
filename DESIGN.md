# DESIGN.md — スレートナイト デザインシステム

プリコネ育成トラッカー（pkne.app）の UI デザインシステム正式仕様。
本ドキュメントは **色・形・タイポグラフィ・コンポーネント規約の唯一の拠り所** であり、
人間・AI を問わず今後の UI 実装はこれに従う。実装対象は `src/styles.css`（`@theme` の
デザイントークンと `:root` の shadcn 系 HSL 変数）および各コンポーネントの Tailwind クラスである。

> このドキュメントを起点に `src/styles.css` のトークンを差し替える。
> 「[トークンマッピング表](#4-トークンマッピング表)」がそのまま機械的な書き換え指示になる。

---

## 1. 背景と狙い

現行 UI は背景 `#010101` / カード `#090a0b` とほぼ純黒で、面ごとの明度差がなく
「真っ黒でのっぺり」した印象になっている。段差（エレベーション）が知覚できないため、
カードもテーブルも背景に溶けて情報の階層が読み取れない。

刷新案 **「スレートナイト」**（GitHub / VS Code 系の青みグレー）を採用し、
**「背景 → カード → 浮き面」の3段階の面** を明度差で作って奥行きを与える。
純黒 `#000` は使わない。

属性色・ロール色・メモピ入手チップ・恒常/限定バッジの淡色パステル群は
**完成度が高い資産のため現行値を維持** する。刷新はあくまで「面（サーフェス）と地の色」に限定する。

---

## 2. デザイン原則

1. **3段階エレベーション** — すべての面は「背景（最下層 `#0d1117`）→ カード/パネル（surface `#161c24`）
   → 浮き面（surface2 `#1c232d`：テーブルヘッダ・ホバー・ポップオーバー）」のいずれかに属する。
   面を重ねるほど明るくして段差を作る。逆順（上に載る面が暗い）は禁止。
2. **純黒禁止** — `#000` および `#010101`〜`#0a0a0a` 帯のほぼ純黒は使わない。最も暗い色は背景 `#0d1117`。
3. **色はトークン経由のみ** — コンポーネント内でハードコードの hex を書かない。必ず `@theme` の
   CSS 変数（`bg-panel-from`, `text-sub`, `border-panel-border` 等）を参照する（AGENTS.md「カラーは CSS 変数」準拠）。
4. **コンテンツ色（淡色パステル）は意味を持つ予約色** — 属性・ロール・入手チップ・バッジの淡色は
   データの意味を表す。装飾目的でこれらの色相を流用しない。地の UI（面・境界・テキスト）は
   スレートの無彩〜青みグレーに限定し、パステルと衝突させない。
5. **段差は色で作る／影は補助** — エレベーションは第一に面の明度差で表現する。影（`shadow-panel`）は
   浮遊パネルの補強にとどめ、影で階層を代替しない。面のグラデーションでの擬似段差は使わない（フラット面に統一）。

---

## 3. カラーシステム

### 3.1 コアパレット（スレートナイト・コア）

| 役割名 | 値 | 用途 | 使いどころ |
| --- | --- | --- | --- |
| 背景 / base | `#0d1117` | 最下層のページ地色 | `body` 背景、最下層に接する余白、スクロールバー溝 |
| カード / surface | `#161c24` | 第2層。パネル・カードの面 | StatCard、DashboardTab セクション、InputTab パネル、テーブル本体の地 |
| 浮き面 / surface2 | `#1c232d` | 第3層。base/surface の上に浮く面 | テーブルヘッダ（sticky）、ポップオーバー、Select コンテンツ、行ホバーの基準 |
| ボーダー | `rgba(180, 200, 225, 0.16)` | 面の輪郭線（標準） | カード枠、パネル枠、テーブル外枠 |
| 本文テキスト / main | `#e6edf3` | 既定の前景色 | 見出し・本文・数値 |
| 補助テキスト / sub | `#b9c4d0` | やや弱いテキスト | セクション見出し、補足ラベル |
| ミュートテキスト / muted | `#8d99a8` | 最も弱いテキスト | キャプション、非アクティブタブ、プレースホルダ |
| アクセント | `#5c95ff` | 主要な操作・強調・選択 | primary ボタン、アクティブタブ下線、リンク、フォーカスリング |
| アクセント上テキスト | `#06101f` | アクセント面に載る文字 | primary ボタンのラベル |
| チャート バー | `#4f8dff` | グラフの主バー | Recharts バー |
| チャート ハイライト | `#45e6ff` | グラフの強調・シアン系 | 平均線・強調系列・primary ボタングラデ終端 |
| 縞テーブル偶数行 | `rgba(255, 255, 255, 0.025)` | ゼブラの淡い持ち上げ | 偶数行（surface に約2.5%白を重ねた明度） |
| ☆（スター） | `#e8c56a` | ☆ランクの金色 | ☆表示（新規トークン。適用は後続対応） |

> **背景 → カード → 浮き面の明度差**（`#0d1117` → `#161c24` → `#1c232d`）が本テーマの心臓部。
> 迷ったらこの3値のどれかに寄せる。

### 3.2 セマンティック / コンテンツ色（現行値を維持する資産）

以下は **変更しない**。データの意味を担う淡色パステルで、既に調整済みの完成資産である。

- **属性色**: 火 `#e39b89` / 水 `#86b8df` / 風 `#8bc8ab` / 光 `#d9ca8a` / 闇 `#aa9ad8`
- **ロール色**: アタッカー `#e19595` / ブレイカー `#d9cc92` / バッファー `#ddb08a` / デバッファー `#8eb8df` /
  ブースター `#95d7df` / ヒーラー `#9ecd9a` / タンク `#b39ad4` / ジャマー `#dda1c8`
- **メモピ入手チップ**: ダンジョン / アリーナ / プリンセスアリーナ / クラン / マスター / ハード / サイド（各 border/bg/text）
- **バッジ**: 恒常（normal）/ 限定（limited）の border/bg/text
- **入力テーブルのキャラタグ**: 限定 `#d8aeb3` / 恒常 `#9ec8df` / 区切り `#7f8ba5`
- **danger（危険操作）**: `#ff6b6b` / `#ff8a8a` / bg `#3a0d0dcc` — 赤はセマンティックカラーとして現状維持

---

## 4. トークンマッピング表

`src/styles.css` の `@theme` に定義された全トークンについて「現行値 → 新値（または維持）」を示す。
**維持** は値を変更しない。新値は具体的な hex / rgba で確定済み。この表のとおりに機械的に置換する。

### 4.1 フォント（`@theme`）

| トークン | 現行値 | 新値 |
| --- | --- | --- |
| `--font-sans` | `"Noto Sans JP", sans-serif` | 維持 |
| `--font-inter` | `"Inter", sans-serif` | 維持 |
| `--font-orbitron` | `"Orbitron", sans-serif` | 維持 |

### 4.2 コア色 / 地・テキスト・アクセント（`@theme`）

| トークン | 現行値 | 新値 | 対応するコア役割 |
| --- | --- | --- | --- |
| `--color-bg-start` | `#010101` | `#0d1117` | base |
| `--color-bg-end` | `#050505` | `#0d1117` | base（body をフラット化、下記 4.7 参照） |
| `--color-main` | `#f1f5f9` | `#e6edf3` | main |
| `--color-sub` | `#cbd5e1` | `#b9c4d0` | sub |
| `--color-muted` | `#a8b0ba` | `#8d99a8` | muted |
| `--color-accent` | `#4f8dff` | `#5c95ff` | アクセント |
| `--color-accent-strong` | `#45e6ff` | 維持 | チャートハイライト / ボタングラデ終端 |
| `--color-accent-text` | `#04111f` | `#06101f` | アクセント上テキスト |
| `--color-danger` | `#ff6b6b` | 維持 | セマンティック赤 |
| `--color-danger-strong` | `#ff8a8a` | 維持 | セマンティック赤（強） |
| `--color-danger-bg` | `#3a0d0dcc` | 維持 | 危険操作の面 |

### 4.3 面・パネル・影（`@theme`）— グラデ廃止・フラット化

| トークン | 現行値 | 新値 | 設計意図 |
| --- | --- | --- | --- |
| `--color-panel-border` | `#aeb7c62e` | `rgba(180, 200, 225, 0.16)` | 標準ボーダー |
| `--color-panel-from` | `#090a0bef` | `#161c24` | surface（グラデ廃止・フラット） |
| `--color-panel-to` | `#040405e8` | `#161c24` | surface（from と同値でフラット化） |
| `--color-section-from` | `#070708e8` | `#161c24` | surface（panel と統一） |
| `--color-section-to` | `#030303f5` | `#161c24` | surface（from と同値でフラット化） |
| `--shadow-panel` | `0 20px 48px rgba(0, 0, 0, 0.45)` | `0 16px 40px rgba(0, 0, 0, 0.38)` | 段差は色で作るため影は控えめに |

> **グラデーション廃止の判断（採用: フラット化）**
> 現行の `panel-from/to`・`section-from/to` は上下でわずかに明度が変わる擬似段差だが、
> 純黒帯の中では段差として機能せず「のっぺり」の一因になっていた。スレートナイトでは
> **面そのものの明度差（base/surface/surface2）で段差を作る** ため、面内グラデは不要かつ
> 原則3・原則5と矛盾する。よって `panel` と `section` を **同一の surface `#161c24` にフラット統一** する。
> 実装上は `bg-linear-to-br from-panel-from to-panel-to` は from=to になり事実上の単色になるが、
> クラス自体は既存コンポーネントに残してよい（表示は単色 surface になる）。
> 段差が必要な内側要素は surface2（`table-header-bg` / `popover-bg` / `row-hover`）へ寄せる。
> なお **primary ボタンの `from-accent to-accent-strong` グラデは「面のエレベーション」ではなく
> ブランドアクセントの意匠** なので廃止対象外（維持）。

### 4.4 派生トークン（入力・ポップオーバー・選択状態）（`@theme`）

| トークン | 現行値 | 新値 | 設計意図 |
| --- | --- | --- | --- |
| `--color-input-bg` | `#060607e8` | `#0f141b` | surface 上で軽く沈む入力面（base より僅かに明るく単独でも視認可） |
| `--color-popover-bg` | `#040405f7` | `#1c232d` | 浮き面 surface2（最前面に浮くため最も明るい面） |
| `--color-selected` | `#10243f` | `#16304e` | アクセント色みの選択面（青寄りの surface） |
| `--color-checked-bg` | `#0b335f` | `#123a63` | チェック済みの強い選択面（selected より濃い青） |

### 4.5 チャート配色（`@theme`）

| トークン | 現行値 | 新値 | 備考 |
| --- | --- | --- | --- |
| `--color-chart-bar` | `#4f8dff` | 維持 | バー（コア「チャート バー」と一致） |
| `--color-chart-ref` | `#9ac0ff` | 維持 | 参照線 |
| `--color-chart-accent` | `#45e6ff` | 維持 | ハイライト |
| `--color-chart-grid` | `rgba(203, 213, 225, 0.12)` | `rgba(180, 200, 225, 0.12)` | グリッド線をボーダー色相へ統一 |
| `--color-chart-cursor` | `rgba(69, 230, 255, 0.08)` | 維持 | ホバーカーソル（ハイライト薄） |

### 4.6 テーブル・行・状態（`@theme`）

| トークン | 現行値 | 新値 | 設計意図 |
| --- | --- | --- | --- |
| `--color-table-border` | `#cbd5e124` | `rgba(180, 200, 225, 0.12)` | セル内側の細い罫線（標準ボーダーより淡く） |
| `--color-table-header-bg` | `#090a0bf5` | `#1c232d` | surface2（sticky ヘッダは浮き面） |
| `--color-table-wrap-border` | `#cbd5e124` | `rgba(180, 200, 225, 0.14)` | テーブル外枠 |
| `--color-table-wrap-bg` | `#030303e0` | `#161c24` | surface（テーブルコンテナの地） |
| `--color-row-odd` | `#050505` | `#161c24` | surface（基準行。wrap と同一で溶ける） |
| `--color-row-even` | `#0d0e0f` | `#1c222a` | surface に白 2.5% を重ねた縞（コア「縞偶数行」相当） |
| `--color-row-hover` | `#25282c` | `#222b37` | surface2 より明るいホバー面（段差が上がる） |
| `--color-row-hover-border` | `#cbd5e124` | `rgba(180, 200, 225, 0.12)` | ホバー行の境界 |
| `--color-sort-hover` | `#9ac0ff` | 維持 | ソート可能ヘッダのホバー文字（アクセント寄り） |
| `--color-filter-separator` | `#cbd5e124` | `rgba(180, 200, 225, 0.10)` | フィルタ区切り線（最も淡い） |

**maxed（最大強化済みセレクト）**

| トークン | 現行値 | 新値 | 設計意図 |
| --- | --- | --- | --- |
| `--color-maxed-border` | `#4b5563` | 維持 | スレートグレー枠 |
| `--color-maxed-bg` | `#060607e8` | `#0f141b` | input-bg と揃えた沈み面 |
| `--color-maxed-text` | `#f1f5f9` | `#e6edf3` | main へ統一 |
| `--color-maxed-dot` | `#67aaf2` | 維持 | アクセント寄りドット |
| `--color-maxed-green` | `#8bc8ab` | 維持 | 属性/ロールのソフトグリーンと同系（セマンティック） |

**disabled（無効セレクト）**

| トークン | 現行値 | 新値 | 設計意図 |
| --- | --- | --- | --- |
| `--color-disabled-border` | `#788aad38` | 維持 (`rgba(120, 138, 173, 0.22)`) | 淡いスレート枠 |
| `--color-disabled-bg` | `#070b12bf` | `#12171f` | base と surface の中間の沈んだ無効面 |
| `--color-disabled-text` | `#9fb0cf` | `#8d99a8` | muted へ統一（無効は最も弱く） |

### 4.7 スクロールバー / body 背景（`@layer base` のハードコード値）

`@theme` 外だがハードコードされているため、コアパレットへ合わせて置換する。

| 箇所 | 現行値 | 新値 |
| --- | --- | --- |
| `body` 背景 | `linear-gradient(155deg, var(--color-bg-start), var(--color-bg-end))` | 実質単色 `#0d1117`（bg-start=bg-end のためフラット。`background: var(--color-bg-start)` へ簡素化してもよい） |
| `scrollbar-color`（Firefox: thumb track） | `#68717c #050505` | `#3a434f #0d1117` |
| `::-webkit-scrollbar-track` background | `linear-gradient(180deg, #050505, #020202)` | `#0d1117`（フラット） |
| `::-webkit-scrollbar-track` border | `1px solid rgba(203, 213, 225, 0.18)` | `1px solid rgba(180, 200, 225, 0.16)` |
| `::-webkit-scrollbar-thumb` background | `linear-gradient(180deg, #4d5661, #343a42)` | `#2b333d`（フラット） |
| `::-webkit-scrollbar-thumb` border | `2px solid #050505` | `2px solid #0d1117` |
| `::-webkit-scrollbar-thumb:hover` background | `linear-gradient(180deg, #68717c, #454c55)` | `#3a434f`（フラット） |
| `::-webkit-scrollbar-corner` background | `#020202` | `#0d1117` |

### 4.8 セマンティック / コンテンツ色（`@theme`）— すべて維持

以下は 3.2 の資産。**全トークン現行値を維持**（変更なし）。

| グループ | トークン | 扱い |
| --- | --- | --- |
| バッジ normal | `--color-badge-normal-border` `#67b8ffa6` / `--color-badge-normal-bg` `#1c4e7a4f` / `--color-badge-normal-text` `#a9ddff` | 維持 |
| バッジ limited | `--color-badge-limited-border` `#ff7e63b3` / `--color-badge-limited-bg` `#7b2c2552` / `--color-badge-limited-text` `#ffb19f` | 維持 |
| 属性 | `--color-attr-fire` `#e39b89` / `--color-attr-water` `#86b8df` / `--color-attr-wind` `#8bc8ab` / `--color-attr-light` `#d9ca8a` / `--color-attr-dark` `#aa9ad8` | 維持 |
| ロール | `--color-role-attacker` `#e19595` / `--color-role-breaker` `#d9cc92` / `--color-role-buffer` `#ddb08a` / `--color-role-debuffer` `#8eb8df` / `--color-role-booster` `#95d7df` / `--color-role-healer` `#9ecd9a` / `--color-role-tank` `#b39ad4` / `--color-role-jammer` `#dda1c8` | 維持 |
| キャラタグ | `--color-limited-text` `#d8aeb3` / `--color-normal-text` `#9ec8df` / `--color-tag-separator` `#7f8ba5` | 維持 |
| チップ dungeon | `--color-chip-dungeon-border` `#56c6ff99` / `--color-chip-dungeon-bg` `#145c7e52` / `--color-chip-dungeon-text` `#8fe6ff` | 維持 |
| チップ arena | `--color-chip-arena-border` `#ff9966a6` / `--color-chip-arena-bg` `#823f2257` / `--color-chip-arena-text` `#ffc58c` | 維持 |
| チップ p-arena | `--color-chip-p-arena-border` `#ba79ffa6` / `--color-chip-p-arena-bg` `#522a7e5c` / `--color-chip-p-arena-text` `#d9b0ff` | 維持 |
| チップ clan | `--color-chip-clan-border` `#ff6b7aa6` / `--color-chip-clan-bg` `#7c223857` / `--color-chip-clan-text` `#ff9ea4` | 維持 |
| チップ master | `--color-chip-master-border` `#ffd455b3` / `--color-chip-master-bg` `#7e5a155c` / `--color-chip-master-text` `#ffe291` | 維持 |
| チップ hard | `--color-chip-hard-border` `#ff8150a6` / `--color-chip-hard-bg` `#82341c57` / `--color-chip-hard-text` `#ffad7c` | 維持 |
| チップ side | `--color-chip-side-border` `#5bdba4a6` / `--color-chip-side-bg` `#1c674957` / `--color-chip-side-text` `#9df0cb` | 維持 |

### 4.9 新規追加トークン（`@theme`）

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--color-star` | `#e8c56a` | ☆ランクの金色。**現状どこからも参照されていない新規トークン**。☆表示へ適用する際に `text-star` として使う（適用は後続のコンポーネント対応。トークンだけ先に定義しておく） |

### 4.10 `:root` shadcn 系 HSL 変数

shadcn/ui コンポーネント（Card 等）が参照する HSL 変数。コアパレットの新値を HSL へ変換して置換する。
値は `H S% L%`（`hsl()` ラッパーは利用側で付与）。
**注意: この表の置換だけでは Tailwind ユーティリティに反映されない。必ず 4.11 のブリッジとセットで実装すること。**

| 変数 | 現行値 | 新値 | 対応する色 |
| --- | --- | --- | --- |
| `--background` | `0 0% 1%` | `216 28% 7%` | base `#0d1117` |
| `--foreground` | `0 0% 96%` | `208 35% 93%` | main `#e6edf3` |
| `--card` | `0 0% 5%` | `214 24% 11%` | surface `#161c24` |
| `--card-foreground` | `0 0% 96%` | `208 35% 93%` | main `#e6edf3` |
| `--popover` | `0 0% 4%` | `215 23% 14%` | surface2 `#1c232d` |
| `--popover-foreground` | `0 0% 96%` | `208 35% 93%` | main `#e6edf3` |
| `--primary` | `218 100% 66%` | `219 100% 68%` | accent `#5c95ff` |
| `--primary-foreground` | `209 79% 7%` | `216 68% 7%` | accent-text `#06101f` |
| `--secondary` | `0 0% 11%` | `215 23% 14%` | surface2 `#1c232d` |
| `--secondary-foreground` | `0 0% 96%` | `208 35% 93%` | main `#e6edf3` |
| `--muted` | `0 0% 12%` | `215 23% 14%` | surface2 `#1c232d` |
| `--muted-foreground` | `0 0% 72%` | `213 13% 61%` | muted `#8d99a8` |
| `--accent` | `218 100% 66%` | `219 100% 68%` | accent `#5c95ff` |
| `--accent-foreground` | `209 79% 7%` | `216 68% 7%` | accent-text `#06101f` |
| `--border` | `0 0% 58%` | `212 17% 22%` | ボーダーの不透明近似（`rgba(180,200,225,0.16)` を surface に重ねた見え色 ≈ `#2f3842`） |
| `--input` | `0 0% 10%` | `215 28% 8%` | input-bg `#0f141b` |
| `--ring` | `218 100% 66%` | `219 100% 68%` | accent `#5c95ff` |

> `--border` は現行 `0 0% 58%`（明るい中間グレー）で過剰に目立っていた。多くの箇所は
> `border-panel-border`（alpha ボーダー）を使うが、shadcn の Card 等は `hsl(var(--border))` を
> 不透明で使うため、alpha ボーダーを surface に重ねた見え色 `#2f3842` 相当の HSL へ落とす。

### 4.11 shadcn 変数の Tailwind v4 ブリッジ（必須実装）

**Tailwind v4 ではユーティリティクラスは `@theme` の `--color-*` 変数からしか生成されない。**
`:root` の `--card` 等（4.10）をいくら差し替えても、`@theme` に対応する `--color-card` が無い限り
`bg-card` ユーティリティは生成されず画面に反映されない（現状、下記3クラスは実質 no-op になっている）。

`src/components/` を grep した結果、**実際に使われている shadcn 系ユーティリティは次の3つのみ**。

| ユーティリティ | 使用箇所 |
| --- | --- |
| `bg-card` | `src/components/ui/card.tsx:9` |
| `text-card-foreground` | `src/components/ui/card.tsx:9` |
| `text-muted-foreground` | `src/components/ui/card.tsx:34` |

したがって `src/styles.css` に **以下のブリッジを追加する（この3変数のみ）**。
Tailwind v4 + shadcn の標準手法である `@theme inline` を使い、`:root` の HSL 値へ委譲する。

```css
@theme inline {
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-muted-foreground: hsl(var(--muted-foreground));
}
```

- **使われていない変数は機械的にブリッジしない**: `--background` / `--foreground` /
  `--popover(-foreground)` / `--primary(-foreground)` / `--secondary(-foreground)` /
  `--accent(-foreground)` / `--border` / `--input` / `--ring` に対応するユーティリティは
  `src/components/` に存在しない（`bg-popover-bg` / `bg-input-bg` / `text-accent` 等のヒットは
  すべてプロジェクト独自トークンであり shadcn 変数とは無関係）。`:root` の定義（4.10 の新値）は
  `npx shadcn@latest add` で今後追加される雛形のために維持し、実際に使うユーティリティが
  現れた時点でその変数のブリッジだけを追加する。
- `--muted` は **ブリッジ禁止**: `--color-muted` はプロジェクトの文字色トークン（`#8d99a8`）として
  既に予約済みで名前が衝突する。`bg-muted` を背景に使っている箇所は 4.12 の置換で解消する。

### 4.12 `bg-muted` 系クラスの置換（必須実装）

Tailwind v4 では `bg-muted` は `@theme` の `--color-muted`（= **明るいグレーの文字色** `#8d99a8`）に
解決される。shadcn 由来の「控えめな面」の意図と真逆の明るい背景になり階層設計が壊れるため、
実装フェーズ（トークン差し替えと同一 PR）で **`src/components/ui/table.tsx` の以下を置換する**。

| ファイル・行 | 現行クラス | 置換先 | 理由 |
| --- | --- | --- | --- |
| `src/components/ui/table.tsx:40`（TableFooter） | `bg-muted/50` | `bg-table-header-bg` | フッターは集計バンド＝ヘッダと同じ surface2 の浮き面 |
| `src/components/ui/table.tsx:54`（TableRow） | `hover:bg-muted/50` | `hover:bg-row-hover` | 行ホバーは `row-hover`（`#222b37`）に統一 |
| `src/components/ui/table.tsx:54`（TableRow） | `data-[state=selected]:bg-muted` | `data-[state=selected]:bg-selected` | 選択行は `selected`（`#16304e`）に統一 |

grep により、shadcn 的用法で `bg-muted` / `bg-accent` を背景に使っている箇所は **上記以外に無い**
ことを確認済み。`bg-accent` は `src/components/ui/calendar.tsx:45`（カレンダー選択日）、
`src/components/input/InputFilters.tsx:130`・`src/components/ClanBattleTab.tsx:399,451`
（`bg-none bg-accent` のフラットなアクセントボタン）に存在するが、これらは
**プロジェクト独自の `--color-accent` を意図どおりアクセント塗りとして使っており問題ない（変更不要）**。

---

## 5. タイポグラフィ

| フォント | トークン | 使いどころ | 備考 |
| --- | --- | --- | --- |
| Noto Sans JP | `--font-sans`（既定） | 本文・ラベル・UI 文字すべての既定 | `body` に `font-sans` 適用済み。原則これ |
| Orbitron | `--font-orbitron` | **ブランドタイトルのみ** | 「育成トラッカー」等のロゴ的見出し（例: `MobileHeader` の `h1`）。本文や汎用見出しには使わない |
| Inter | `--font-inter` | 欧文・数字の強調表示 | KPI の大きな数値（例: `StatCard` の値は `font-inter tabular-nums`）。等幅数字が要る数値表示に使う |

- **`font-variant-numeric: tabular-nums` の適用箇所**: 桁が縦に揃うべき数値。具体的には
  KPI 値（`StatCard`）、テーブル内の数量・進捗・必要素材数、チャート軸ラベル等。
  Tailwind の `tabular-nums` クラスで付与する。桁数が動的に変わる集計値には必須。
- 見出しの字間はデザイン踏襲（`tracking-[0.06em]`〜`tracking-[0.1em]` の弱いトラッキング）。
- Orbitron は装飾性が高く可読性が落ちるため、**1画面に1箇所（ブランド名）** を上限とする。

---

## 6. 形状と間隔

### 6.1 角丸

| 用途 | 値 | クラス例 |
| --- | --- | --- |
| カード・パネル・テーブル外枠 | `8px` | `rounded-[8px]` |
| メニュー項目・シート内ボタン等のやや大きい面 | `10px` | `rounded-[10px]` |
| 入力欄・Select トリガー・ポップオーバー・ツールチップ | `12px` | `rounded-[12px]` |
| ボタン・チップ・バッジ・スクロールバーつまみ | 完全な丸（ピル） | `rounded-full` |

- **12px の位置づけ**: 実コードでは入力系・浮遊 UI が広く `rounded-[12px]` を使っている
  （`ui/input.tsx:12`、`ui/select.tsx:18,62`、`ui/tooltip.tsx:27`、`ui/multi-select-filter.tsx:41,57` ほか）。
  本デザインシステムはこの実態を **正式な規定として追認** する。理由: ①インタラクティブ要素
  （入力・浮遊面）をコンテナ（8px）よりわずかに丸くする使い分けは視覚的階層として機能しており、
  ②本フェーズのスコープは色トークン差し替えであり、半径の全面統一は変更範囲を不必要に広げるため。
- 新規要素は上記のいずれかに合わせる。表にない半径（`6px`, `14px` 等）を新設しない。

### 6.2 ボーダー

- 標準の面の輪郭は `border border-panel-border`（= `rgba(180,200,225,0.16)`）。
- テーブル内側の罫線は `table-border`、区切り線は `filter-separator`（より淡い）。
- ボーダーは「面を区切る」目的で使い、**明度差だけで段差が読める場合はボーダーを足しすぎない**。
- 淡いボーダーとして `border-white/15`（タブリスト・下部ナビ等）を使う既存箇所は維持してよい。

### 6.3 影

- 浮遊パネルの影は `shadow-panel`（`0 16px 40px rgba(0,0,0,0.38)`）に集約する。
- カード内の軽い持ち上げは既存の内側ハイライト `shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]` を踏襲。
- **影で階層を作らない**。階層は面の明度（base/surface/surface2）で作り、影は補助。

---

## 7. コンポーネント規約

### 7.1 カード / パネル

- 面: surface `#161c24`（`from-panel-from to-panel-to` は同値でフラット）。
- 枠: `border-panel-border`、角丸 `rounded-[8px]`、内側ハイライト `shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`。
- **base の上に surface のカードを置く**ことで段差を作る。カードの中でさらに面を重ねる場合は surface2 を使う。
- 例（現行踏襲）: `rounded-[8px] border border-panel-border bg-linear-to-br from-panel-from to-panel-to p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`

### 7.2 テーブル

- コンテナ（`tableWrapClass`）: `bg-table-wrap-bg`（surface）+ `border-table-wrap-border` + `rounded-[8px]`。
- **ヘッダ**: `bg-table-header-bg`（surface2）で浮かせ、sticky 時も行より明るく保つ。
- **ゼブラ**: 奇数行 `row-odd`（surface）／偶数行 `row-even`（surface+白2.5%）。差はごく僅かでよい。
- **ホバー**: `row-hover`（surface2 より明るい）+ `row-hover-border`。ホバーで段差が一段上がる感覚を出す。
- 罫線は `table-border`。ソート可能ヘッダのホバー文字は `sort-hover`。

### 7.3 タブ（下線式・lineスタイル）

- リスト: 下線 `border-b border-white/15`。トリガーは透明下線 `border-b-2 border-transparent`。
- 非アクティブ: `text-muted`、ホバーで `text-main`。
- **アクティブ: 下線 `border-accent` + `text-accent` + `font-bold`**（`ui/tabs.tsx` の既定を維持）。
- モバイル下部ナビ（`MobileBottomNav`）も同じ選択表現（`data-[state=active]:text-accent`）を使う。

### 7.4 ボタン（`ui/button.tsx` の variants を維持）

| variant | 面・枠 | テキスト | 用途 |
| --- | --- | --- | --- |
| `default`（primary） | `from-accent to-accent-strong` グラデ（ブランド意匠として維持） | `text-accent-text` | 主要アクション |
| `outline` | `border-white/20 bg-white/5`、ホバーで `border-accent` | `text-main` | 副次アクション |
| `ghost` | 枠なし・背景透明 | `text-muted` → ホバー `text-main` | 低優先アクション |

- 形状は `rounded-full`、ホバーで `-translate-y-0.5`、フォーカスは `ring-2 ring-accent/50`。
- primary のグラデは **原則5の例外（ブランドアクセント）** として維持する。

### 7.5 チップ・バッジ

- 形状: `rounded-full`、極小テキスト（`text-[0.72rem]` 前後）。
- 色は **必ずセマンティックトークン**（`chip-*` / `badge-*` / `attr-*` / `role-*`）を使う。地の色（surface 系）で塗らない。
- 淡色 border/bg/text の三点セットで構成する既存パターンを踏襲。

### 7.6 入力欄

- 面: `bg-input-bg`（`#0f141b`、surface 上で軽く沈む）+ `border-white/20`（既存慣習）+ `rounded-[12px]`。
- ポップオーバー/ Select コンテンツは `bg-popover-bg`（surface2、最前面）+ `rounded-[12px]` + `shadow-panel`。
- プレースホルダ・補助文字は `text-muted`。フォーカスは `focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40`（`ui/input.tsx` の既存パターン）。

---

## 8. 状態表現

| 状態 | 表現 | トークン / クラス |
| --- | --- | --- |
| hover（行・面） | 一段明るい面へ | `row-hover`（surface2 超）/ ボタンは `-translate-y-0.5` |
| hover（文字） | muted → main / sort は accent 寄り | `hover:text-main` / `sort-hover` |
| selected | アクセント色みの面 | `selected`（`#16304e`） |
| checked | selected より濃い青の面 | `checked-bg`（`#123a63`） |
| active（タブ） | アクセント下線＋文字＋太字 | `border-accent` `text-accent` `font-bold` |
| disabled | 沈んだ無効面＋弱い文字、操作不可 | `disabled-bg` / `disabled-text` / `disabled-border`、`disabled:opacity-60 disabled:pointer-events-none` |
| danger | 赤系セマンティック | `text-danger` / `danger-strong` / `bg-danger-bg` |
| focus-visible | アクセントリング | `ring-2 ring-accent/50` |

- 段差の方向は常に「hover/selected で明るく（上がる）」。暗くして状態を示さない。

---

## 9. モバイル

既存のモバイル対応（フェーズ0〜4完了）で確立した規約を守る。

- **カードリスト表示**: 狭幅ではテーブルをカードリスト（`InputProgressList` 等）へ切り替える。
  カード面は surface、内部の補助情報は sub/muted テキスト。
- **下部固定ナビ（`MobileBottomNav`）**: `TabsPrimitive.List` を `fixed bottom-0` に置き、
  `border-t border-white/15` + 現状 `bg-bg-end`。**bg-end は base（`#0d1117`）へ変わる**ため、
  下部ナビは base 面＋上境界線で内容と分離される（純黒でなくなり、上境界線で段差を示す）。
  もし将来より明確な浮遊感が要るなら surface/surface2 へ引き上げる余地があるが、
  **本フェーズ（トークン差し替え）ではコンポーネントの `bg-bg-end` 指定は変更しない**。
- **タップターゲット**: 最低 40px（`min-h-10 min-w-10` 等）を確保する既存方針を維持。
- **safe-area**: `pb-[env(safe-area-inset-bottom)]` 等の safe-area 対応を維持。
- 選択状態・アクセントの表現はデスクトップと共通（`data-[state=active]:text-accent`）。

---

## 10. Do / Don't

### Do

- **面は base / surface / surface2 の3値に寄せる** — 例: 新しいポップオーバーは `bg-popover-bg`（surface2）を使う。
- **色は必ずトークン経由** — 例: 見出しは `text-main`、補足は `text-sub`、キャプションは `text-muted`。
- **数値は Inter + tabular-nums** — 例: `font-inter tabular-nums` で桁を揃える。
- **段差は明度で作る** — 例: テーブルヘッダは `bg-table-header-bg`（surface2）で本体（surface）より明るく。
- **セマンティック色は意味どおりに** — 例: 火属性は `text-attr-fire`、限定バッジは `badge-limited-*`。

### Don't

- **純黒・ほぼ純黒を使わない** — NG: `bg-[#000]` / `bg-black` / `#010101`〜`#0a0a0a`。OK: `bg-bg-start`（`#0d1117`）。
  ただし **モーダルの半透明スクリム（オーバーレイ）は「面」ではないため対象外**:
  `ui/sheet.tsx:17`・`ui/alert-dialog.tsx:15` の `bg-black/65`、`ClanBattleTab.tsx:182` の `bg-black/70`、
  同 437,564 の `bg-black/20`（沈み込み表現）等の黒 alpha は維持してよい。
- **hex をハードコードしない** — NG: `className="bg-[#161c24]"`。OK: `bg-panel-from`。
- **面内グラデで擬似段差を作らない** — NG: カード背景に上下グラデを新設。OK: フラット surface＋surface2 の重ね。
- **セマンティック淡色を装飾流用しない** — NG: 見出しの下線に `attr-water` を使う。OK: 地の UI は accent かスレート系のみ。
- **影で階層を代替しない** — NG: 同色の面を影だけで区別。OK: 明度差（surface→surface2）で区別し影は補助。

---

## 付録: エレベーション早見表

| レベル | 色 | 代表トークン |
| --- | --- | --- |
| L0 背景 base | `#0d1117` | `bg-start` / `bg-end` / `table-wrap-bg` の下地 / スクロールバー溝 |
| L1 カード surface | `#161c24` | `panel-from/to` / `section-from/to` / `table-wrap-bg` / `row-odd` / `card` |
| L1+ 縞 | `#1c222a` | `row-even`（surface + 白2.5%） |
| L2 浮き面 surface2 | `#1c232d` | `popover-bg` / `table-header-bg` / `secondary` / `muted`(shadcn) |
| L2+ ホバー | `#222b37` | `row-hover` |
| アクセント面 | `#5c95ff` | `accent` / primary ボタン / タブ下線 / リング |
| 選択面 | `#16304e` → `#123a63` | `selected` → `checked-bg` |
