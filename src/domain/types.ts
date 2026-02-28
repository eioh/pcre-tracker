import type { Ue1Level, Ue2Level } from "./levels";

export const MEMORY_PIECE_SOURCES = [
  "dungeon_coin",
  "arena_coin",
  "p_arena_coin",
  "clan_coin",
  "master_coin",
  "hard_quest",
  "side_story",
] as const;

export type MemoryPieceSource = (typeof MEMORY_PIECE_SOURCES)[number];
export const ATTRIBUTE_VALUES = ["火", "水", "風", "光", "闇"] as const;
export type Attribute = (typeof ATTRIBUTE_VALUES)[number];

export const ROLE_VALUES = [
  "アタッカー",
  "ブレイカー",
  "バッファー",
  "デバッファー",
  "ブースター",
  "ヒーラー",
  "タンク",
  "ジャマー",
] as const;
export type Role = (typeof ROLE_VALUES)[number];

export type MasterCharacter = {
  name: string;
  searchTokens?: string[];
  limited: boolean;
  attribute: Attribute;
  role: Role;
  implemented: {
    star6: boolean;
    ue1: boolean;
    ue1Sp: boolean;
    ue2: boolean;
  };
  memoryPieceSources: MemoryPieceSource[];
};

export type CharacterProgress = {
  owned: boolean;
  limitBreak: boolean;
  star: 1 | 2 | 3 | 4 | 5 | 6;
  connectRank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  ue1Level: Ue1Level;
  ue1SpEquipped: boolean;
  ue2Level: Ue2Level;
  ownedMemoryPiece: number;
  obtainedDate: string | null;
  gachaPullCount: number;
};

export type StoredStateV1 = {
  schemaVersion: 1;
  updatedAt: string;
  progressByName: Record<string, CharacterProgress>;
};

export type AppState = StoredStateV1;
