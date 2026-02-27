import { beforeEach, describe, expect, it } from "vitest";
import {
  applyBackupPayloadToLocalStorage,
  buildBackupPayloadFromLocalStorage,
  parseBackupPayload,
  serializeBackupPayload,
} from "./backup";
import { STORAGE_KEY } from "./storage";
import { UI_STORAGE_KEY } from "./uiStorage";

describe("backup", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("localStorageの2キーをJSONオブジェクト形式でバックアップ化できる", () => {
    window.localStorage.setItem(STORAGE_KEY, '{"schemaVersion":1}');
    window.localStorage.setItem(UI_STORAGE_KEY, '{"schemaVersion":1,"activeTab":"input"}');

    const payload = buildBackupPayloadFromLocalStorage();

    expect(payload.storage[STORAGE_KEY]).toEqual({ schemaVersion: 1 });
    expect(payload.storage[UI_STORAGE_KEY]).toEqual({ schemaVersion: 1, activeTab: "input" });
  });

  it("新形式バックアップJSONを復元適用できる", () => {
    const rawText = serializeBackupPayload({
      formatVersion: 1,
      exportedAt: "2026-02-23T00:00:00.000Z",
      storage: {
        [STORAGE_KEY]: { schemaVersion: 1, progressByName: {} },
        [UI_STORAGE_KEY]: null,
      },
    });

    const payload = parseBackupPayload(rawText);
    applyBackupPayloadToLocalStorage(payload);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{"schemaVersion":1,"progressByName":{}}');
    expect(window.localStorage.getItem(UI_STORAGE_KEY)).toBeNull();
  });

  it("旧形式バックアップJSON(文字列)はパースで失敗する", () => {
    const rawText = serializeBackupPayload({
      formatVersion: 1,
      exportedAt: "2026-02-23T00:00:00.000Z",
      storage: {
        [STORAGE_KEY]: '{"schemaVersion":1,"progressByName":{"ヒヨリ":{"owned":true}}}',
        [UI_STORAGE_KEY]: '{"schemaVersion":1,"activeTab":"dashboard"}',
      },
    });

    expect(() => parseBackupPayload(rawText)).toThrow();
  });

  it("不正フォーマットはパースで失敗する", () => {
    expect(() => parseBackupPayload('{"formatVersion":999}')).toThrow();
  });
});
