import { beforeEach, describe, expect, it } from "vitest";
import { applyBackupPayloadToLocalStorage, StaleDeviceDataError } from "./backup";
import { buildDefaultConnectRankCalcState } from "./connectRankCalcSchema";
import { saveConnectRankCalcState } from "./connectRankCalcStorage";
import {
  bumpDeviceDataEpoch,
  clearDeviceUserData,
  DEVICE_DATA_STORAGE_KEYS,
  isDeviceDataEpochCurrent,
  removeDeviceStorage,
  sealDeviceDataWrites,
  writeDeviceStorage,
} from "./deviceData";
import { masterCharacters } from "./master";
import { buildInitialState, saveStoredState } from "./storage";
import {
  CONNECT_RANK_CALC_STORAGE_KEY,
  DEVICE_DATA_EPOCH_STORAGE_KEY,
  LOCAL_DATA_OWNER_STORAGE_KEY,
  STORAGE_KEY,
  SYNC_META_STORAGE_KEY,
  TOUCHED_STORAGE_KEY,
  UI_STORAGE_KEY,
} from "./storageKeys";
import { clearLocalDataOwner, clearSyncMeta, markTouched, saveLocalDataOwner, saveSyncMeta } from "./syncMeta";
import { buildDefaultUiState, saveUiState } from "./uiStorage";

// 別のタブが端末データの epoch を進めた状況を再現する（このタブの控えとは異なる値を書き込む）。
function simulateEpochBumpedInAnotherTab() {
  window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, `other-tab-${Math.random()}`);
}

// 端末データの 6 キーすべてに判別用の値を入れる。
function fillDeviceData() {
  for (const key of DEVICE_DATA_STORAGE_KEYS) {
    window.localStorage.setItem(key, `before:${key}`);
  }
}

beforeEach(() => {
  // epoch キーも消える。キーがない状態は「別のタブが進めた証拠なし」として控えの値で作り直される。
  window.localStorage.clear();
});

describe("deviceData: epoch と書き込み口", () => {
  it("epoch キーがなければ一致とみなし、控えの値で作り直す", () => {
    expect(isDeviceDataEpochCurrent()).toBe(true);
    expect(window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY)).not.toBeNull();
  });

  it("epoch が一致していれば書き込み・削除できる", () => {
    expect(writeDeviceStorage(STORAGE_KEY, "value")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("value");
    expect(removeDeviceStorage(STORAGE_KEY)).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("別のタブが epoch を進めた後は、書き込みも削除も何もしない", () => {
    window.localStorage.setItem(STORAGE_KEY, "before");
    isDeviceDataEpochCurrent();
    simulateEpochBumpedInAnotherTab();

    expect(isDeviceDataEpochCurrent()).toBe(false);
    expect(writeDeviceStorage(STORAGE_KEY, "after")).toBe(false);
    expect(removeDeviceStorage(STORAGE_KEY)).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("before");
  });

  it("bumpDeviceDataEpoch は epoch を新しい値にし、このタブは引き続き書き込める", () => {
    isDeviceDataEpochCurrent();
    const before = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);
    bumpDeviceDataEpoch();
    const after = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
    expect(isDeviceDataEpochCurrent()).toBe(true);
    expect(writeDeviceStorage(STORAGE_KEY, "value")).toBe(true);
  });

  it("sealDeviceDataWrites の後は、このタブからも書き込めない", () => {
    isDeviceDataEpochCurrent();
    const before = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);
    sealDeviceDataWrites();
    expect(window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY)).not.toBe(before);
    expect(isDeviceDataEpochCurrent()).toBe(false);
    expect(writeDeviceStorage(STORAGE_KEY, "value")).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clearDeviceUserData は端末データの 6 キーを削除し、epoch と無関係なキーは残す", () => {
    fillDeviceData();
    isDeviceDataEpochCurrent();
    const epoch = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);
    window.localStorage.setItem("unrelated_key", "keep");

    clearDeviceUserData();

    expect(DEVICE_DATA_STORAGE_KEYS).toEqual([
      STORAGE_KEY,
      CONNECT_RANK_CALC_STORAGE_KEY,
      UI_STORAGE_KEY,
      TOUCHED_STORAGE_KEY,
      SYNC_META_STORAGE_KEY,
      LOCAL_DATA_OWNER_STORAGE_KEY,
    ]);
    for (const key of DEVICE_DATA_STORAGE_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
    expect(window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY)).toBe(epoch);
    expect(window.localStorage.getItem("unrelated_key")).toBe("keep");
  });
});

describe("deviceData: 各保存関数は epoch が古いタブから書き込まない", () => {
  it("育成・計算タブ・UI 設定・touched・同期メタ・所有者の保存と削除がすべて止まる", () => {
    fillDeviceData();
    isDeviceDataEpochCurrent();
    simulateEpochBumpedInAnotherTab();

    saveStoredState(buildInitialState(masterCharacters));
    saveConnectRankCalcState(buildDefaultConnectRankCalcState());
    saveUiState(buildDefaultUiState());
    markTouched();
    saveSyncMeta({ userId: "u1", revision: 1, localChangeSeq: 0, lastSyncedSeq: 0 });
    saveLocalDataOwner("u1");

    for (const key of DEVICE_DATA_STORAGE_KEYS) {
      expect(window.localStorage.getItem(key)).toBe(`before:${key}`);
    }

    clearSyncMeta();
    clearLocalDataOwner();
    expect(window.localStorage.getItem(SYNC_META_STORAGE_KEY)).toBe(`before:${SYNC_META_STORAGE_KEY}`);
    expect(window.localStorage.getItem(LOCAL_DATA_OWNER_STORAGE_KEY)).toBe(`before:${LOCAL_DATA_OWNER_STORAGE_KEY}`);
  });

  it("バックアップの復元は書き込まずに StaleDeviceDataError を投げる", () => {
    fillDeviceData();
    isDeviceDataEpochCurrent();
    simulateEpochBumpedInAnotherTab();

    expect(() =>
      applyBackupPayloadToLocalStorage({
        formatVersion: 1,
        exportedAt: "2026-10-01T00:00:00.000Z",
        storage: {
          [STORAGE_KEY]: { schemaVersion: 1, progressByName: {} },
          [UI_STORAGE_KEY]: null,
          [CONNECT_RANK_CALC_STORAGE_KEY]: null,
        },
      }),
    ).toThrow(StaleDeviceDataError);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(`before:${STORAGE_KEY}`);
    expect(window.localStorage.getItem(UI_STORAGE_KEY)).toBe(`before:${UI_STORAGE_KEY}`);
    expect(window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY)).toBe(`before:${CONNECT_RANK_CALC_STORAGE_KEY}`);
  });

  it("epoch が一致していればバックアップを復元できる", () => {
    applyBackupPayloadToLocalStorage({
      formatVersion: 1,
      exportedAt: "2026-10-01T00:00:00.000Z",
      storage: {
        [STORAGE_KEY]: { schemaVersion: 1, progressByName: {} },
        [UI_STORAGE_KEY]: null,
      },
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{"schemaVersion":1,"progressByName":{}}');
  });
});
