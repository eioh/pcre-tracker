import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_DATA_OWNER_STORAGE_KEY, SYNC_META_STORAGE_KEY, TOUCHED_STORAGE_KEY } from "./storageKeys";
import {
  clearLocalDataOwner,
  clearSyncMeta,
  loadLocalDataOwner,
  loadSyncMeta,
  loadTouchedFlag,
  markTouched,
  saveLocalDataOwner,
  saveSyncMeta,
  type SyncMetaV1,
} from "./syncMeta";

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

  it("サーバーの行が未確立（revision: null）のメタも読み込める", () => {
    const meta: SyncMetaV1 = { userId: "u1", revision: null, localChangeSeq: 1, lastSyncedSeq: 0 };
    saveSyncMeta(meta);
    expect(loadSyncMeta()).toEqual(meta);
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

  it("所有者を保存して読み込める", () => {
    saveLocalDataOwner("u1");
    expect(loadLocalDataOwner()).toBe("u1");
    expect(JSON.parse(window.localStorage.getItem(LOCAL_DATA_OWNER_STORAGE_KEY) ?? "null")).toEqual({ userId: "u1" });
  });

  it("所有者が未保存なら null を返す", () => {
    expect(loadLocalDataOwner()).toBeNull();
  });

  it("所有者の保存値が壊れていれば null を返す", () => {
    window.localStorage.setItem(LOCAL_DATA_OWNER_STORAGE_KEY, "broken");
    expect(loadLocalDataOwner()).toBeNull();
    window.localStorage.setItem(LOCAL_DATA_OWNER_STORAGE_KEY, JSON.stringify({ userId: 1 }));
    expect(loadLocalDataOwner()).toBeNull();
    window.localStorage.setItem(LOCAL_DATA_OWNER_STORAGE_KEY, JSON.stringify({ userId: "" }));
    expect(loadLocalDataOwner()).toBeNull();
  });

  it("clearLocalDataOwner で所有者を削除できる（同期メタとは独立）", () => {
    saveLocalDataOwner("u1");
    saveSyncMeta({ userId: "u1", revision: 1, localChangeSeq: 0, lastSyncedSeq: 0 });
    clearLocalDataOwner();
    expect(loadLocalDataOwner()).toBeNull();
    expect(loadSyncMeta()).not.toBeNull();
  });

  it("clearSyncMeta では所有者を消さない", () => {
    saveLocalDataOwner("u1");
    saveSyncMeta({ userId: "u1", revision: 1, localChangeSeq: 0, lastSyncedSeq: 0 });
    clearSyncMeta();
    expect(loadLocalDataOwner()).toBe("u1");
  });
});
