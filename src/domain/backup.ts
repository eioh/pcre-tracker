import { z } from "zod";
import { CONNECT_RANK_CALC_STORAGE_KEY } from "./connectRankCalcStorage";
import { STORAGE_KEY } from "./storage";
import { UI_STORAGE_KEY } from "./uiStorage";

export const BACKUP_FORMAT_VERSION = 1 as const;
type BackupStorageValue = Record<string, unknown> | null;

export type LocalStorageBackupV1 = {
  formatVersion: 1;
  exportedAt: string;
  storage: {
    [STORAGE_KEY]: BackupStorageValue;
    [UI_STORAGE_KEY]: BackupStorageValue;
    [CONNECT_RANK_CALC_STORAGE_KEY]?: BackupStorageValue;
  };
};

const backupPayloadSchema = z.object({
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  exportedAt: z.string().datetime({ offset: true }),
  storage: z.object({
    [STORAGE_KEY]: z.union([z.record(z.unknown()), z.null()]),
    [UI_STORAGE_KEY]: z.union([z.record(z.unknown()), z.null()]),
    [CONNECT_RANK_CALC_STORAGE_KEY]: z.union([z.record(z.unknown()), z.null()]).optional(),
  }),
});

type BackupParseErrorKind = "syntax" | "schema";

export class BackupParseError extends Error {
  rawText: string;
  kind: BackupParseErrorKind;

  // バックアップ文字列の解析失敗情報を保持する例外を生成する。
  constructor(kind: BackupParseErrorKind, rawText: string, cause: unknown) {
    super(kind === "syntax" ? "バックアップJSONの構文が不正です" : "バックアップJSONの形式が不正です");
    this.name = "BackupParseError";
    this.rawText = rawText;
    this.kind = kind;
    this.cause = cause;
  }
}

// localStorageのJSON文字列をオブジェクト化し、オブジェクト以外はnullとして扱う。
function parseStorageValue(rawValue: string | null): BackupStorageValue {
  if (rawValue === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

// バックアップ内の値をlocalStorageへ保存可能な文字列へ正規化する。
function stringifyStorageValue(value: BackupStorageValue): string | null {
  if (value === null) {
    return null;
  }
  return JSON.stringify(value);
}

// 現在のlocalStorageからバックアップ用ペイロードを作成する。
export function buildBackupPayloadFromLocalStorage(): LocalStorageBackupV1 {
  if (typeof window === "undefined") {
    return {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      storage: {
        [STORAGE_KEY]: null,
        [UI_STORAGE_KEY]: null,
        [CONNECT_RANK_CALC_STORAGE_KEY]: null,
      },
    };
  }

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    storage: {
      [STORAGE_KEY]: parseStorageValue(window.localStorage.getItem(STORAGE_KEY)),
      [UI_STORAGE_KEY]: parseStorageValue(window.localStorage.getItem(UI_STORAGE_KEY)),
      [CONNECT_RANK_CALC_STORAGE_KEY]: parseStorageValue(window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY)),
    },
  };
}

// バックアップペイロードをJSON文字列へ変換する。
export function serializeBackupPayload(payload: LocalStorageBackupV1): string {
  return JSON.stringify(payload, null, 2);
}

// バックアップJSON文字列を検証済みペイロードへ変換する。
export function parseBackupPayload(rawText: string): LocalStorageBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch (error) {
    throw new BackupParseError("syntax", rawText, error);
  }

  try {
    return backupPayloadSchema.parse(parsed);
  } catch (error) {
    throw new BackupParseError("schema", rawText, error);
  }
}

// バックアップ内容をlocalStorageへ適用する。
export function applyBackupPayloadToLocalStorage(payload: LocalStorageBackupV1): void {
  if (typeof window === "undefined") {
    return;
  }

  const growthData = stringifyStorageValue(payload.storage[STORAGE_KEY]);
  const uiData = stringifyStorageValue(payload.storage[UI_STORAGE_KEY]);
  // バックアップに計算タブデータが未指定（旧バックアップ）の場合はundefined。
  const calcRawValue = payload.storage[CONNECT_RANK_CALC_STORAGE_KEY];
  const calcData = calcRawValue === undefined ? undefined : stringifyStorageValue(calcRawValue);
  const previousGrowthData = window.localStorage.getItem(STORAGE_KEY);
  const previousUiData = window.localStorage.getItem(UI_STORAGE_KEY);
  const previousCalcData = window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY);

  try {
    if (growthData === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, growthData);
    }

    if (uiData === null) {
      window.localStorage.removeItem(UI_STORAGE_KEY);
    } else {
      window.localStorage.setItem(UI_STORAGE_KEY, uiData);
    }

    // 未指定（undefined）の場合はローカルの計算データを削除し、旧バックアップ復元時のデータ残留を防ぐ。
    if (calcData === undefined || calcData === null) {
      window.localStorage.removeItem(CONNECT_RANK_CALC_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CONNECT_RANK_CALC_STORAGE_KEY, calcData);
    }
  } catch (error) {
    if (previousGrowthData === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, previousGrowthData);
    }
    if (previousUiData === null) {
      window.localStorage.removeItem(UI_STORAGE_KEY);
    } else {
      window.localStorage.setItem(UI_STORAGE_KEY, previousUiData);
    }
    if (previousCalcData === null) {
      window.localStorage.removeItem(CONNECT_RANK_CALC_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CONNECT_RANK_CALC_STORAGE_KEY, previousCalcData);
    }
    throw error;
  }
}
