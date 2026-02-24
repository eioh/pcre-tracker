import type { CharacterProgress, MasterCharacter } from "../../domain/types";

export type ProgressPatch = Partial<
  Pick<
    CharacterProgress,
    "owned" | "limitBreak" | "star" | "connectRank" | "ue1Level" | "ue1SpEquipped" | "ue2Level" | "ownedMemoryPiece"
  >
>;

export type VisibleRow = {
  character: MasterCharacter;
  progress: CharacterProgress;
};
