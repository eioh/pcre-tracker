import { z } from "zod";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "./levels";
import { MEMORY_PIECE_SOURCES } from "./types";

const ue1LevelValueSet = new Set<number>(UE1_LEVEL_VALUES);
const ue2LevelValueSet = new Set<number>(UE2_LEVEL_VALUES);

export const memoryPieceSourceSchema = z.enum(MEMORY_PIECE_SOURCES);

export const masterCharacterSchema = z.object({
  name: z.string().min(1),
  searchTokens: z.array(z.string().min(1)).optional(),
  limited: z.boolean(),
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
  ue1Level: z.union([z.null(), ue1LevelSchema]),
  ue1SpEquipped: z.boolean(),
  ue2Level: z.union([z.null(), ue2LevelSchema]),
  ownedMemoryPiece: z.number().int().min(0).default(0),
  updatedAt: z.string().datetime({ offset: true }),
});

export const storedStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  progressByName: z.record(characterProgressSchema),
});
