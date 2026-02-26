import { z } from "zod";
import { STORAGE_KEY } from "./storage";
import { UI_STORAGE_KEY } from "./uiStorage";

export const BACKUP_FORMAT_VERSION = 1 as const;

export type LocalStorageBackupV1 = {
  formatVersion: 1;
  exportedAt: string;
  storage: {
    [STORAGE_KEY]: string | null;
    [UI_STORAGE_KEY]: string | null;
  };
};

const backupPayloadSchema = z.object({
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  exportedAt: z.string().datetime({ offset: true }),
  storage: z.object({
    [STORAGE_KEY]: z.union([z.string(), z.null()]),
    [UI_STORAGE_KEY]: z.union([z.string(), z.null()]),
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

// 現在のlocalStorageからバックアップ用ペイロードを作成する。
export function buildBackupPayloadFromLocalStorage(): LocalStorageBackupV1 {
  if (typeof window === "undefined") {
    return {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      storage: {
        [STORAGE_KEY]: null,
        [UI_STORAGE_KEY]: null,
      },
    };
  }

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    storage: {
      [STORAGE_KEY]: window.localStorage.getItem(STORAGE_KEY),
      [UI_STORAGE_KEY]: window.localStorage.getItem(UI_STORAGE_KEY),
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

  const growthData = payload.storage[STORAGE_KEY];
  const uiData = payload.storage[UI_STORAGE_KEY];
  const previousGrowthData = window.localStorage.getItem(STORAGE_KEY);
  const previousUiData = window.localStorage.getItem(UI_STORAGE_KEY);

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
    throw error;
  }
}
