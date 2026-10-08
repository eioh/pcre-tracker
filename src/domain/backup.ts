import { z } from "zod";
import { CONNECT_RANK_CALC_STORAGE_KEY } from "./connectRankCalcStorage";
import { isDeviceDataEpochCurrent, removeDeviceStorage, writeDeviceStorage } from "./deviceData";
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

// 端末データの世代が古いタブで復元しようとしたときの例外。
export class StaleDeviceDataError extends Error {
  // 別のタブで端末データが削除・変更された後のタブからの書き込みであることを示す例外を生成する。
  constructor() {
    super("別のタブで端末データが変更されたため、このタブからは書き込めません");
    this.name = "StaleDeviceDataError";
  }
}

// localStorage の値を、null なら削除・それ以外なら書き込みで反映する（端末データの書き込み口を通す）。
function writeOrRemove(key: typeof STORAGE_KEY | typeof UI_STORAGE_KEY | typeof CONNECT_RANK_CALC_STORAGE_KEY, value: string | null): void {
  if (value === null) {
    removeDeviceStorage(key);
  } else {
    writeDeviceStorage(key, value);
  }
}

// バックアップ内容をlocalStorageへ適用する。
// 別のタブで端末データが削除・変更された後のタブでは何も書き込まず、StaleDeviceDataError を投げる
// （書き込みは端末データの書き込み口で止まるが、復元が成功したように見せないため）。
export function applyBackupPayloadToLocalStorage(payload: LocalStorageBackupV1): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!isDeviceDataEpochCurrent()) {
    throw new StaleDeviceDataError();
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
    writeOrRemove(STORAGE_KEY, growthData);
    writeOrRemove(UI_STORAGE_KEY, uiData);
    // 未指定（undefined）の場合はローカルの計算データを削除し、旧バックアップ復元時のデータ残留を防ぐ。
    writeOrRemove(CONNECT_RANK_CALC_STORAGE_KEY, calcData === undefined ? null : calcData);
  } catch (error) {
    // 途中で失敗した場合は適用前の値へ戻す（ロールバックも端末データの書き込み口を通す）。
    writeOrRemove(STORAGE_KEY, previousGrowthData);
    writeOrRemove(UI_STORAGE_KEY, previousUiData);
    writeOrRemove(CONNECT_RANK_CALC_STORAGE_KEY, previousCalcData);
    throw error;
  }
}
