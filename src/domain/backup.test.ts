import { describe, expect, it } from "vitest";
import {
  applyBackupPayloadToLocalStorage,
  buildBackupPayloadFromLocalStorage,
  parseBackupPayload,
  serializeBackupPayload,
} from "./backup";
import { STORAGE_KEY } from "./storage";
import { UI_STORAGE_KEY } from "./uiStorage";

describe("backup", () => {
  it("localStorageの2キー生値をバックアップ化できる", () => {
    window.localStorage.setItem(STORAGE_KEY, '{"schemaVersion":1}');
    window.localStorage.setItem(UI_STORAGE_KEY, '{"schemaVersion":1,"activeTab":"input"}');

    const payload = buildBackupPayloadFromLocalStorage();

    expect(payload.storage[STORAGE_KEY]).toBe('{"schemaVersion":1}');
    expect(payload.storage[UI_STORAGE_KEY]).toBe('{"schemaVersion":1,"activeTab":"input"}');
  });

  it("バックアップJSONを復元適用できる", () => {
    const rawText = serializeBackupPayload({
      formatVersion: 1,
      exportedAt: "2026-02-23T00:00:00.000Z",
      storage: {
        [STORAGE_KEY]: '{"schemaVersion":1,"progressByName":{}}',
        [UI_STORAGE_KEY]: null,
      },
    });

    const payload = parseBackupPayload(rawText);
    applyBackupPayloadToLocalStorage(payload);

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{"schemaVersion":1,"progressByName":{}}');
    expect(window.localStorage.getItem(UI_STORAGE_KEY)).toBeNull();
  });

  it("不正フォーマットはパースで失敗する", () => {
    expect(() => parseBackupPayload('{"formatVersion":999}')).toThrow();
  });
});
