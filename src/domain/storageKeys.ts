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

// UI 設定（表示中のタブ・入力画面の絞り込み等）の保存キー。
// 定義元は従来 `uiStorage.ts` だったが、端末データの一括削除（`deviceData.ts`）から循環参照なしに
// 参照できるようここへ移し、`uiStorage.ts` からは re-export する。
export const UI_STORAGE_KEY = "pcr_growth_tracker_ui";

// この端末のデータ（育成・計算タブ・UI 設定・touched・同期メタ）を、どのアカウントで使っているかを表すキー。
// 値は `{ userId }` の JSON。ログアウトしても残し、別のアカウントでログインしたときの確認に使う。
// 端末ローカル専用であり、同期対象・バックアップ対象外。
export const LOCAL_DATA_OWNER_STORAGE_KEY = "pcr_growth_tracker_owner";

// 端末データの世代（epoch）を表すキー。端末データの削除や所有者の変更のたびに新しい値へ更新する。
// 各タブは起動時の値を控え、値が変わっていたら（＝別のタブで削除・所有者変更が起きたら）端末データへ書き込まない。
// 端末データの削除対象には含めない。同期対象・バックアップ対象外。
export const DEVICE_DATA_EPOCH_STORAGE_KEY = "pcr_growth_tracker_device_epoch";
