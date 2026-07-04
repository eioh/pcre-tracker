import { beforeEach, describe, expect, it } from "vitest";
import { SYNC_META_STORAGE_KEY, TOUCHED_STORAGE_KEY } from "./storageKeys";
import { clearSyncMeta, loadSyncMeta, loadTouchedFlag, markTouched, saveSyncMeta, type SyncMetaV1 } from "./syncMeta";

describe("syncMeta", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("保存した同期メタを読み込める", () => {
    const meta: SyncMetaV1 = { userId: "u1", revision: 3, localChangeSeq: 5, lastSyncedSeq: 5 };
    saveSyncMeta(meta);
    expect(loadSyncMeta()).toEqual(meta);
  });

  it("未保存時は null を返す", () => {
    expect(loadSyncMeta()).toBeNull();
  });

  it("破損データ（JSON でない）は null を返す", () => {
    window.localStorage.setItem(SYNC_META_STORAGE_KEY, "broken");
    expect(loadSyncMeta()).toBeNull();
  });

  it("必須フィールド欠落は null を返す", () => {
    window.localStorage.setItem(SYNC_META_STORAGE_KEY, JSON.stringify({ userId: "u1", revision: 1 }));
    expect(loadSyncMeta()).toBeNull();
  });

  it("clearSyncMeta で破棄できる", () => {
    saveSyncMeta({ userId: "u1", revision: 1, localChangeSeq: 0, lastSyncedSeq: 0 });
    clearSyncMeta();
    expect(loadSyncMeta()).toBeNull();
  });

  it("touched フラグを立てて読み込める", () => {
    expect(loadTouchedFlag()).toBe(false);
    markTouched();
    expect(loadTouchedFlag()).toBe(true);
    expect(window.localStorage.getItem(TOUCHED_STORAGE_KEY)).toBe("1");
  });
});
