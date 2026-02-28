import { characterProgressSchema } from "./schemas";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "./levels";
import type { CharacterProgress, MasterCharacter, StoredStateV1 } from "./types";

export const STORAGE_KEY = "pcr_growth_tracker";
export const CURRENT_SCHEMA_VERSION = 1 as const;

type MigratedStoredState = {
  schemaVersion: 1;
  updatedAt: unknown;
  progressByName: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createDefaultProgress(character: MasterCharacter): CharacterProgress {
  return {
    owned: false,
    limitBreak: false,
    star: 1,
    connectRank: 1,
    ue1Level: character.implemented.ue1 ? 0 : null,
    ue1SpEquipped: false,
    ue2Level: character.implemented.ue2 ? 0 : null,
    ownedMemoryPiece: 0,
    obtainedDate: null,
    gachaPullCount: 0,
  };
}

// 保存データ全体の最終更新日時を正規化する。
function toStateUpdatedAt(value: unknown): string {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

// コネクトRANK入力値を1〜15の整数へ正規化する。
function toConnectRank(value: number): CharacterProgress["connectRank"] {
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }
  if (value > 15) {
    return 15;
  }
  return value as CharacterProgress["connectRank"];
}

function toStar(value: number, isStar6Implemented: boolean): CharacterProgress["star"] {
  const maxStar = isStar6Implemented ? 6 : 5;
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }
  if (value > maxStar) {
    return maxStar as CharacterProgress["star"];
  }
  return value as CharacterProgress["star"];
}

function toUe1Level(value: number | null): CharacterProgress["ue1Level"] {
  if (value === null) {
    return null;
  }
  return UE1_LEVEL_VALUES.includes(value as (typeof UE1_LEVEL_VALUES)[number])
    ? (value as (typeof UE1_LEVEL_VALUES)[number])
    : 0;
}

function toUe2Level(value: number | null): CharacterProgress["ue2Level"] {
  if (value === null) {
    return null;
  }
  return UE2_LEVEL_VALUES.includes(value as (typeof UE2_LEVEL_VALUES)[number])
    ? (value as (typeof UE2_LEVEL_VALUES)[number])
    : 0;
}

// 所持メモピ入力値を0以上の整数へ正規化する。
function toOwnedMemoryPiece(value: number): CharacterProgress["ownedMemoryPiece"] {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

// 入手日文字列を YYYY-MM-DD 形式へ正規化する。
function toObtainedDate(value: unknown): CharacterProgress["obtainedDate"] {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/\//g, "-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}

// ガチャ回数入力値を 0〜300 の整数へ正規化する。
function toGachaPullCount(value: number): CharacterProgress["gachaPullCount"] {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(300, Math.max(0, Math.floor(value)));
}

function sanitizeProgress(character: MasterCharacter, rawProgress: unknown): CharacterProgress {
  const defaultProgress = createDefaultProgress(character);
  const normalizedRawProgress =
    isRecord(rawProgress) && "rank" in rawProgress && !("star" in rawProgress)
      ? { ...rawProgress, star: rawProgress.rank }
      : rawProgress;
  const parsed = characterProgressSchema.safeParse(normalizedRawProgress);
  if (!parsed.success) {
    return defaultProgress;
  }

  const normalized: CharacterProgress = {
    owned: parsed.data.owned,
    limitBreak: parsed.data.limitBreak,
    star: toStar(parsed.data.star, character.implemented.star6),
    connectRank: toConnectRank(parsed.data.connectRank),
    ue1Level: toUe1Level(parsed.data.ue1Level),
    ue1SpEquipped: parsed.data.ue1SpEquipped,
    ue2Level: toUe2Level(parsed.data.ue2Level),
    ownedMemoryPiece: toOwnedMemoryPiece(parsed.data.ownedMemoryPiece),
    obtainedDate: toObtainedDate(parsed.data.obtainedDate),
    gachaPullCount: toGachaPullCount(parsed.data.gachaPullCount),
  };

  // 旧データや不整合データでも「未実装項目は null に固定」するための補正。
  if (!character.implemented.ue1) {
    normalized.ue1Level = null;
  } else if (normalized.ue1Level === null) {
    normalized.ue1Level = 0;
  }

  // 専用2も同様に未実装と入力可能値の境界をここで統一する。
  if (!character.implemented.ue2) {
    normalized.ue2Level = null;
  } else if (normalized.ue2Level === null) {
    normalized.ue2Level = 0;
  }

  if (!character.implemented.ue1Sp) {
    normalized.ue1SpEquipped = false;
  }
  // 専用1SPは専用1Lv370到達時のみ有効とする。
  if (normalized.ue1SpEquipped && normalized.ue1Level !== 370) {
    normalized.ue1SpEquipped = false;
  }

  return normalized;
}

function migrateToLatestState(raw: unknown): MigratedStoredState | null {
  if (!isRecord(raw)) {
    return null;
  }

  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION && isRecord(raw.progressByName)) {
    return {
      schemaVersion: 1,
      updatedAt: raw.updatedAt,
      progressByName: raw.progressByName,
    };
  }

  if (isRecord(raw.progressByName)) {
    return {
      schemaVersion: 1,
      updatedAt: raw.updatedAt,
      progressByName: raw.progressByName,
    };
  }

  return null;
}

function reconcileWithMaster(
  masterCharacters: MasterCharacter[],
  migratedState: MigratedStoredState | null,
): StoredStateV1 {
  const progressByName: StoredStateV1["progressByName"] = {};

  for (const character of masterCharacters) {
    const rawProgress = migratedState?.progressByName[character.name];
    progressByName[character.name] = sanitizeProgress(character, rawProgress);
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: toStateUpdatedAt(migratedState?.updatedAt),
    progressByName,
  };
}

export function buildInitialState(masterCharacters: MasterCharacter[]): StoredStateV1 {
  return reconcileWithMaster(masterCharacters, null);
}

export function loadStoredState(masterCharacters: MasterCharacter[]): StoredStateV1 {
  if (typeof window === "undefined") {
    return buildInitialState(masterCharacters);
  }

  const rawText = window.localStorage.getItem(STORAGE_KEY);
  if (!rawText) {
    return buildInitialState(masterCharacters);
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;
    const migrated = migrateToLatestState(parsed);
    return reconcileWithMaster(masterCharacters, migrated);
  } catch {
    return buildInitialState(masterCharacters);
  }
}

export function saveStoredState(state: StoredStateV1): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
