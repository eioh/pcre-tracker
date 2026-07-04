# Cloudflare Workers 移行設計

最終更新日: 2026-07-03

このドキュメントは、現行の GitHub Pages 静的 SPA から Cloudflare Workers ベースの構成へ移行するための確定済み設計をまとめたものです。**設計事項は検討済みの決定であり、実装時の再調査・再検討は不要**です。実装エージェントはこのドキュメントを指示書として、記載の通りに実装を進めてください。未確定として明記した項目のみ、実装時に判断・調査してください。

## 背景と課題

- 現状: GitHub Pages で公開している静的 SPA（React 19 + Vite 7 + TypeScript + Zod）。データは `localStorage` に保存している。
- 課題:
  - (a) ブラウザのキャッシュクリアや端末変更などによるデータ消失リスクがある。
  - (b) 複数端末間でデータが同期されない（非同期）。
- 検討の結果、**複数ユーザー・複数端末を前提としたクラウド構成へ移行する方針**を採用した。移行先として Cloudflare を選定した。

## 決定事項サマリー

| 項目 | 決定内容 |
| --- | --- |
| ホスティング | Cloudflare Workers + Static Assets（Pages は使わない） |
| データ層 | D1 一本化（KV は使わない） |
| 認証 | better-auth による GitHub/Google ソーシャルログインのみ（パスワード認証なし） |
| D1 ロケーション | jurisdiction 指定なし + location hint `apac` |
| ローカルモード | 未ログイン時も `localStorage` ベースの全機能を維持（アカウント強制なし） |
| 開発環境 | `@cloudflare/vite-plugin` による `vite dev` 一発起動 |

## アーキテクチャ

### ホスティング構成

- **Cloudflare Workers + Static Assets + D1** を採用する。Cloudflare Pages は使わない。Pages は Workers に機能吸収されつつあり、Cloudflare公式も新規プロジェクトには Workers を推奨しているため。
- **単一 Worker 構成**とする。Vite のビルド成果物を Static Assets として配信し、`/api/*` 配下のリクエストのみ Worker コードで処理する。
- `wrangler.jsonc` の設定方針:
  - `assets.not_found_handling: "single-page-application"`（SPA のクライアントサイドルーティングに対応するため）
  - `run_worker_first: ["/api/*"]`（`/api/*` を Static Assets より優先して Worker に到達させるため）

### 開発環境

- `@cloudflare/vite-plugin`（GA 済み、Vite 7 対応）を使用する。
- `vite dev` 一発で、フロントエンドの HMR と Worker 側 API の両方をローカルで動作させられる構成とする。

### ドメイン

- **カスタムドメイン必須**。`workers.dev` サブドメインは Cloudflare 公式が趣味用途（hobby use）向けと位置付けており、本番運用には非推奨のため使用しない。
- 初期想定ではカスタムドメインの年間費用（年 10〜15 ドル程度）のみが固定費となる。ただし利用増加時は D1 容量・Workers 使用量等の従量課金により有料化する可能性がある。

### デプロイ

- 既存の GitHub Actions ワークフロー（マスターデータの `generate` 差分チェック → テスト実行の流れ）は維持する。
- デプロイステップのみ、現行の `deploy-pages.yml`（`deploy-pages` アクション）から `wrangler-action` に差し替える。

## データ設計

### KV ではなく D1 を採用する理由

- KV の無料枠は書き込み 1,000 回/日までであり、マルチユーザー運用ではすぐに枯渇し破綻する。
- D1 の無料枠は読み取り 500 万行/日、書き込み 10 万行/日、ストレージ 500MB であり、想定用途に対して十分な余裕がある。
- 上記の理由から、**データ層は D1 に一本化し、KV は使用しない**。

### 同期対象データの範囲

- 同期対象は **育成データ（`pcr_growth_tracker`）とコネクトランク計算タブ（`pcr_growth_tracker_connect_rank_calc`）の 2 キーのみ**とする。
- **UI 状態（`pcr_growth_tracker_ui`）は端末ローカルに留め、同期しない**。タブ選択やフィルタ状態が端末間で切り替わるのは体験上不自然なため。
- 同期ペイロードは、既存の `src/domain/backup.ts` の `LocalStorageBackupV1`（3 キー全部入り）とは別に、対象 2 キーのみを含むサブセット形式 **`SyncPayloadV1`** として新設する。

```ts
type SyncPayloadV1 = {
  formatVersion: 1;
  storage: {
    [STORAGE_KEY]: Record<string, unknown>; // pcr_growth_tracker
    [CONNECT_RANK_CALC_STORAGE_KEY]: Record<string, unknown>; // pcr_growth_tracker_connect_rank_calc
  };
};
```

- **育成データ・コネクトランク計算タブの両キーとも object（`Record<string, unknown>` 相当）必須**とし、`LocalStorageBackupV1` の計算タブキーのように `optional`（`?`）にはしない。**`null` も許容しない。** 計算タブを未使用のユーザーであっても、クライアントは空状態を表すオブジェクト（初期状態の `ConnectRankCalcStateV1` 相当）を明示的に格納して送信する。
- キーの欠落・値が `null` の場合はいずれもサーバー側の Zod 検証で `400` として拒否する。キー欠落を拒否する理由は、`optional` を許すと「キー欠落」が「旧クライアントからの送信」「データが空」「変更なし（部分更新）」のいずれを意味するのか一意に定まらない三義性を生むため、**型レベルでこの曖昧さを排除する意図**である。`null` を拒否する理由は、育成データ側は `loadStoredState()`（`src/domain/storage.ts`）が未保存時でも `buildInitialState()` による初期状態オブジェクトを返す設計であるため、正規化済みの in-memory state からペイロードを生成する限り `null` が正当に発生する場面がそもそも存在しないためである。**データの削除・初期化はこの同期 API のスコープ外**とし、そうした用途が必要になった場合は本エンドポイントの黙示的な意味論に含めず、明示的な `reset` 操作として別途定義する。
- **既存の JSON バックアップ復元（`applyBackupPayloadToLocalStorage`、`src/domain/backup.ts`）における「計算タブキー未指定時はローカルの計算タブデータを削除する」という挙動と混同しないこと。** バックアップ復元は `LocalStorageBackupV1` 形式であり `CONNECT_RANK_CALC_STORAGE_KEY` が `optional` であるため「未指定=削除」という意味論を持つが、これは同期（`SyncPayloadV1`）とは別の形式・別の意味論であり、`SyncPayloadV1` では前述の通りキー必須・欠落は検証エラーとする。
- 既存の JSON エクスポート/インポート機能（`LocalStorageBackupV1`、UI 状態を含む 3 キー全部入り）は**ローカルバックアップ用として従来通り維持**する。**同期（`SyncPayloadV1`）とローカルバックアップ（`LocalStorageBackupV1`）は別物**であり、混同しないこと。

### スキーマ

- better-auth が管理する認証関連テーブル（`user` / `session` / `account` / `verification`）をそのまま利用する。
- アプリケーション側のテーブルとして `app_state` および `rate_limit` を新設する。

#### `app_state` テーブル

| カラム | 内容 |
| --- | --- |
| `user_id` | 主キー。`user.id` への外部キー（`ON DELETE CASCADE`） |
| `payload` | `TEXT`（`SyncPayloadV1` の JSON、想定サイズ約 100KB） |
| `revision` | `INTEGER`。サーバーが発行し、保存成功ごとに +1 する |
| `updated_at` | サーバー時刻（更新日時） |
| `payload_format_version` | `INTEGER`。`SyncPayloadV1` の `formatVersion` を指す |

- `payload` には、上記で定義した `SyncPayloadV1` 形式の JSON を格納する（`LocalStorageBackupV1` そのものではない）。
- `payload_format_version` と、`payload` 内部の各データが持つ `schemaVersion`（例: `StoredStateV1.schemaVersion`、`ConnectRankCalcStateV1.schemaVersion`）とは**責務が別**である。前者は同期ペイロードの入れ物のバージョン、後者は個々のデータ構造のバージョンを表す。
- `SyncPayloadV1` の想定サイズ（約 100KB）は、D1 の行サイズ上限（2MB）に対して十分な余裕がある。

#### `rate_limit` テーブル

| カラム | 内容 |
| --- | --- |
| `user_id` | 複合主キーの一部。`user.id` への外部キー（`ON DELETE CASCADE`） |
| `window_start` | 複合主キーの一部。ウィンドウ開始時刻（UNIX タイムスタンプ等） |
| `count` | `INTEGER`。当該ウィンドウ内のリクエストカウント |

- 複合主キー: `(user_id, window_start)`
- 用途: `/api/data` の `PUT` リクエストに対するレート制限カウンタ。詳細は「乱用対策」節を参照。
- 古いウィンドウ行の削除は、日次実行の Cron Trigger で行う。

### D1 のロケーション設定

- **jurisdiction は指定しない**。加えて **location hint に `apac` を指定する**。
- 理由: ユーザー層が日本中心であるため。EU jurisdiction を指定する選択肢も検討したが、jurisdiction 指定は不可逆であり、かつ日本ユーザーへのレイテンシ悪化という実害がメリットを上回ると判断し、見送ることとした。

### 同期方式

- `localStorage` は廃止せず、**ローカルキャッシュ兼オフライン動作用**として維持する。ただし同期されるのは前述の対象 2 キー分のデータ（`SyncPayloadV1` 相当）のみであり、UI 状態（`pcr_growth_tracker_ui`）は同期されない。
- 保存はデバウンス処理を挟んだ上で D1 へ `PUT` する。
- **同期ペイロードは、必ず `loadStoredState()`（`src/domain/storage.ts`）等で読み込み・正規化済みの in-memory state から生成する。`localStorage` の raw 値（生の JSON 文字列）から直接構築してはならない。** 理由: 旧形式のデータや不整合値は `loadStoredState()` の読み込み処理（`migrateToLatestState` / `reconcileWithMaster` によるマイグレーション・補正）を通ることで初めて現行形式に補正される。raw な `localStorage` 値からそのままペイロードを組み立てると、この補正を経ないため、サーバー側の深い Zod 検証（`StoredStateV1` 等の内側スキーマまで検証する構成、詳細は「入力検証」を参照）で拒否される可能性がある。
- **楽観ロック**を厳密に行う:
  1. クライアントはデータ取得時点の `revision` を保持する。
  2. 保存（`PUT`）時にその `revision` をリクエストに添付する。
  3. サーバー側は `UPDATE app_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?` という条件付き更新を実行する。
  4. 更新件数が 0 件（`revision` 不一致 = 競合）の場合は `409` を返す。
  5. クライアントは `409` を受けて最新のサーバー側データを取得し、ユーザーに確認を求める（サーバー優先／ローカル優先をユーザーが選択する。自動上書き・自動マージはしない）。
  - **クライアントが生成する `updatedAt`（`StoredStateV1.updatedAt` 等）は競合判定には使用しない**。競合判定はサーバー発行の `revision` のみで行う。
- **行が存在しない場合（初回アップロード）の作成方式**:
  - 対象ユーザーの `app_state` 行がまだ存在しない場合の新規作成は、`INSERT INTO app_state (...) VALUES (...) ON CONFLICT(user_id) DO NOTHING` を使用する。
  - 挿入件数が 0 件だった場合（＝並行して別タブ・別端末が先に行を作成済みだった場合）は `409` を返す。クライアントは通常の競合時と同様に最新のサーバー側データを取得し、`revision` を伴う通常の更新経路に切り替えるか、確認ダイアログでユーザーに選択させる。
  - この方式により、**複数タブ・複数端末から初回データが同時にアップロードされた場合でも、後勝ちによるデータ消失や行の二重作成が起きないことを保証する**。

### バックアップ

- **D1 Time Travel**（無料枠で 7 日間の PITR）は、**ユーザー単位のバックアップ手段ではなく、DB 全体の災害復旧手段（Point-In-Time Recovery、保持期間 7 日）**として位置づける。誤って自分のデータを上書き・削除した場合の個別復旧には使えない（DB 全体をある時点にロールバックする手段のため）。
- **ユーザー単位の復旧手段は、既存の JSON エクスポート/インポート機能**とする。ユーザーが定期的にエクスポートしておくことで、誤操作時に自分でリストアできる。

## 認証・セキュリティ設計

### 認証方式

- **better-auth**（v1.5 で D1 ネイティブ対応）を採用する。
- 認証方法は **GitHub / Google のソーシャルログインのみ**とする。**パスワード認証は実装しない**（パスワードハッシュの管理・パスワード再設定フローといった負債を避けるため）。
- 代替候補の検討結果:
  - OpenAuth: Beta 段階のため不採用。
  - Lucia: 2025年3月にメンテナンス終了しているため不採用。

### セッション管理

- セッションは `HttpOnly` / `Secure` / `SameSite=Lax` 属性を付けた Cookie と、D1 のセッションテーブルの組み合わせで管理する。
- サーバー側でセッションを保持することで、失効や強制ログアウトをサーバー側から行えるようにする。
- **`localStorage` にトークンを置かない**。

### CSRF 対策

- `SameSite` 属性と Origin 検証（better-auth 組み込み機能）を基礎防御として維持する。
- ただし、**better-auth の Origin 検証（`trustedOrigins`）が保護するのは better-auth が管理するエンドポイント（`/api/auth/*`）のみ**であり、`/api/data` など独自に実装するアプリケーション側の状態変更 API には及ばない。
- そのため、`/api/data` 等の独自 API は **Worker 側ミドルウェアとして以下 3 点を別途実装する**:
  1. **Origin ヘッダの許可オリジン一致検証**: リクエストの `Origin` ヘッダが、本番ドメイン等の許可オリジンリストに一致することを確認する。一致しない場合はリクエストを拒否する。
  2. **`Content-Type: application/json` の必須化**: 状態変更リクエストは `Content-Type: application/json` を必須とし、それ以外（`text/plain` 等、単純リクエストとして送信可能な Content-Type）は拒否する。
  3. **許可メソッドの限定**: 各エンドポイントで許可する HTTP メソッドを明示的に限定し、それ以外のメソッドは拒否する。
- `SameSite=Lax` は Cookie が付与されるための基礎防御として引き続き有効だが、それだけでは独自 API の CSRF 対策として不十分であるため、上記のミドルウェアによる明示検証を**必須要件**とする。

### better-auth 運用設定

- **`baseURL`** を明示的に設定する（自動推定に依存しない）。
- **`trustedOrigins`** を本番ドメイン（カスタムドメイン）で明示設定する。
- **`secret`** は `wrangler secret` でシークレット管理する（リポジトリにコミットしない）。
- **GitHub / Google の OAuth callback URL** を各プロバイダの管理画面に登録する。
- **Cookie 設定**: `HttpOnly` / `Secure` / `SameSite=Lax`。ドメインは本番カスタムドメインとする。
- **プレビュー/ローカル環境の扱い**:
  - OAuth アプリは本番用と分離する。開発用の OAuth クライアント ID を、`localhost` の callback URL で別途登録する。
  - プレビュー URL（デプロイごとに変わる URL 等）での OAuth ログインは、callback URL の事前登録が現実的でないため**対象外**とする。プレビュー環境での認証確認はローカル開発用クライアントで代替する。

### データ隔離（最重要事項）

- **全クエリをセッション由来の `user_id` でスコープする**（`WHERE user_id = ?` を必ず付与する）。
- **クライアントが提供する ID は信用しない**。`user_id` は必ずサーバー側のセッションから取得したものを使う。
- データ隔離が破られていないことを検証する**テストを必須**とする。

### 入力検証

- サーバー側は `SyncPayloadV1` を Zod で検証する。その際、`formatVersion` レベルの浅い検証（現行 `backupPayloadSchema` の `storage` 内が `z.record(z.unknown())` に留まる検証）では不十分であり、**`StoredStateV1` / `ConnectRankCalcStateV1` 等の内側スキーマまで深く検証する**。
- ペイロードサイズの上限を **512KB** とする（JSON parse 前に Content-Length およびボディサイズで確認する。詳細は「乱用対策」を参照）。

### サーバー側検証の信頼境界（設計判断）

- サーバーは `SyncPayloadV1` を内側のドメインスキーマ（`StoredStateV1` の `characterProgressSchema` 等）まで Zod で深く検証するが、**マスターデータ（`MasterCharacter[]`）との照合や、`src/domain/storage.ts` の `reconcileWithMaster` 相当の値補正はサーバー側では行わない**。
- 理由:
  - 補正ロジックとマスターデータのサーバー複製は保守コスト（マスターデータ更新のたびにサーバー側も追従させる必要がある等）が高い。
  - スキーマ検証を通過した「型としては正しいが意味的には古い/異常な値」（例: 廃止されたキャラ名のキー）が壊せるのは、あくまで本人のデータのみであり、他ユーザーへの影響がない。
  - クライアント側は読み込み時に既存の `reconcileWithMaster`（`src/domain/storage.ts`）相当の処理で補正するため、最終的な整合性はクライアント側で担保される。
- したがって、**サーバーは「構造的に妥当な JSON であること」を保証する層であり、「意味的にマスターデータと整合していること」まで保証する層ではない**、という信頼境界を設計判断として明記する。

### PII の扱い

- better-auth の `user` スキーマは `email` を中核フィールドとするため、**メールアドレスの非保存という方針は撤回**する。OAuth プロバイダから取得した email の保存は許容する。
- ただし、保存した email をアプリ画面上での表示や通知送信等の**二次利用はしない**。
- `account` テーブルには better-auth のデフォルト動作として **access token / refresh token / scope が保存される**ことを明記する。
- プライバシーポリシーには、**email・プロバイダ ID・表示名・トークン**が保存される旨を記載すると規定する。
- 従来の「PII 最小化」の方針は、「保存はしない」ではなく「**保存は better-auth の要件の範囲に留め、利用（表示・通知等の二次利用）を最小化する**」という趣旨に改める。

### アカウント削除・プライバシーポリシー

- アカウント削除機能を用意する。better-auth のユーザー削除 API を起点とし、`user` / `session` / `account` / `verification` 系テーブルと、`app_state`（`user_id` の `ON DELETE CASCADE` により連動削除）を削除する。
- **D1 Time Travel の保持期間（7 日間）中は、削除済みデータが PITR により復元可能な状態で残存する**。この点をプライバシーポリシーに明記する。
- プライバシーポリシーページを用意する。
- **削除の実装・検証要件**:
  - D1 マイグレーションでは、`app_state` の `user_id` 外部キー、および `rate_limit` の `user_id` 外部キーの両方に **`ON DELETE CASCADE` を明示的に付与する**こと。
  - D1（SQLite）は接続ごとに外部キー制約の有効・無効を切り替えられるため、**`foreign_keys` プラグマが有効になっていることを実装時に確認する**こと（無効な場合は `ON DELETE CASCADE` が機能せず、退会後もデータが残存する）。
  - 退会 API 経由で、`user` / `session` / `account` / `verification` 系テーブルと `app_state` が正しく連動削除されることを検証する**テストを必須要件**とする。このテストは、外部キー設定の漏れによって退会後もデータが残存してしまう不具合を防ぐことを目的とする。

### 乱用対策

初期リリースに以下を含める:

- **ボディサイズ上限チェック**: JSON parse 前に Content-Length およびボディサイズを検証し、**512KB** を超えるリクエストを拒否する。
- **簡易レート制限**:
  - **対象**: `/api/data` の `PUT`。
  - **上限**: 認証済み `user_id` 単位で **30 回 / 5 分**。超過時は `429` を返す。
  - **実装方式**: 固定ウィンドウ方式とする。D1 上に `rate_limit`（`user_id`, `window_start`, `count`）テーブルを設け、リクエストごとに `INSERT INTO rate_limit (user_id, window_start, count) VALUES (?, ?, 1) ON CONFLICT(user_id, window_start) DO UPDATE SET count = count + 1 RETURNING count` を実行してカウントを原子的に加算し、返り値の `count` が閾値（30）を超えていれば `429` を返す。
  - **古いウィンドウ行の削除**: 期限切れとなったウィンドウの行は、日次実行の **Cron Trigger** でまとめて削除する。
  - **設計判断（D1 書き込みコストの許容）**: レート制限自体が D1 の書き込みを 1 リクエストあたり 1 回消費する。この点について、正常系のクライアント（デバウンス済み）の書き込み頻度は分 1 回未満であり、かつレート制限の上限値（30 回 / 5 分）自体も小さく設定しているため、レート制限機構が発生させる D1 書き込み量は無料枠に対して許容範囲内と判断する。
  - **認証前エンドポイント（`/api/auth/*`）の扱い**: `/api/auth/*` はこのユーザー単位レート制限の対象外とする。認証前は `user_id` が確定しないため同じ仕組みを適用できず、当面は Cloudflare が既定で提供する防御（DDoS 対策等）に委ねる。乱用の兆候が観測された時点で、後述の Turnstile 追加という既定方針に沿って対応する。
- **D1 使用量の監視閾値**: 無料枠の 8 割に達した時点で通知する。

以下は「兆候が出たら追加」のまま据え置く:

- 認証エンドポイントへの **Turnstile**（無料・無制限）の追加。

### 未ログイン時の扱い

- **未ログイン時は `localStorage` によるローカルモードで全機能を維持する**。アカウント作成・ログインを強制しない。
- 初回ログイン時の引き継ぎフローは「初回ログイン時のデータ引き継ぎ」節を参照。

### 初回ログイン時のデータ引き継ぎ

ログイン成功後、以下の分岐でサーバー側の `app_state` とローカルの状態を突き合わせる。

1. **サーバー側 `app_state` が空 & ローカルに実データあり** → ローカルデータをサーバーへアップロードする。
2. **サーバー側 `app_state` にデータあり & ローカルが初期状態**（未使用端末等） → サーバー側のデータを採用する。
3. **両方に実データあり** → 双方の `updatedAt` 等を提示する確認ダイアログを表示し、ユーザーに **サーバー優先／ローカル優先** を選択させる。**自動マージは行わない**。

- **複数プロバイダのアカウントリンク（GitHub と Google を同一ユーザーとして統合する機能）は初期スコープ外**とする。別プロバイダでログインした場合は別アカウント扱いとなる。この制約は設計書とユーザー向け案内（ログイン画面や案内ページ）の両方に明記する。

#### 「ローカルが初期状態」の判定方法

上記の分岐 2（ローカルが初期状態かどうか）は、単純な空判定では成立しない。`src/domain/storage.ts` の `buildInitialState()`（内部で `reconcileWithMaster(masterCharacters, null)` を呼ぶ）は、未使用端末でも**マスターデータ全キャラ分の `progressByName` エントリと現在時刻の `updatedAt` を生成する**ため、「見た目が空」でも `localStorage` の値は空文字列や `null` にはならない。したがって「`localStorage` にキーが存在しない」だけを判定条件にはできず、実際に生成される `StoredStateV1` の中身が初期状態と一致するかどうかを比較する必要がある。この判定は以下の優先順位で行う。

1. **一次判定: ユーザー操作済みフラグ（「実データあり」の確定にのみ使う）**
   - `localStorage` に新規キー（例: `pcr_growth_tracker_touched`）を設け、ユーザーが初めて編集操作（進捗の変更等、状態を更新するあらゆる操作）を行った時点でセットする。
   - このフラグは「実データあり」を確定させる方向にのみ使う。**フラグが存在する場合は「ローカルに実データあり」と確定する。** 一方、**フラグが存在しない場合は「初期状態」と判定してはならない**。フラグ導入前からローカルに実データを持つ既存ユーザーが、フラグ不在ゆえに「初期状態」と誤判定されると、そのままサーバー側データで上書きされデータ喪失に直結するため。フラグが存在しない場合は、必ず次の二次判定に進む。
   - このフラグは同期対象外（`SyncPayloadV1` にも `LocalStorageBackupV1` にも含めない）とし、端末ローカルの判定専用データとして扱う。
2. **二次判定: 初期状態との同値比較**
   - 一次判定でフラグが存在しなかった場合（フラグ導入前からローカルにデータがある利用者を含む）に必ず実行する判定。現在のマスターデータで生成した `buildInitialState()` の結果と、実際に読み込み・正規化済みの `loadStoredState()` の結果を比較する。
   - 比較時は `updatedAt` を比較対象から除外する（`buildInitialState()` は呼び出し時刻を `updatedAt` に埋め込むため、`updatedAt` を含めると常に不一致になる）。`updatedAt` 以外のフィールド（`progressByName` / `purePieceByCharacterName` / `purePieceByBaseName`）が完全一致する場合のみ「初期状態」と判定する。
3. **判定不能・曖昧な場合は安全側に倒す**
   - 一次判定・二次判定のいずれでも確定できない場合、または結果が曖昧な場合は、**「両方に実データあり」（分岐 3）として扱い、確認ダイアログを表示する**。ローカルデータの無断アップロードや、サーバーデータの無断上書きは絶対に行わない。

## 運用

- デプロイフローは既存の GitHub Actions を土台にし、デプロイステップのみ `wrangler-action` に置き換える（詳細は「アーキテクチャ > デプロイ」を参照）。
- D1 Time Travel（7日間 PITR）は DB 全体の災害復旧手段として運用し、ユーザー単位の復旧は既存の JSON エクスポート/インポート機能で行う（詳細は「データ設計 > バックアップ」を参照）。
- 乱用対策のうちボディサイズ上限・簡易レート制限・D1 使用量監視は初期リリースから運用する。Turnstile 導入は必要になった時点で追加対応する。

## 未確定事項（実装時要確認）

以下は本設計時点では未確定であり、実装時に調査・判断が必要な事項です。

- **Workers Rate Limiting binding** が Cloudflare の無料プランで利用可能かどうか、公式ドキュメントに明記がなく未確認。利用できない場合は、D1 上のユーザー毎カウンタで代替する。
- 旧 GitHub Pages URL からの誘導方法（リダイレクトページを設置するか、案内のみに留めるか）。
- カスタムドメインのドメイン名の選定。

## 段階的移行計画

実装は以下のフェーズ順に進めることを推奨する。各フェーズは独立してリリース可能な単位とする。

1. **Workers + Static Assets 化**（データ層は現状の `localStorage` のまま）— ホスティング移行のみを行う。
2. **better-auth + D1 導入**、`/api/data` の実装。
3. **フロントエンドへの同期層追加**（ローカルモードとの共存を維持したまま同期機能を追加する）。
4. **移行案内・プライバシーポリシーの整備**。
