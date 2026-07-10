import { z } from "zod";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "./levels";
import { ATTRIBUTE_VALUES, MEMORY_PIECE_SOURCES, ROLE_VALUES } from "./types";

const ue1LevelValueSet = new Set<number>(UE1_LEVEL_VALUES);
const ue2LevelValueSet = new Set<number>(UE2_LEVEL_VALUES);

export const memoryPieceSourceSchema = z.enum(MEMORY_PIECE_SOURCES);
export const attributeSchema = z.enum(ATTRIBUTE_VALUES);
export const roleSchema = z.enum(ROLE_VALUES);

export const masterCharacterSchema = z.object({
  name: z.string().min(1),
  baseName: z.string().min(1),
  searchTokens: z.array(z.string().min(1)).optional(),
  formationOrder: z.number().int().min(0),
  limited: z.boolean(),
  attribute: attributeSchema,
  role: roleSchema,
  implemented: z.object({
    star6: z.boolean(),
    ue1: z.boolean(),
    ue1Sp: z.boolean(),
    ue2: z.boolean(),
  }),
  memoryPieceSources: z.array(memoryPieceSourceSchema),
});

export const masterCharacterListSchema = z.array(masterCharacterSchema);

export const ue1LevelSchema = z
  .number()
  .int()
  .refine((value) => ue1LevelValueSet.has(value), "専用1の許容値ではありません");

export const ue2LevelSchema = z
  .number()
  .int()
  .refine((value) => ue2LevelValueSet.has(value), "専用2の許容値ではありません");

export const characterProgressSchema = z.object({
  owned: z.boolean(),
  limitBreak: z.boolean().default(false),
  star: z.number().int().min(1).max(6).default(1),
  connectRank: z.number().int().min(0).max(15).default(0),
  ue1Level: z.union([z.null(), ue1LevelSchema]),
  ue1SpEquipped: z.boolean(),
  ue2Level: z.union([z.null(), ue2LevelSchema]),
  adventureMemoryPieceTarget: z.boolean().default(false),
  ownedMemoryPiece: z.number().int().min(0).default(0),
  obtainedDate: z.union([z.null(), z.string()]).default(null),
  gachaPullCount: z.number().finite().default(0),
});

export const clanBattleMemberSchema = z.object({
  id: z.string().min(1),
  characterName: z.string().min(1),
  support: z.boolean().default(false),
  limitBreak: z.boolean().default(false),
  star: z.number().int().min(1).max(6).default(1),
  connectRank: z.number().int().min(0).max(15).default(0),
  ue1Level: z.union([z.null(), ue1LevelSchema]),
  ue1SpEquipped: z.boolean().default(false),
  ue2Level: z.union([z.null(), ue2LevelSchema]),
});

export const clanBattleFormationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).default("新しい編成"),
  damage: z.number().finite().default(0),
  timeline: z.string().default(""),
  members: z.array(clanBattleMemberSchema).default([]),
});

export const clanBattleMonthGroupSchema = z.object({
  id: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  formations: z.array(clanBattleFormationSchema).default([]),
});

export const clanBattleStateSchema = z.object({
  groups: z.array(clanBattleMonthGroupSchema).default([]),
});

export const storedStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime({ offset: true }),
  progressByName: z.record(characterProgressSchema),
  purePieceByCharacterName: z.record(z.number().int().min(0)).default({}),
  purePieceByBaseName: z.record(z.number().int().min(0)).default({}),
  clanBattle: clanBattleStateSchema.default({ groups: [] }),
});
