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
