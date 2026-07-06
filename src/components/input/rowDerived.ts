import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import { getConnectRankRemainingMemoryPieceCount } from "../../utils/connectRankMemoryCost";
import { getLimitBreakRemainingMemoryPieceCount } from "../../utils/limitBreakMemoryCost";
import { getStarRemainingMemoryPieceCount, type StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { getUe1RemainingMemoryPieceCount, type Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";

// コネクトRANKの最大値。
const CONNECT_RANK_MAX = 15;

export type RowDerivedOptions = {
  includeSameBasePurePieceForUe2: boolean;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
};

export type RowDerived = {
  /** ピュアピ入力が意味を持つ（☆6 か専用2が実装済み）か */
  isPurePieceImplemented: boolean;
  /** ☆の最大値（☆6実装済みなら 6、未実装なら 5） */
  starMax: 5 | 6;
  /** ☆が最大か */
  isStarAtMax: boolean;
  /** コネクトRANKが最大か */
  isConnectRankAtMax: boolean;
  /** 専用1が最大強化済みか（SP実装キャラはSP装備で最大扱い） */
  isUe1AtMax: boolean;
  /** 専用2が最大強化済みか */
  isUe2AtMax: boolean;
  /** 専用1セレクトの表示値（SP装備中は "sp"、未実装は "null"） */
  ue1CompositeValue: string;
  /** 専用2セレクトの表示値（未実装は "null"） */
  ue2Value: string;
  /** ☆強化に必要な残りメモピ数 */
  starRemainingMemoryPiece: number;
  /** コネクトRANK強化に必要な残りメモピ数 */
  connectRankRemainingMemoryPiece: number;
  /** 専用1強化に必要な残りメモピ数 */
  ue1RemainingMemoryPiece: number;
  /** 限界突破に必要な残りメモピ数 */
  limitBreakRemainingMemoryPiece: number;
  /** 必要メモピの単純合計（所持分の控除前） */
  totalRemainingMemoryPiece: number;
  /** 所持メモピを差し引いた必要メモピ合計（下限0） */
  adjustedTotalRemainingMemoryPiece: number;
  /** ☆6強化に必要なピュアピ数（所持分の控除前） */
  star6PurePieceNeed: number;
  /** 専用2強化に必要なピュアピ数（所持分の控除前） */
  ue2PurePieceNeed: number;
  /** 専用2計算に充当する同名別衣装の所持ピュアピ数 */
  sameBasePurePieceUsed: number;
  /** ☆6分の必要ピュアピ小計（下限0） */
  star6PurePieceSubtotal: number;
  /** 専用2分の必要ピュアピ小計（下限0） */
  ue2PurePieceSubtotal: number;
  /** 必要ピュアピ合計 */
  totalPurePieceNeeded: number;
};

// 育成入力1行分の派生値（必要メモピ・ピュアピの内訳、最大強化判定、セレクト表示値）を計算する純関数。
// テーブル行とモバイル編集シートの両方から同じ計算結果を参照するために抽出している。
export function computeRowDerived(
  character: MasterCharacter,
  progress: CharacterProgress,
  ownedPurePiece: number,
  ownedPurePieceByBase: number,
  options: RowDerivedOptions,
): RowDerived {
  const { includeSameBasePurePieceForUe2, starMemoryCalcMode, ue1MemoryCalcMode } = options;
  const ue1Value = character.implemented.ue1 ? String(progress.ue1Level ?? 0) : "null";
  const ue2Value = character.implemented.ue2 ? String(progress.ue2Level ?? 0) : "null";
  const isPurePieceImplemented = character.implemented.star6 || character.implemented.ue2;
  const starMax = character.implemented.star6 ? 6 : 5;
  const ue1MaxLevel = UE1_LEVEL_VALUES[UE1_LEVEL_VALUES.length - 1];
  const ue2MaxLevel = UE2_LEVEL_VALUES[UE2_LEVEL_VALUES.length - 1];
  const isStarAtMax = progress.star === starMax;
  const isConnectRankAtMax = progress.connectRank === CONNECT_RANK_MAX;
  const isUe1AtMax =
    character.implemented.ue1 &&
    (character.implemented.ue1Sp ? progress.ue1SpEquipped : progress.ue1Level === ue1MaxLevel);
  const isUe2AtMax = character.implemented.ue2 && progress.ue2Level === ue2MaxLevel;
  const ue1CompositeValue =
    character.implemented.ue1 && character.implemented.ue1Sp && progress.ue1SpEquipped ? "sp" : ue1Value;
  const starRemainingMemoryPiece = getStarRemainingMemoryPieceCount(character, progress, starMemoryCalcMode);
  const connectRankRemainingMemoryPiece = getConnectRankRemainingMemoryPieceCount(progress);
  const ue1RemainingMemoryPiece = getUe1RemainingMemoryPieceCount(character, progress, ue1MemoryCalcMode);
  const limitBreakRemainingMemoryPiece = getLimitBreakRemainingMemoryPieceCount(character, progress);
  const totalRemainingMemoryPiece =
    starRemainingMemoryPiece + connectRankRemainingMemoryPiece + ue1RemainingMemoryPiece + limitBreakRemainingMemoryPiece;
  const adjustedTotalRemainingMemoryPiece = Math.max(0, totalRemainingMemoryPiece - progress.ownedMemoryPiece);
  const star6PurePieceNeed = character.implemented.star6 && progress.star < 6 ? 50 : 0;
  const ue2PurePieceNeed = character.implemented.ue2 && progress.ue2Level !== ue2MaxLevel ? 150 : 0;
  const sameBasePurePieceUsed =
    includeSameBasePurePieceForUe2 && character.implemented.ue2 ? Math.max(0, ownedPurePieceByBase - ownedPurePiece) : 0;
  const star6PurePieceSubtotal = Math.max(0, star6PurePieceNeed - ownedPurePiece);
  const ue2PurePieceSubtotal = Math.max(0, ue2PurePieceNeed - (ownedPurePiece + sameBasePurePieceUsed));
  const totalPurePieceNeeded = star6PurePieceSubtotal + ue2PurePieceSubtotal;

  return {
    isPurePieceImplemented,
    starMax,
    isStarAtMax,
    isConnectRankAtMax,
    isUe1AtMax,
    isUe2AtMax,
    ue1CompositeValue,
    ue2Value,
    starRemainingMemoryPiece,
    connectRankRemainingMemoryPiece,
    ue1RemainingMemoryPiece,
    limitBreakRemainingMemoryPiece,
    totalRemainingMemoryPiece,
    adjustedTotalRemainingMemoryPiece,
    star6PurePieceNeed,
    ue2PurePieceNeed,
    sameBasePurePieceUsed,
    star6PurePieceSubtotal,
    ue2PurePieceSubtotal,
    totalPurePieceNeeded,
  };
}
