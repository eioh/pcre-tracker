-- Migration number: 0002 	 2026-07-04T00:00:01.000Z
-- アプリケーション側テーブル（設計書「スキーマ」節）。
-- どちらも user.id への外部キーに ON DELETE CASCADE を明示し、退会時の連動削除を保証する。
-- D1 は外部キー制約がデフォルト有効（無効化不可）のため、CASCADE はそのまま機能する。

-- 同期データ本体。ユーザーごとに 1 行（user_id が主キー）。
create table "app_state" (
  -- 主キー。user.id への外部キー（ON DELETE CASCADE。設計書指定）。
  "user_id" text not null primary key references "user" ("id") on delete cascade,
  -- SyncPayloadV1 形式の JSON 文字列（想定サイズ約 100KB、上限 512KB）。
  "payload" text not null,
  -- サーバー発行のリビジョン。保存成功ごとに +1（楽観ロックの競合判定に使用）。
  "revision" integer not null,
  -- サーバー時刻の更新日時（ISO 8601 文字列）。
  "updated_at" text not null,
  -- SyncPayloadV1 の formatVersion（入れ物のバージョン。内側データの schemaVersion とは別責務）。
  "payload_format_version" integer not null
);

-- /api/data PUT の固定ウィンドウレート制限カウンタ（30 回 / 5 分。設計書「乱用対策」節）。
create table "rate_limit" (
  -- 複合主キーの一部。user.id への外部キー（ON DELETE CASCADE。設計書指定）。
  "user_id" text not null references "user" ("id") on delete cascade,
  -- 複合主キーの一部。ウィンドウ開始時刻（UNIX タイムスタンプ・ミリ秒）。
  "window_start" integer not null,
  -- 当該ウィンドウ内のリクエストカウント。
  "count" integer not null,
  primary key ("user_id", "window_start")
);
