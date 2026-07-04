# Cloudflare Workers 移行 Phase 3: フロントエンド同期層

参照設計書: `docs/design/workers-migration.md`（確定済み設計。特に「同期方式」「初回ログイン時のデータ引き継ぎ」「未ログイン時の扱い」節）
Phase 1・2 の記録は git 履歴（cf1394e / 1299687 の tasks/todo.md）を参照。本番は https://pkne.app で稼働中。

## スコープ

- 段階的移行計画の **Phase 3 のみ**: ログイン UI、同期層（デバウンス PUT・409 競合ダイアログ）、初回ログイン時の引き継ぎフロー。
- **未ログイン時は現状の localStorage ローカルモードを完全維持**（挙動変更ゼロ。設計書指定）。
- アカウント削除 UI・プライバシーポリシー・移行案内は **Phase 4**。

## 調査済みの現状（実装時に再調査不要）

- `App.tsx`: `state: StoredStateV1` を useState で保持、400ms デバウンスで `saveStoredState`。Context・カスタムフック不使用の単一コンポーネント。ヘッダー右側にエクスポート/インポート/初期化ボタン群 + 「最終更新」表示（ログイン UI・同期ステータスの自然な配置場所）。
- **コネクトランク計算タブは App.tsx と独立**: `ConnectRankCalcTab.tsx` が自前で `loadConnectRankCalcState()` / 即時 `saveConnectRankCalcState()`。同期層は App の state だけでは完結しない。
- ダイアログは `AlertDialog` のみ（`messageDialog` state に内容を積んで単一ダイアログで表示するパターンが App.tsx に既存）。トースト機構なし。データフェッチライブラリなし（素の fetch）。
- `src/domain/sync.ts`（Phase 2 実装済み）: `SyncPayloadV1` 型 + `parseSyncPayloadV1`。DOM 非依存でクライアントから再利用可。
- better-auth はデフォルト basePath `/api/auth`。クライアントは `better-auth/react` の `createAuthClient`（baseURL はデフォルト=同一オリジンで一致）。
- `/api/data` API（Phase 2 実装済み）: GET → `{ revision, payload, updatedAt }` or 404。PUT `{ baseRevision: number|null, payload }` → 200 `{ revision }` / 401 / 409 / 400 / 413 / 429。PUT は Origin + Content-Type: application/json 必須。
- `reconcileWithMaster` は storage.ts の非 export。「初期状態判定」は storage.ts 内に判定関数を新設して export するのが自然。
- レート制限は 30 回/5 分。正常系クライアントは「分 1 回未満」の書き込み頻度が設計前提。

## 設計判断（本計画で確定。実装時の再検討不要）

1. **同期メタ情報**: 新規 localStorage キー `pcr_growth_tracker_sync` を端末ローカルに持つ。内容は `{ userId: string, revision: number, localChangeSeq: number, lastSyncedSeq: number }`。touched フラグ（`pcr_growth_tracker_touched`）と同様に **同期対象外・バックアップ対象外**。
   - **dirty は boolean で持たない**。ローカル編集ごとに `localChangeSeq` を単調増加させ、`localChangeSeq > lastSyncedSeq` を dirty とみなす。PUT は開始時点の seq を控え、**成功時にその seq を `lastSyncedSeq` に記録する**（PUT 中に発生した後続編集は `localChangeSeq > lastSyncedSeq` のまま残り、次のデバウンス PUT で送られる。「送っていない編集を同期済み扱いにする」余地を型レベルで排除）。
   - **`userId` でセッションユーザーと突き合わせる**。ログイン時に同期メタの `userId` が現セッションと不一致（別アカウントへの切替）の場合は同期メタを無効化して破棄し、**「初回ログイン時のデータ引き継ぎ」フローに落とす**。このときローカルに未同期変更（dirty）や実データがあれば自動 PUT はせず、必ず確認ダイアログ（分岐 3）に倒す。前アカウントのローカルキャッシュを新アカウントのサーバーデータへ無断で上書き・アップロードすることは絶対にしない。
2. **同期ペイロードの生成**: 育成データは App の in-memory state（正規化済み）、計算タブは同期直前に `loadConnectRankCalcState()`（読み込み時正規化を通る）で取得。**localStorage の raw 値からは構築しない**（設計書指定）。
3. **同期トリガ**: ログイン中、(a) App の state 変更、(b) 計算タブの保存、のいずれかで `localChangeSeq` を加算し、**10 秒デバウンス**で PUT（レート制限 30 回/5 分に対し十分低頻度）。計算タブ→App への変更通知は、ConnectRankCalcTab に任意の `onStateSaved` コールバック prop を追加する（最小変更。カスタムイベントや Context は導入しない）。PUT 成功で `revision` 更新 + PUT 開始時 seq を `lastSyncedSeq` へ記録（設計判断 1 参照）。
4. **起動時・ログイン直後のフロー**（セッション検出時に GET。**その前に同期メタの `userId` 突き合わせを必ず行う** — 不一致なら設計判断 1 のとおりメタ破棄 + 引き継ぎフローへ）:
   - GET 404（サーバー空）: ローカルが「実データあり」→ 引き継ぎ分岐 1（`baseRevision: null` でアップロード）。ローカルが「初期状態」→ 何もしない（次の変更から同期開始）。
   - GET 200 & `revision === 同期メタの revision`: 同期済み。dirty なら PUT。
   - GET 200 & `revision !== 同期メタの revision` & **dirty でない**: 他端末の更新。**サーバーデータを黙って採用**（競合ではなくキャッシュ更新。自動マージには当たらない）。ただし**採用（localStorage 書き込み）の直前に、GET 判定時に控えた `localChangeSeq` と現在値を再比較**し、進んでいたら（GET 処理中にユーザー編集が入っていたら）黙って採用せず競合ダイアログに倒す（非同期処理の完了時は開始時点の前提を必ず再検証する）。
   - GET 200 & `revision !== 同期メタの revision` & **dirty**: 競合。確認ダイアログ（分岐 3 と同じ UI）。
   - 同期メタが存在しない初回ログイン: 設計書の 3 分岐（下記 5・6）。
5. **「ローカルに実データあり」判定**（設計書の優先順位どおり）:
   - 一次: touched フラグが**あれば**「実データあり」確定。**なければ初期状態と断定せず**二次判定へ。
   - 二次: `buildInitialState()` と `loadStoredState()` の結果を `updatedAt` 除外で深い比較（storage.ts に判定関数を新設）+ 計算タブはデフォルト状態との比較。両方一致なら「初期状態」。
   - 判定不能・曖昧は「実データあり」側（分岐 3 のダイアログ）に倒す。
6. **サーバーデータの採用（分岐 2・競合でサーバー優先選択時・起動時の黙って採用、すべて共通）**: `parseSyncPayloadV1` で検証 → 2 キーを localStorage へ書き込み + 同期メタ更新 → **既存のインポート復元と同じ「ダイアログ表示 → ページリロード」パターン**で反映（計算タブが localStorage をマウント時に読む構造のため、リロードが最も確実で既存前例に合致)。
   - **共通ルール（自動採用の直前再検証）**: ユーザーの明示選択を経ない自動採用（起動時の黙って採用・初回引き継ぎ分岐 2）では、**localStorage 書き込み直前に、判定時に控えた `localChangeSeq` と現在値を必ず再比較**する。進んでいた場合（判定〜採用の間にユーザー編集が入った場合）は自動採用を中止し、競合ダイアログ（分岐 3）に倒す。ユーザーが競合ダイアログで明示的に「サーバー優先」を選んだ場合はその選択が最新の意思なのでそのまま採用してよい。
7. **競合ダイアログ**（分岐 3 / 409 / 起動時競合）: 既存 `AlertDialog` パターンを踏襲し、双方の `updatedAt` を表示して「サーバーのデータを使う」/「この端末のデータを使う」の二択。自動マージなし（設計書指定）。ローカル優先選択時は GET で得た最新 `revision` を `baseRevision` に PUT（再度 409 なら再度ダイアログ）。
8. **touched フラグのセット位置**: ユーザーの編集操作による state 更新経路（App.tsx の更新ハンドラ・ConnectRankCalcTab の state 更新）でセットする。**保存関数（save*）内ではセットしない**（マウント直後の自動保存で誤って立つのを防ぐ）。バックアップインポートや「サーバーデータ採用」での書き込みでは立てない（→ インポートは編集扱いにするか実装時に整理し、判定根拠をコメントに明記）。※インポートはユーザーが自分のデータを持ち込む操作なので touched を立てるのが安全側。
9. **同期ステータス表示**: ヘッダーに小さなステータステキスト（未ログイン時は非表示 or ログインボタンのみ / 同期済み / 同期中 / エラー）。**同期エラーで モーダルは出さない**（次回変更時・次回起動時に自動リトライ。恒常エラーはステータス表示で気付ける）。401 検出時はセッション切れとしてログアウト状態表示に戻す。
10. **ログイン UI**: ヘッダーに「ログイン」ボタン → `AlertDialog` で GitHub / Google の 2 ボタン + **「GitHub と Google は別アカウント扱いになる」旨の注意書き**（設計書の明記要件）。ログイン中はメニュー（ログアウト）+ 同期ステータス。`signIn.social({ provider, callbackURL: "/" })`。
11. **同期ロジックの配置**: 判定・比較・ペイロード構築などの純粋ロジックは `src/domain/syncClient.ts`（DOM 非依存、テスト容易）に、React 統合（セッション監視・デバウンス・fetch）は `src/hooks/useSync.ts` カスタムフックに分離。App.tsx への追加は最小限に留める。

## Todo

- [x] 1. `src/domain/syncMeta.ts`(仮): 同期メタ（`pcr_growth_tracker_sync`）と touched フラグ（`pcr_growth_tracker_touched`）の読み書き（storageKeys.ts にキー定数追加。バックアップ・同期対象外であることをコメント明記）
- [x] 2. storage.ts: 初期状態判定関数（`updatedAt` 除外の深い比較）を新設・export。connectRankCalcStorage 側も同様のデフォルト比較を用意
- [x] 3. `src/domain/syncClient.ts`: ペイロード構築（in-memory state + loadConnectRankCalcState から）、`/api/data` GET/PUT の fetch ラッパ（credentials 同送、レスポンス検証に parseSyncPayloadV1 使用）、起動時フロー・引き継ぎ 3 分岐の判定ロジック（純関数中心）
- [x] 4. 認証クライアント: `src/lib/authClient.ts`（`better-auth/react` の `createAuthClient`。公式 docs でクライアント API を裏取りしてから実装）
- [x] 5. `src/hooks/useSync.ts`: セッション監視（useSession）、起動時 GET フロー、10 秒デバウンス PUT、409 → 競合ダイアログ用 state、401 → ログアウト扱い
- [x] 6. App.tsx 統合: ヘッダーにログイン UI・同期ステータス、競合/引き継ぎダイアログ（既存 messageDialog パターン踏襲）、touched フラグのセット（編集ハンドラ経由）、ConnectRankCalcTab への `onStateSaved` prop 追加
- [x] 7. テスト（front project、jsdom + fetch モック）: 初期状態判定（touched あり/なし × 初期/実データ）、引き継ぎ 3 分岐、起動時フロー 4 ケース（404/一致/黙って採用/競合）、409 → ローカル優先 → 再 PUT、ペイロードが正規化経由で構築されること、**PUT 中の後続編集が dirty のまま残ること（seq 競合）**、**同期メタの userId 不一致でメタ破棄 + 引き継ぎフローに落ち自動 PUT されないこと**。既存 126 件 + worker 26 件の全パス維持
- [x] 8. 検証: `npm run typecheck` / `npm test` / `npm run build` 全成功。`vite dev` で (a) 未ログイン時に従来 UI が無変化で動くこと、(b) ログインダイアログが開き GitHub/Google ボタンと注意書きが表示されること、(c) 未ログインで /api/data への通信が発生しないこと を確認
- [x] 9. レビュー: Claude レビューエージェント + codex（gpt-5.5）ダブルレビュー。指摘対応
- [x] 10. コミット（`develop`、Conventional Commits）

## ユーザー側作業・注意（スコープ外）

- 実 OAuth ログインの動作確認（ローカルは `.dev.vars` の開発用 OAuth クライアント、本番は pkne.app）。**Google OAuth 同意画面が「テスト」モードのままなら本人以外はログイン不可 → 公開設定を確認**
- 動作確認後、必要なら Phase 4（アカウント削除 UI・プライバシーポリシー・移行案内）へ

## レビューセクション

実施日: 2026-07-04

### 実装結果

- Todo 1〜8 完了。最終テスト **197 件全パス**（front 171 = 既存 126 + Phase 3 新規 45 / worker 26）、typecheck / build 成功。実ブラウザで「未ログイン時の UI 無変化」「ログインダイアログ（GitHub/Google + 別アカウント注意書き）」「未ログイン時 /api/data 通信ゼロ」を確認。
- 構成: 純ロジックは `syncClient.ts` / `syncMeta.ts`（DOM 非依存）、React 統合は `useSync.ts`、UI は `SyncHeader.tsx`。better-auth クライアントは `createAuthClient()` デフォルト設定で成立。

### ダブルレビュー結果（計 3 巡で致命的 5 件を検出 → 全修正・回帰テスト化）

- **1 巡目**: codex 2 件（GET 中アカウント切替の stale userId closure、ログイン中インポートの stale state PUT）+ Claude/Opus 1 件（`noop` 分岐が stale メタを書き戻し GET 中の編集を恒久未同期化）。
- **2 巡目（codex）**: 残存 2 件（409 経由の競合ダイアログが userId 非紐付け、in-flight PUT の完了処理がインポート後も生存）。
- 対策: `latestUserIdRef` による await 復帰後照合、`ConflictInfo.userId` 刻印と解決時照合、世代カウンタ `syncGenerationRef` による in-flight 処理の無効化、`noop` 分岐の fresh メタ読み直し、インポート専用 `notifyLocalDataImported`（永続 dirty 化のみ・PUT 予約なし）。
- 全 5 件に**ミューテーション確認付き回帰テスト**（修正を revert すると該当テストが fail することを実測）。最終巡で両レビューとも致命的指摘なし。

### 残課題（ユーザー作業 / Phase 4）

- 実 OAuth ログインの動作確認（本番 pkne.app / ローカル）。Google OAuth 同意画面が「テスト」モードなら公開設定が必要
- Phase 4: アカウント削除 UI・プライバシーポリシー・移行案内
- npm audit 推移的依存 5 件（未対応）
