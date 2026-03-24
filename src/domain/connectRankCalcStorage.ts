import { z } from "zod";

export const CONNECT_RANK_CALC_STORAGE_KEY = "pcr_growth_tracker_connect_rank_calc";

export type ConnectRankCalcEntry = {
  characterName: string;
  targetRank: number;
};

export type ConnectRankCalcStateV1 = {
  schemaVersion: 1;
  entries: ConnectRankCalcEntry[];
};

const connectRankCalcEntrySchema = z.object({
  characterName: z.string(),
  targetRank: z.number().int().min(1).max(15),
});

const connectRankCalcStateSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(connectRankCalcEntrySchema),
});

// 初期状態を返す。
export function buildDefaultConnectRankCalcState(): ConnectRankCalcStateV1 {
  return { schemaVersion: 1, entries: [] };
}

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
