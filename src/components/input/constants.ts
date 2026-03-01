import type { Attribute, MemoryPieceSource, Role } from "../../domain/types";
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
  dungeon_coin: `${sourceChipBaseClass} border-chip-dungeon-border bg-chip-dungeon-bg text-chip-dungeon-text`,
  arena_coin: `${sourceChipBaseClass} border-chip-arena-border bg-chip-arena-bg text-chip-arena-text`,
  p_arena_coin: `${sourceChipBaseClass} border-chip-p-arena-border bg-chip-p-arena-bg text-chip-p-arena-text`,
  clan_coin: `${sourceChipBaseClass} border-chip-clan-border bg-chip-clan-bg text-chip-clan-text`,
  master_coin: `${sourceChipBaseClass} border-chip-master-border bg-chip-master-bg text-chip-master-text`,
  hard_quest: `${sourceChipBaseClass} border-chip-hard-border bg-chip-hard-bg text-chip-hard-text`,
  side_story: `${sourceChipBaseClass} border-chip-side-border bg-chip-side-bg text-chip-side-text`,
};

export const attributeTextClassMap: Record<Attribute, string> = {
  火: "text-attr-fire",
  水: "text-attr-water",
  風: "text-attr-wind",
  光: "text-attr-light",
  闇: "text-attr-dark",
};

export const roleTextClassMap: Record<Role, string> = {
  アタッカー: "text-role-attacker",
  ブレイカー: "text-role-breaker",
  バッファー: "text-role-buffer",
  デバッファー: "text-role-debuffer",
  ブースター: "text-role-booster",
  ヒーラー: "text-role-healer",
  タンク: "text-role-tank",
  ジャマー: "text-role-jammer",
};
