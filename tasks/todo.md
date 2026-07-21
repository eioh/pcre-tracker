# PWA 化(インストール可能化 + オフラインシェル)

## 背景

スマホ対応フェーズ0〜4(育成入力のモバイル UI・他タブ調整)は完了済みで、次の本命として PWA 化が合意済み(前回 todo.md レビュー節)。本タスクで以下を実現する。

- **インストール可能**: ホーム画面追加(A2HS)でスタンドアロン起動(アドレスバーなし)
- **オフライン起動**: アプリシェル(HTML/JS/CSS/アイコン)を Service Worker で precache し、機内モードでも起動可能にする。ユーザーデータは既に localStorage 保持のためシェルさえ起動すれば閲覧・編集可能
- **安全な更新**: 新バージョン検出時にプロンプト(トースト)を出しユーザー操作で更新。編集中の突然のリロードを避ける

前提となる現構成:
- Vite 7 + `@cloudflare/vite-plugin`(クライアントは `dist/client` へ出力、Worker は `/api/*` のみ。`run_worker_first: ["/api/*"]` なので `/sw.js` 等は静的アセットとして配信される)
- `public/favicon.png` は 2048x2048(アイコン生成の元素材に使える。ただし 7MB あるので precache 対象から除外必須)
- テーマ色: スレートナイト背景 `#0d1117`(styles.css `--color-bg-start`)

## 設計方針

### プラン A(第一候補): vite-plugin-pwa(generateSW)

標準的な `vite-plugin-pwa@^1.0`(Vite 7 対応)+ Workbox generateSW を使う。

- **最初にスパイクで互換性検証**: `@cloudflare/vite-plugin` との併用は Environment API 絡みの相性問題の報告歴があるため、実装の最初に `npm run build` で `dist/client/sw.js` と precache マニフェスト(index.html + ハッシュ付きアセット)が正しく生成されるかを確認する。NG ならプラン B へ切替
- `registerType: "prompt"`: 更新はユーザー操作で適用(`updateServiceWorker(true)` でリロード)
- **precache 対象**: `globPatterns: ["**/*.{js,css,html,webmanifest}", "icons/*.png"]`。デフォルトの `**/*.png` にすると 7MB の favicon.png を precache してしまうため明示指定。アイコンは `public/icons/` 配下に置いて区別する
- `navigateFallback: "/index.html"` + `navigateFallbackDenylist: [/^\/api\//]`(SPA オフライン起動。`/api/*` には SW を介入させない — better-auth の OAuth リダイレクトやデータ同期に触らない)
- **Google Fonts のランタイムキャッシュ**: 公式レシピどおり `fonts.googleapis.com`(stylesheet, StaleWhileRevalidate)/`fonts.gstatic.com`(webfont, CacheFirst + 1年 expiration)。オフライン起動時のフォント崩れ防止
- dev では SW 無効(devOptions はデフォルト off のまま)

### マニフェスト

- `name: "プリコネ育成トラッカー"` / `short_name: "プリコネ育成"`(ホーム画面ラベル向けに短く)
- `display: "standalone"`, `lang: "ja"`, `start_url: "/"`, `scope: "/"`
- `theme_color: "#0d1117"`, `background_color: "#0d1117"`(スプラッシュがダークテーマと連続する)
- icons: 192(any), 512(any), 512(maskable), apple-touch-icon 180 は index.html の `<link>` で指定

### アイコン生成(コミットする静的ファイル、依存追加なし)

`public/favicon.png`(2048²)から PowerShell + System.Drawing の一時スクリプトで生成し、`public/icons/` にコミット:
- `icon-192.png`, `icon-512.png`: 単純縮小
- `maskable-icon-512.png`: `#0d1117` で塗った 512² キャンバス中央に元画像を 80%(セーフゾーン)で合成
- `apple-touch-icon.png`(180²): `#0d1117` 背景で不透明化(iOS は透過 PNG だと黒背景になるため)
生成スクリプトはリポジトリに残さない(scratchpad で実行)。

### index.html 追記

- `<meta name="theme-color" content="#0d1117">`
- `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`
- manifest の `<link>` は vite-plugin-pwa が自動注入

### 更新プロンプト UI(`src/components/PwaUpdatePrompt.tsx`)

- App にマウントする小型の固定バナー(DESIGN.md スレートナイト準拠、モバイルは MobileBottomNav と重ならない位置)
- **テスト(jsdom)を壊さない工夫**: `virtual:pwa-register` の import は `useEffect` 内の動的 import + `import.meta.env.PROD` ガードで行う(vitest では PROD=false のため仮想モジュールが解決されず失敗する問題を回避。静的 import は使わない)
- `onNeedRefresh` → バナー表示「新しいバージョンがあります」+「更新」ボタン + 閉じる
- **更新適用前に保留中のローカル保存を同期 flush する**(codex プランレビュー指摘): App は編集 state を 400ms デバウンスで localStorage 保存しているため(App.tsx の `STORED_STATE_SAVE_DEBOUNCE_MS`)、「更新」即リロードでは直前の編集が失われうる。App から `flushPendingSave`(内部で `saveStoredState(stateRef.current)` を同期実行。stateRef は既存の常時最新参照)を props で受け取り、**「更新」クリック時は必ず flush → `updateServiceWorker(true)` の順**で呼ぶ。プラン B でも同様に flush → `SKIP_WAITING` postMessage → `controllerchange` リロードの順とする
- **テスト容易性のための分離**: 見た目と操作は presentational な `PwaUpdateBanner`(props: `onUpdate` / `onDismiss`)に切り出し、「更新」押下で `flushPendingSave` → 更新適用が**この順で**呼ばれることを単体テストする。`virtual:pwa-register` への配線部分(PROD ガード)はテスト対象外の薄いレイヤーに保つ
- `onRegisteredSW` → 1時間間隔で `registration.update()` を呼ぶ(インストール型アプリは長時間開きっぱなしになるため定期チェック)
- `offlineReady` の通知は出さない(初回訪問で毎回出るのはノイズ)
- `src/vite-env.d.ts` に `/// <reference types="vite-plugin-pwa/client" />` を追加

### プラン B(フォールバック): 手書き SW + 自前 precache 注入

vite-plugin-pwa がビルド統合で NG の場合のみ採用する。**プラン A と同等の要件(全遅延チャンクの precache・プロンプト式更新)を維持し、機能を縮退させない**(codex プランレビュー指摘):

- `public/manifest.webmanifest` + 手書き SW テンプレート(`src/sw/sw.template.js` 等)
- **precache 一覧の注入**: 小さな Vite プラグイン(closeBundle フック)または後処理スクリプトで、ビルド成果物(`dist/client/**/*.{js,css,html,webmanifest}` + `icons/*.png`)のハッシュ付きパス一覧を SW 内のプレースホルダに書き込み、`dist/client/sw.js` として出力する。install 時に全 precache → activate 時に旧バージョンのキャッシュを削除(キャッシュ名にビルドハッシュを含める)
- ナビゲーションは network-first(オフライン時は precache 済み index.html)、`/assets/*` は cache-first、`/api/*` は素通し
- **更新プロンプトも維持**: SW は `skipWaiting` を自動では呼ばず、`registration.waiting` 検出時に PwaUpdatePrompt を表示 → 「更新」で `waiting.postMessage({type:"SKIP_WAITING"})` → `controllerchange` でリロード(プラン A と同一 UX)

## レビュー(結果)

- **プラン A(vite-plugin-pwa@1.3.0)採用**。スパイクで `@cloudflare/vite-plugin` との共存 OK を確認(プラン B は不要)
- **レビュー経過**: 初回2系統(codex=指摘なし、Claude Opus=重要2+軽微4)→ 修正 → codex 追加指摘3巡
  (①pagehide flush がインポート/サーバー採用データを旧 state で上書き → 保留フラグゲート、
  ②保留中窓(400ms)内の採用でゲートを素通り → 採用/インポート開始時の cancelPendingSave、
  ③インポート失敗(ロールバック)時にキャンセル済み保留保存が復活しない → キャンセルを適用の正常終了直後へ移動)
  → すべて修正し最終承認(致命的指摘ゼロ)。付随して「debounce タイマー自体が採用データを上書きする既存レース」も cancelPendingSave で根本修正
- **検証**: typecheck / test 318件 / build 全緑。各データ損失経路はネガティブコントロール(修正を外すとテストが失敗)で再現性を実証。
  headless Chrome 受け入れ 12/12 PASS(SW 登録・precache 28件・favicon 除外・フォントキャッシュ有効・`/api/*` 非介入・オフライン起動でアプリ完全描画)
- **意図的逸脱**: `virtual:pwa-register` のテスト用 alias スタブ(`src/test/stubs/`)を追加。Vite の import 解析はリテラル動的 import も静的解決するため、PROD ガードだけでは vitest(front)が解決失敗する

## スコープ外

- 7MB の favicon.png / 414KB の favicon.ico の軽量化(フォローアップとして報告に記載)
- iOS スプラッシュスクリーン画像(apple-touch-startup-image)の個別生成
- プッシュ通知・バックグラウンド同期
- タブ切替時のスクロール位置復元・hover 依存改善(スマホ対応の別項目)

## 検証

- `npm run typecheck` / `npm test` / `npm run build` 全緑
- `dist/client/` に `sw.js`・`manifest.webmanifest`・`icons/*` が出力され、sw.js の precache リストに index.html とハッシュ付きアセットが含まれ、**favicon.png が含まれない**こと
- `npm run preview` + Chrome 実画面: SW 登録成功(`navigator.serviceWorker.controller`)、manifest 認識、`caches` に precache が存在、`/api/*` リクエストが SW に横取りされないこと
- 可能なら DevTools オフライン相当の確認(SW 登録後にリロードしてキャッシュから起動)

## 実装ステップ

- [x] `git fetch origin` → `git switch -c feature/pwa origin/develop`
- [x] スパイク: vite-plugin-pwa 導入 + `npm run build` で Cloudflare プラグインとの共存を確認(NG ならプラン B へ) → プラン A で共存 OK（`dist/client/sw.js`・`manifest.webmanifest` 生成確認済み）
- [x] アイコン生成(scratchpad スクリプト)→ `public/icons/` に生成（icon-192 / icon-512 / maskable-icon-512 / apple-touch-icon）。git add はコミット手順で実施
- [x] vite.config.ts に VitePWA 設定、index.html 追記、PwaUpdatePrompt 実装 + App へマウント
- [x] テスト: PwaUpdateBanner の flush → 更新適用の呼び出し順・PwaUpdatePrompt が非 PROD で何も描画しないこと・既存テストが全緑のまま
- [x] typecheck / test / build / preview 検証（typecheck 緑・test 313 緑・build 緑・preview で `/manifest.webmanifest`・`/sw.js` 200 配信確認。ブラウザ実画面は監督側で実施）
- [x] codex + Claude 系サブエージェントの2系統レビュー → 致命的指摘ゼロまで修正ループ(詳細は「レビュー(結果)」節。最終 318 テスト全緑)
- [x] Conventional Commits でコミット(**push はしない**)
