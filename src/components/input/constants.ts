import type { MemoryPieceSource } from "../../domain/types";
import { sourceChipBaseClass } from "./uiStyles";

export const memorySourceLabelMap: Record<MemoryPieceSource, string> = {
  dungeon_coin: "ダンジョン",
  arena_coin: "アリーナ",
  p_arena_coin: "プリーナ",
  clan_coin: "クラン",
  master_coin: "マスター",
  hard_quest: "ハード",
  side_story: "サイド",
};

export const sourceChipClassMap: Record<MemoryPieceSource, string> = {
  dungeon_coin: `${sourceChipBaseClass} border-[#56c6ff99] bg-[#145c7e52] text-[#8fe6ff]`,
  arena_coin: `${sourceChipBaseClass} border-[#ff9966a6] bg-[#823f2257] text-[#ffc58c]`,
  p_arena_coin: `${sourceChipBaseClass} border-[#ba79ffa6] bg-[#522a7e5c] text-[#d9b0ff]`,
  clan_coin: `${sourceChipBaseClass} border-[#ff6b7aa6] bg-[#7c223857] text-[#ff9ea4]`,
  master_coin: `${sourceChipBaseClass} border-[#ffd455b3] bg-[#7e5a155c] text-[#ffe291]`,
  hard_quest: `${sourceChipBaseClass} border-[#ff8150a6] bg-[#82341c57] text-[#ffad7c]`,
  side_story: `${sourceChipBaseClass} border-[#5bdba4a6] bg-[#1c674957] text-[#9df0cb]`,
};
