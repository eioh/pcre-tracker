import { z } from "zod";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "./levels";
import { MEMORY_PIECE_SOURCES, type MemoryPieceSource } from "./types";
import type { StarMemoryCalcMode } from "../utils/starMemoryCost";
import type { Ue1HeartFragmentCalcMode } from "../utils/ue1HeartFragmentCost";
import type { Ue1MemoryCalcMode } from "../utils/ue1MemoryCost";

export const UI_STORAGE_KEY = "pcr_growth_tracker_ui";
export const CURRENT_UI_SCHEMA_VERSION = 1 as const;

export type ActiveTab = "input" | "dashboard";
export type OwnedFilter = "all" | "owned" | "unowned";
export type LimitedFilter = "all" | "limited" | "normal";
export type LimitBreakFilter = "all" | "on" | "off";
export type StarFilter = 1 | 2 | 3 | 4 | 5 | 6;
export type Ue1Filter = "unimplemented" | "sp" | (typeof UE1_LEVEL_VALUES)[number];
export type Ue2Filter = "unimplemented" | (typeof UE2_LEVEL_VALUES)[number];
export type MemorySourceFilter = "none" | MemoryPieceSource;
export type SortKey =
  | "owned"
  | "name"
  | "limited"
  | "limitBreak"
  | "star"
  | "connectRank"
  | "ue1"
  | "ue2"
  | "ownedMemoryPiece"
  | "obtainedDate"
  | "gachaPullCount"
  | "ue1HeartFragmentNeeded"
  | "totalMemoryNeeded";
export type SortDirection = "asc" | "desc" | null;

export type InputViewSettings = {
  searchText: string;
  ownedFilter: OwnedFilter;
  limitedFilter: LimitedFilter;
  limitBreakFilter: LimitBreakFilter;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  ue1HeartFragmentCalcMode: Ue1HeartFragmentCalcMode;
  starFilters: StarFilter[];
  ue1Filters: Ue1Filter[];
  ue2Filters: Ue2Filter[];
  memorySourceFilters: MemorySourceFilter[];
  sortKey: SortKey;
  sortDirection: SortDirection;
};

export type UiStateV1 = {
  schemaVersion: 1;
  activeTab: ActiveTab;
  input: InputViewSettings;
};

const ACTIVE_TAB_VALUES: ActiveTab[] = ["input", "dashboard"];
const OWNED_FILTER_VALUES: OwnedFilter[] = ["all", "owned", "unowned"];
const LIMITED_FILTER_VALUES: LimitedFilter[] = ["all", "limited", "normal"];
const LIMIT_BREAK_FILTER_VALUES: LimitBreakFilter[] = ["all", "on", "off"];
const STAR_MEMORY_CALC_MODE_VALUES: StarMemoryCalcMode[] = ["implemented_max", "star6_max"];
const UE1_MEMORY_CALC_MODE_VALUES: Ue1MemoryCalcMode[] = ["implemented_max", "sp_max"];
const UE1_HEART_FRAGMENT_CALC_MODE_VALUES: Ue1HeartFragmentCalcMode[] = ["implemented_max", "all_max"];
const SORT_KEY_VALUES: SortKey[] = [
  "owned",
  "name",
  "limited",
  "limitBreak",
  "star",
  "connectRank",
  "ue1",
  "ue2",
  "ownedMemoryPiece",
  "obtainedDate",
  "gachaPullCount",
  "ue1HeartFragmentNeeded",
  "totalMemoryNeeded",
];
const SORT_DIRECTION_VALUES: Array<Exclude<SortDirection, null>> = ["asc", "desc"];
const STAR_VALUES: StarFilter[] = [1, 2, 3, 4, 5, 6];

const allowedUe1FilterSet = new Set<Ue1Filter>(["unimplemented", "sp", ...UE1_LEVEL_VALUES]);
const allowedUe2FilterSet = new Set<Ue2Filter>(["unimplemented", ...UE2_LEVEL_VALUES]);
const allowedMemorySourceFilterSet = new Set<MemorySourceFilter>(["none", ...MEMORY_PIECE_SOURCES]);

const defaultInputViewSettings: InputViewSettings = {
  searchText: "",
  ownedFilter: "all",
  limitedFilter: "all",
  limitBreakFilter: "all",
  starMemoryCalcMode: "implemented_max",
  ue1MemoryCalcMode: "implemented_max",
  ue1HeartFragmentCalcMode: "implemented_max",
  starFilters: [],
  ue1Filters: [],
  ue2Filters: [],
  memorySourceFilters: [],
  sortKey: "name",
  sortDirection: null,
};

const looseInputSettingsSchema = z
  .object({
    searchText: z.unknown().optional(),
    ownedFilter: z.unknown().optional(),
    limitedFilter: z.unknown().optional(),
    limitBreakFilter: z.unknown().optional(),
    starMemoryCalcMode: z.unknown().optional(),
    ue1MemoryCalcMode: z.unknown().optional(),
    ue1HeartFragmentCalcMode: z.unknown().optional(),
    starFilters: z.array(z.unknown()).optional(),
    ue1Filters: z.array(z.unknown()).optional(),
    ue2Filters: z.array(z.unknown()).optional(),
    memorySourceFilters: z.array(z.unknown()).optional(),
    sortKey: z.unknown().optional(),
    sortDirection: z.unknown().optional(),
  })
  .passthrough();

const looseUiStateSchema = z
  .object({
    schemaVersion: z.number().optional(),
    activeTab: z.unknown().optional(),
    input: z.unknown().optional(),
  })
  .passthrough();

// UI設定の既定値を返す。
export function buildDefaultInputViewSettings(): InputViewSettings {
  return {
    ...defaultInputViewSettings,
    starFilters: [],
    ue1Filters: [],
    ue2Filters: [],
    memorySourceFilters: [],
  };
}

// UI状態の既定値を返す。
export function buildDefaultUiState(): UiStateV1 {
  return {
    schemaVersion: CURRENT_UI_SCHEMA_VERSION,
    activeTab: "input",
    input: buildDefaultInputViewSettings(),
  };
}

// 値が候補に含まれる場合のみ採用し、そうでなければ既定値を返す。
function normalizeEnumValue<T extends string | number | null>(value: unknown, allowedValues: readonly T[], fallback: T): T {
  return allowedValues.includes(value as T) ? (value as T) : fallback;
}

// 配列を候補集合で検証しつつ重複除去して返す。
function normalizeArrayWithSet<T extends string | number>(value: unknown, allowedSet: Set<T>): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: T[] = [];
  for (const item of value) {
    if (allowedSet.has(item as T) && !normalized.includes(item as T)) {
      normalized.push(item as T);
    }
  }
  return normalized;
}

// 緩い入力オブジェクトからUI設定を安全な形式へ正規化する。
function normalizeInputSettings(rawInput: unknown): InputViewSettings {
  const parsedInput = looseInputSettingsSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return buildDefaultInputViewSettings();
  }

  const raw = parsedInput.data;
  return {
    searchText: typeof raw.searchText === "string" ? raw.searchText : "",
    ownedFilter: normalizeEnumValue(raw.ownedFilter, OWNED_FILTER_VALUES, defaultInputViewSettings.ownedFilter),
    limitedFilter: normalizeEnumValue(raw.limitedFilter, LIMITED_FILTER_VALUES, defaultInputViewSettings.limitedFilter),
    limitBreakFilter: normalizeEnumValue(
      raw.limitBreakFilter,
      LIMIT_BREAK_FILTER_VALUES,
      defaultInputViewSettings.limitBreakFilter,
    ),
    starMemoryCalcMode: normalizeEnumValue(
      raw.starMemoryCalcMode,
      STAR_MEMORY_CALC_MODE_VALUES,
      defaultInputViewSettings.starMemoryCalcMode,
    ),
    ue1MemoryCalcMode: normalizeEnumValue(
      raw.ue1MemoryCalcMode,
      UE1_MEMORY_CALC_MODE_VALUES,
      defaultInputViewSettings.ue1MemoryCalcMode,
    ),
    ue1HeartFragmentCalcMode: normalizeEnumValue(
      raw.ue1HeartFragmentCalcMode,
      UE1_HEART_FRAGMENT_CALC_MODE_VALUES,
      defaultInputViewSettings.ue1HeartFragmentCalcMode,
    ),
    starFilters: normalizeArrayWithSet(raw.starFilters, new Set<StarFilter>(STAR_VALUES)),
    ue1Filters: normalizeArrayWithSet(raw.ue1Filters, allowedUe1FilterSet),
    ue2Filters: normalizeArrayWithSet(raw.ue2Filters, allowedUe2FilterSet),
    memorySourceFilters: normalizeArrayWithSet(raw.memorySourceFilters, allowedMemorySourceFilterSet),
    sortKey: normalizeEnumValue(raw.sortKey, SORT_KEY_VALUES, defaultInputViewSettings.sortKey),
    sortDirection: raw.sortDirection === null ? null : normalizeEnumValue(raw.sortDirection, SORT_DIRECTION_VALUES, null),
  };
}

// 保存文字列を解析し、現在仕様のUI状態へ正規化する。
export function parseUiState(rawText: string): UiStateV1 {
  try {
    const parsedJson = JSON.parse(rawText) as unknown;
    const parsedState = looseUiStateSchema.safeParse(parsedJson);
    if (!parsedState.success) {
      return buildDefaultUiState();
    }

    const raw = parsedState.data;
    return {
      schemaVersion: CURRENT_UI_SCHEMA_VERSION,
      activeTab: normalizeEnumValue(raw.activeTab, ACTIVE_TAB_VALUES, "input"),
      input: normalizeInputSettings(raw.input),
    };
  } catch {
    return buildDefaultUiState();
  }
}

// localStorageからUI設定を読み込み、失敗時は既定値を返す。
export function loadUiState(): UiStateV1 {
  if (typeof window === "undefined") {
    return buildDefaultUiState();
  }

  const rawText = window.localStorage.getItem(UI_STORAGE_KEY);
  if (!rawText) {
    return buildDefaultUiState();
  }

  try {
    return parseUiState(rawText);
  } catch {
    return buildDefaultUiState();
  }
}

// UI設定をlocalStorageへ保存する。
export function saveUiState(state: UiStateV1): void {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(state);
  try {
    window.localStorage.setItem(UI_STORAGE_KEY, serialized);
  } catch (error) {
    console.warn(`UI設定の保存に失敗しました: key=${UI_STORAGE_KEY}`, { error, serialized });
  }
}
