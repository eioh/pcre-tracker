// localStorage キー定数を DOM 非依存モジュールとして集約する。
//
// これらのキーは Worker 側（`src/domain/sync.ts` 等）からも参照する必要があるが、
// 従来の定義元である `storage.ts` / `connectRankCalcStorage.ts` は `window` / `localStorage` を
// 参照する処理を含むため、Worker（miniflare 実行環境。DOM グローバルが存在しない）から
// 直接 import できない。そこでキー定数のみをこの DOM 非依存モジュールへ切り出し、
// 既存のブラウザ側コードは各元ファイルから re-export して後方互換を保つ。

// 育成データ（メインの保存キー）。
export const STORAGE_KEY = "pcr_growth_tracker";

// コネクトランク計算タブの保存キー。
export const CONNECT_RANK_CALC_STORAGE_KEY = "pcr_growth_tracker_connect_rank_calc";

// ユーザーが初めて編集操作を行ったことを示すフラグの保存キー。
// 「ローカルに実データあり」判定の一次判定に使う（設計書「初回ログイン時のデータ引き継ぎ」節）。
// 端末ローカルの判定専用データであり、同期対象（SyncPayloadV1）にもバックアップ対象（LocalStorageBackupV1）にも含めない。
export const TOUCHED_STORAGE_KEY = "pcr_growth_tracker_touched";

// 同期メタ情報（サーバー revision・ローカル変更カウンタ等）の保存キー。
// touched フラグと同様に端末ローカル専用であり、同期対象・バックアップ対象外。
export const SYNC_META_STORAGE_KEY = "pcr_growth_tracker_sync";
