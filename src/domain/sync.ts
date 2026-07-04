import { z } from "zod";
import { connectRankCalcStateSchema, type ConnectRankCalcStateV1 } from "./connectRankCalcSchema";
import { storedStateV1Schema } from "./schemas";
import { CONNECT_RANK_CALC_STORAGE_KEY, STORAGE_KEY } from "./storageKeys";
import type { StoredStateV1 } from "./types";

// 同期ペイロード（`SyncPayloadV1`）の定義。
//
// 設計書「同期対象データの範囲」節の通り、同期対象は育成データ（STORAGE_KEY）と
// コネクトランク計算タブ（CONNECT_RANK_CALC_STORAGE_KEY）の 2 キーのみ。UI 状態は同期しない。
// これは `LocalStorageBackupV1`（3 キー全部入り・計算タブ optional）とは別物の形式であり、混同しないこと。
//
// このモジュールは Worker（DOM グローバル不在）とクライアントの双方から import されるため、
// `window` / `localStorage` に一切依存しない。

// 同期ペイロードのフォーマットバージョン（入れ物のバージョン。内側データの schemaVersion とは責務が別）。
export const SYNC_FORMAT_VERSION = 1 as const;

export type SyncPayloadV1 = {
  formatVersion: 1;
  storage: {
    [STORAGE_KEY]: StoredStateV1;
    [CONNECT_RANK_CALC_STORAGE_KEY]: ConnectRankCalcStateV1;
  };
};

// SyncPayloadV1 の Zod スキーマ。
//
// 設計書「入力検証」節の通り、`z.record(z.unknown())` のような浅い検証ではなく、
// `StoredStateV1` / `ConnectRankCalcStateV1` の内側スキーマまで深く検証する。
// 両キーとも object 必須（optional/null 不可）。キー欠落・null は検証エラー（サーバー側で 400）となる。
// なお `storedStateV1Schema` は一部フィールドに `.default(...)` を持つため、object でありさえすれば
// 欠落分は補完されるが、キー自体の欠落・null は下記の object 制約により拒否される。
export const syncPayloadV1Schema = z
  .object({
    formatVersion: z.literal(SYNC_FORMAT_VERSION),
    storage: z
      .object({
        // 育成データ: 深い検証（StoredStateV1 の内側スキーマまで）。null 不可・欠落不可。
        [STORAGE_KEY]: storedStateV1Schema,
        // 計算タブ: 深い検証（ConnectRankCalcStateV1）。null 不可・欠落不可。
        [CONNECT_RANK_CALC_STORAGE_KEY]: connectRankCalcStateSchema,
      })
      // storage 直下に想定外キーが混入していても拒否せず無視する（前方互換のため）。
      .strip(),
  })
  .strip();

// 同期ペイロードを検証して返す。検証失敗時は ZodError を投げる（呼び出し側で 400 応答へ変換する）。
export function parseSyncPayloadV1(value: unknown): SyncPayloadV1 {
  return syncPayloadV1Schema.parse(value) as SyncPayloadV1;
}
