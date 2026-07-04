// キー定数・型・スキーマ・初期状態生成は DOM 非依存モジュールへ切り出した（Worker から参照するため）。
// 既存のブラウザ側 import 経路を壊さないよう、ここから re-export して後方互換を保つ。
export { CONNECT_RANK_CALC_STORAGE_KEY } from "./storageKeys";
export {
  buildDefaultConnectRankCalcState,
  connectRankCalcEntrySchema,
  connectRankCalcStateSchema,
  type ConnectRankCalcEntry,
  type ConnectRankCalcStateV1,
} from "./connectRankCalcSchema";

import { CONNECT_RANK_CALC_STORAGE_KEY } from "./storageKeys";
import {
  buildDefaultConnectRankCalcState,
  connectRankCalcStateSchema,
  type ConnectRankCalcStateV1,
} from "./connectRankCalcSchema";

// 保存文字列を解析し、現在仕様の計算タブ状態へ正規化する。
export function parseConnectRankCalcState(rawText: string): ConnectRankCalcStateV1 {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    const result = connectRankCalcStateSchema.safeParse(parsed);
    if (!result.success) {
      return buildDefaultConnectRankCalcState();
    }
    return result.data;
  } catch {
    return buildDefaultConnectRankCalcState();
  }
}

// localStorageからコネクトランク計算タブの状態を読み込む。
export function loadConnectRankCalcState(): ConnectRankCalcStateV1 {
  if (typeof window === "undefined") {
    return buildDefaultConnectRankCalcState();
  }

  const rawText = window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY);
  if (!rawText) {
    return buildDefaultConnectRankCalcState();
  }
  return parseConnectRankCalcState(rawText);
}

// コネクトランク計算タブの状態をlocalStorageへ保存する。
export function saveConnectRankCalcState(state: ConnectRankCalcStateV1): void {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(state);
  try {
    window.localStorage.setItem(CONNECT_RANK_CALC_STORAGE_KEY, serialized);
  } catch (error) {
    console.warn(`コネクトランク計算データの保存に失敗しました: key=${CONNECT_RANK_CALC_STORAGE_KEY}`, { error, serialized });
  }
}
