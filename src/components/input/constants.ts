import type { Attribute, MemoryPieceSource, Role } from "../../domain/types";
import { characterTagBaseClass, sourceChipBaseClass } from "./uiStyles";

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

export const attributeChipClassMap: Record<Attribute, string> = {
  火: `${characterTagBaseClass} border-[#ff8d6cb3] bg-[#7a2f2254] text-[#ffba9f]`,
  水: `${characterTagBaseClass} border-[#69c6ffb3] bg-[#1d4f7354] text-[#a6e1ff]`,
  風: `${characterTagBaseClass} border-[#78e1aeb3] bg-[#245c4354] text-[#baf4d8]`,
  光: `${characterTagBaseClass} border-[#ffd776b3] bg-[#6f581f54] text-[#ffebac]`,
  闇: `${characterTagBaseClass} border-[#bfa0ffb3] bg-[#4a2f7254] text-[#dccbff]`,
};

export const roleChipClassMap: Record<Role, string> = {
  アタッカー: `${characterTagBaseClass} border-[#ff9b70b3] bg-[#7b372754] text-[#ffc5a7]`,
  ブレイカー: `${characterTagBaseClass} border-[#ffb76db3] bg-[#7d4a1f54] text-[#ffd7a3]`,
  バッファー: `${characterTagBaseClass} border-[#73d5ffb3] bg-[#1d557254] text-[#afe8ff]`,
  デバッファー: `${characterTagBaseClass} border-[#bd8dffb3] bg-[#4a2f7a54] text-[#dec7ff]`,
  ブースター: `${characterTagBaseClass} border-[#7be6c5b3] bg-[#235f4a54] text-[#bdf6e3]`,
  ヒーラー: `${characterTagBaseClass} border-[#9de07ab3] bg-[#3d642554] text-[#cff3b3]`,
  タンク: `${characterTagBaseClass} border-[#ff9ea2b3] bg-[#6c323754] text-[#ffc7ca]`,
  ジャマー: `${characterTagBaseClass} border-[#8fa3ffb3] bg-[#2f3f7954] text-[#c7d1ff]`,
};
