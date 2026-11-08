import { z } from "zod";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "./levels";
import { MEMORY_PIECE_SOURCES, type MemoryPieceSource } from "./types";
import type { MultiSelection } from "./multiSelection";
import type { StarMemoryCalcMode } from "../utils/starMemoryCost";
import type { Ue1HeartFragmentCalcMode } from "../utils/ue1HeartFragmentCost";
import type { Ue1MemoryCalcMode } from "../utils/ue1MemoryCost";
import { writeDeviceStorage } from "./deviceData";
import { UI_STORAGE_KEY } from "./storageKeys";

// 保存キーは storageKeys.ts へ移したため、既存の import 元を保つよう re-export する。
export { UI_STORAGE_KEY };
// v2: 複数選択フィルタの「絞り込みなし」を null で表すよう変更（v1 までは空配列が絞り込みなし）。
export const CURRENT_UI_SCHEMA_VERSION = 2 as const;

export type ActiveTab = "input" | "dashboard" | "coin_shop" | "connect_rank_calc" | "clan_battle";
export type OwnedFilter = "all" | "owned" | "unowned";
export type LimitedFilter = "all" | "limited" | "normal";
export type Ue1SpImplementedFilter = "all" | "implemented" | "unimplemented";
export type LimitBreakFilter = "all" | "on" | "off";
export type AdventureMemoryPieceFilter = "all" | "on" | "off";
export type PurePieceAvailabilityFilter = "all" | "available" | "unavailable";
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
  isDetailSettingsOpen: boolean;
  ownedFilter: OwnedFilter;
  limitedFilter: LimitedFilter;
  ue1SpImplementedFilter: Ue1SpImplementedFilter;
  limitBreakFilter: LimitBreakFilter;
  adventureMemoryPieceFilter: AdventureMemoryPieceFilter;
  purePieceAvailabilityFilter: PurePieceAvailabilityFilter;
  starMemoryCalcMode: StarMemoryCalcMode;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  ue1HeartFragmentCalcMode: Ue1HeartFragmentCalcMode;
  includeSameBasePurePieceForUe2: boolean;
  starFilters: MultiSelection<StarFilter>;
  ue1Filters: MultiSelection<Ue1Filter>;
  ue2Filters: MultiSelection<Ue2Filter>;
  memorySourceFilters: MultiSelection<MemorySourceFilter>;
  sortKey: SortKey;
  sortDirection: SortDirection;
};

export type ClanBattleViewSettings = {
  selectedFormationId: string | null;
};

export type UiStateV2 = {
  schemaVersion: typeof CURRENT_UI_SCHEMA_VERSION;
  activeTab: ActiveTab;
  input: InputViewSettings;
  clanBattle: ClanBattleViewSettings;
};

const ACTIVE_TAB_VALUES: ActiveTab[] = ["input", "dashboard", "coin_shop", "connect_rank_calc", "clan_battle"];
const OWNED_FILTER_VALUES: OwnedFilter[] = ["all", "owned", "unowned"];
const LIMITED_FILTER_VALUES: LimitedFilter[] = ["all", "limited", "normal"];
const UE1_SP_IMPLEMENTED_FILTER_VALUES: Ue1SpImplementedFilter[] = ["all", "implemented", "unimplemented"];
const LIMIT_BREAK_FILTER_VALUES: LimitBreakFilter[] = ["all", "on", "off"];
const ADVENTURE_MEMORY_PIECE_FILTER_VALUES: AdventureMemoryPieceFilter[] = ["all", "on", "off"];
const PURE_PIECE_AVAILABILITY_FILTER_VALUES: PurePieceAvailabilityFilter[] = ["all", "available", "unavailable"];
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
// 複数選択フィルタの選択肢（画面の並び順）。保存値の検証と画面の選択肢の両方で使う。
export const STAR_FILTER_VALUES: readonly StarFilter[] = [1, 2, 3, 4, 5, 6];
export const UE1_FILTER_VALUES: readonly Ue1Filter[] = ["unimplemented", ...UE1_LEVEL_VALUES, "sp"];
export const UE2_FILTER_VALUES: readonly Ue2Filter[] = ["unimplemented", ...UE2_LEVEL_VALUES];
export const MEMORY_SOURCE_FILTER_VALUES: readonly MemorySourceFilter[] = ["none", ...MEMORY_PIECE_SOURCES];


const defaultInputViewSettings: InputViewSettings = {
  searchText: "",
  isDetailSettingsOpen: false,
  ownedFilter: "all",
  limitedFilter: "all",
  ue1SpImplementedFilter: "all",
  limitBreakFilter: "all",
  adventureMemoryPieceFilter: "all",
  purePieceAvailabilityFilter: "all",
  starMemoryCalcMode: "implemented_max",
  ue1MemoryCalcMode: "implemented_max",
  ue1HeartFragmentCalcMode: "implemented_max",
  includeSameBasePurePieceForUe2: false,
  starFilters: null,
  ue1Filters: null,
  ue2Filters: null,
  memorySourceFilters: null,
  sortKey: "name",
  sortDirection: null,
};

const looseInputSettingsSchema = z
  .object({
    searchText: z.unknown().optional(),
    isDetailSettingsOpen: z.unknown().optional(),
    ownedFilter: z.unknown().optional(),
    limitedFilter: z.unknown().optional(),
    ue1SpImplementedFilter: z.unknown().optional(),
    limitBreakFilter: z.unknown().optional(),
    adventureMemoryPieceFilter: z.unknown().optional(),
    purePieceAvailabilityFilter: z.unknown().optional(),
    starMemoryCalcMode: z.unknown().optional(),
    ue1MemoryCalcMode: z.unknown().optional(),
    ue1HeartFragmentCalcMode: z.unknown().optional(),
    includeSameBasePurePieceForUe2: z.unknown().optional(),
    starFilters: z.array(z.unknown()).nullable().optional(),
    ue1Filters: z.array(z.unknown()).nullable().optional(),
    ue2Filters: z.array(z.unknown()).nullable().optional(),
    memorySourceFilters: z.array(z.unknown()).nullable().optional(),
    sortKey: z.unknown().optional(),
    sortDirection: z.unknown().optional(),
  })
  .passthrough();

const looseUiStateSchema = z
  .object({
    schemaVersion: z.number().optional(),
    activeTab: z.unknown().optional(),
    input: z.unknown().optional(),
    clanBattle: z.unknown().optional(),
  })
  .passthrough();

const looseClanBattleSettingsSchema = z
  .object({
    selectedFormationId: z.unknown().optional(),
  })
  .passthrough();

// UI設定の既定値を返す。
export function buildDefaultInputViewSettings(): InputViewSettings {
  return { ...defaultInputViewSettings };
}

// クラバト画面設定の既定値を返す。
export function buildDefaultClanBattleViewSettings(): ClanBattleViewSettings {
  return { selectedFormationId: null };
}

// UI状態の既定値を返す。
export function buildDefaultUiState(): UiStateV2 {
  return {
    schemaVersion: CURRENT_UI_SCHEMA_VERSION,
    activeTab: "input",
    input: buildDefaultInputViewSettings(),
    clanBattle: buildDefaultClanBattleViewSettings(),
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

// 保存された複数選択フィルタを正規化する。
// v1 までの空配列と、候補外の値しか残らない配列は絞り込みなし（null）として読み、全項目がそろう配列も null へまとめる。
function normalizeMultiSelection<T extends string | number>(
  value: unknown,
  allowedValues: readonly T[],
  emptyArrayMeansAll: boolean,
): MultiSelection<T> {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.length === 0) {
    return emptyArrayMeansAll ? null : [];
  }
  const allowedSet = new Set(allowedValues);
  const normalized = normalizeArrayWithSet(value, allowedSet);
  if (normalized.length === 0 || normalized.length === allowedSet.size) {
    return null;
  }
  return allowedValues.filter((candidate) => normalized.includes(candidate));
}

// 緩い入力オブジェクトからUI設定を安全な形式へ正規化する。
// legacyEmptyFilter が true（v1 以前の保存値）のときは、複数選択フィルタの空配列を絞り込みなしとして読む。
function normalizeInputSettings(rawInput: unknown, legacyEmptyFilter: boolean): InputViewSettings {
  const parsedInput = looseInputSettingsSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return buildDefaultInputViewSettings();
  }

  const raw = parsedInput.data;
  return {
    searchText: typeof raw.searchText === "string" ? raw.searchText : "",
    isDetailSettingsOpen:
      typeof raw.isDetailSettingsOpen === "boolean"
        ? raw.isDetailSettingsOpen
        : defaultInputViewSettings.isDetailSettingsOpen,
    ownedFilter: normalizeEnumValue(raw.ownedFilter, OWNED_FILTER_VALUES, defaultInputViewSettings.ownedFilter),
    limitedFilter: normalizeEnumValue(raw.limitedFilter, LIMITED_FILTER_VALUES, defaultInputViewSettings.limitedFilter),
    ue1SpImplementedFilter: normalizeEnumValue(
      raw.ue1SpImplementedFilter,
      UE1_SP_IMPLEMENTED_FILTER_VALUES,
      defaultInputViewSettings.ue1SpImplementedFilter,
    ),
    limitBreakFilter: normalizeEnumValue(
      raw.limitBreakFilter,
      LIMIT_BREAK_FILTER_VALUES,
      defaultInputViewSettings.limitBreakFilter,
    ),
    adventureMemoryPieceFilter: normalizeEnumValue(
      raw.adventureMemoryPieceFilter,
      ADVENTURE_MEMORY_PIECE_FILTER_VALUES,
      defaultInputViewSettings.adventureMemoryPieceFilter,
    ),
    purePieceAvailabilityFilter: normalizeEnumValue(
      raw.purePieceAvailabilityFilter,
      PURE_PIECE_AVAILABILITY_FILTER_VALUES,
      defaultInputViewSettings.purePieceAvailabilityFilter,
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
    includeSameBasePurePieceForUe2:
      typeof raw.includeSameBasePurePieceForUe2 === "boolean"
        ? raw.includeSameBasePurePieceForUe2
        : defaultInputViewSettings.includeSameBasePurePieceForUe2,
    starFilters: normalizeMultiSelection(raw.starFilters, STAR_FILTER_VALUES, legacyEmptyFilter),
    ue1Filters: normalizeMultiSelection(raw.ue1Filters, UE1_FILTER_VALUES, legacyEmptyFilter),
    ue2Filters: normalizeMultiSelection(raw.ue2Filters, UE2_FILTER_VALUES, legacyEmptyFilter),
    memorySourceFilters: normalizeMultiSelection(raw.memorySourceFilters, MEMORY_SOURCE_FILTER_VALUES, legacyEmptyFilter),
    sortKey: normalizeEnumValue(raw.sortKey, SORT_KEY_VALUES, defaultInputViewSettings.sortKey),
    sortDirection: raw.sortDirection === null ? null : normalizeEnumValue(raw.sortDirection, SORT_DIRECTION_VALUES, null),
  };
}

// 緩い入力オブジェクトからクラバト画面設定を正規化する（項目のない旧データは既定値）。
function normalizeClanBattleSettings(rawClanBattle: unknown): ClanBattleViewSettings {
  const parsed = looseClanBattleSettingsSchema.safeParse(rawClanBattle);
  if (!parsed.success) {
    return buildDefaultClanBattleViewSettings();
  }
  const { selectedFormationId } = parsed.data;
  return {
    selectedFormationId: typeof selectedFormationId === "string" && selectedFormationId !== "" ? selectedFormationId : null,
  };
}

// 保存文字列を解析し、現在仕様のUI状態へ正規化する。
export function parseUiState(rawText: string): UiStateV2 {
  try {
    const parsedJson = JSON.parse(rawText) as unknown;
    const parsedState = looseUiStateSchema.safeParse(parsedJson);
    if (!parsedState.success) {
      return buildDefaultUiState();
    }

    const raw = parsedState.data;
    const isLegacySchema = typeof raw.schemaVersion !== "number" || raw.schemaVersion < 2;
    return {
      schemaVersion: CURRENT_UI_SCHEMA_VERSION,
      activeTab: normalizeEnumValue(raw.activeTab, ACTIVE_TAB_VALUES, "input"),
      input: normalizeInputSettings(raw.input, isLegacySchema),
      clanBattle: normalizeClanBattleSettings(raw.clanBattle),
    };
  } catch {
    return buildDefaultUiState();
  }
}

// localStorageからUI設定を読み込み、失敗時は既定値を返す。
export function loadUiState(): UiStateV2 {
  if (typeof window === "undefined") {
    return buildDefaultUiState();
  }

  const rawText = window.localStorage.getItem(UI_STORAGE_KEY);
  if (!rawText) {
    return buildDefaultUiState();
  }
  return parseUiState(rawText);
}

// UI設定をlocalStorageへ保存する。
export function saveUiState(state: UiStateV2): void {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(state);
  try {
    writeDeviceStorage(UI_STORAGE_KEY, serialized);
  } catch (error) {
    console.warn(`UI設定の保存に失敗しました: key=${UI_STORAGE_KEY}`, { error, serialized });
  }
}
