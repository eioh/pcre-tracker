import type { CharacterProgress, MasterCharacter } from "../../domain/types";

export type ProgressPatch = Partial<
  Pick<
    CharacterProgress,
    | "owned"
    | "limitBreak"
    | "star"
    | "connectRank"
    | "ue1Level"
    | "ue1SpEquipped"
    | "ue2Level"
    | "adventureMemoryPieceTarget"
    | "ownedMemoryPiece"
    | "obtainedDate"
    | "gachaPullCount"
  >
>;

export type VisibleRow = {
  character: MasterCharacter;
  progress: CharacterProgress;
};

/**
 * モバイル編集シートに表示する保存ステータス。
 * ローカル保存（localStorage への debounce 書き込み）を一次情報とし、
 * ログイン時のみ同期の進行中/エラーを補助表示する。
 */
export type SaveStatus = "saving" | "saved" | "syncing" | "error";
