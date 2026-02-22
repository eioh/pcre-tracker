import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve(process.cwd(), "character_data.json");
const targetPath = resolve(process.cwd(), "src/data/characterMaster.json");

const sourceKeyMap = [
  ["available_memory_piece_dungeon_coin", "dungeon_coin"],
  ["available_memory_piece_arena_coin", "arena_coin"],
  ["available_memory_piece_p_arena_coin", "p_arena_coin"],
  ["available_memory_piece_clan_coin", "clan_coin"],
  ["available_memory_piece_master_coin", "master_coin"],
  ["available_memory_piece_hard_quest", "hard_quest"],
  ["available_memory_piece_side_story", "side_story"],
];

const raw = readFileSync(sourcePath, "utf8");
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) {
  throw new Error("character_data.json は配列である必要があります。");
}

const seenNames = new Set();

const converted = parsed.map((entry) => {
  if (typeof entry.character_name !== "string" || entry.character_name.length === 0) {
    throw new Error("character_name が不正なデータを検出しました。");
  }
  if (seenNames.has(entry.character_name)) {
    throw new Error(`重複した character_name を検出しました: ${entry.character_name}`);
  }
  seenNames.add(entry.character_name);

  const memoryPieceSources = sourceKeyMap
    .filter(([sourceKey]) => entry[sourceKey] === "○")
    .map(([, sourceValue]) => sourceValue);

  return {
    name: entry.character_name,
    limited: Boolean(entry.is_limited_character),
    implemented: {
      star6: Boolean(entry.is_implemented_star6),
      ue1: Boolean(entry.is_implemented_unique_equip1),
      ue1Sp: Boolean(entry.is_implemented_unique_equip1SP),
      ue2: Boolean(entry.is_implemented_unique_equip2),
    },
    memoryPieceSources,
  };
});

writeFileSync(targetPath, `${JSON.stringify(converted, null, 2)}\n`, "utf8");

console.log(`converted: ${converted.length} -> ${targetPath}`);
