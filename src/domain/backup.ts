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
  const parsed = JSON.parse(rawText) as unknown;
  return backupPayloadSchema.parse(parsed);
}

// バックアップ内容をlocalStorageへ適用する。
export function applyBackupPayloadToLocalStorage(payload: LocalStorageBackupV1): void {
  if (typeof window === "undefined") {
    return;
  }

  const growthData = payload.storage[STORAGE_KEY];
  const uiData = payload.storage[UI_STORAGE_KEY];

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
}
