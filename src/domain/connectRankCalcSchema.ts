import { z } from "zod";

// コネクトランク計算タブのデータ型と Zod スキーマを DOM 非依存モジュールとして切り出す。
//
// 元の `connectRankCalcStorage.ts` は `window` / `localStorage` を参照するため Worker から
// 直接 import できない。同期ペイロード（`SyncPayloadV1`）の深い検証で計算タブスキーマが必要になるため、
// 型・スキーマ・初期状態生成のみをこの DOM 非依存モジュールへ集約し、
// `connectRankCalcStorage.ts` はここから re-export して後方互換を保つ。

// 計算タブの 1 エントリ（対象キャラと目標ランク）。
export type ConnectRankCalcEntry = {
  characterName: string;
  targetRank: number;
};

// 計算タブ状態のスキーマバージョン 1。
export type ConnectRankCalcStateV1 = {
  schemaVersion: 1;
  entries: ConnectRankCalcEntry[];
};

// 計算タブの 1 エントリを検証する Zod スキーマ。
export const connectRankCalcEntrySchema = z.object({
  characterName: z.string(),
  targetRank: z.number().int().min(1).max(15),
});

// 計算タブ状態全体を検証する Zod スキーマ。
export const connectRankCalcStateSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(connectRankCalcEntrySchema),
});

// 計算タブの初期状態（空のエントリ配列）を返す。
export function buildDefaultConnectRankCalcState(): ConnectRankCalcStateV1 {
  return { schemaVersion: 1, entries: [] };
}
