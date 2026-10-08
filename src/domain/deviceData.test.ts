import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("deviceData: 起動時に epoch を保存できない環境", () => {
  // epoch キーの新規作成だけが失敗する状態（容量制限で新しいキーは追加できないが、既存キーの更新は通る）を作る。
  // 戻り値の関数で失敗を止める（容量が空いた状態を再現する）。
  function failEpochKeyCreation() {
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === DEVICE_DATA_EPOCH_STORAGE_KEY) {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      original.call(this, key, value);
    });
    return () => spy.mockRestore();
  }

  // 起動時（モジュール読み込み時）に epoch の保存が失敗したタブを、別のモジュール状態として読み込む。
  async function importTabWithFailedEpoch() {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
    return await import("./deviceData");
  }

  it("読み込み時に保存が失敗しても例外を投げず、容量が空くまでの保存は失敗として知らせる", async () => {
    const stopFailing = failEpochKeyCreation();
    const tab = await importTabWithFailedEpoch();
    const listener = vi.fn();
    tab.subscribeDeviceDataSaveProblem(listener);

    // 既存キーの更新自体は通る状態でも、epoch を確定できないので書き込まず、無言で捨てずに知らせる。
    expect(tab.writeDeviceStorage(STORAGE_KEY, "edited")).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(tab.getDeviceDataSaveProblem()).toBe("storage_error");
    expect(listener).toHaveBeenCalled();
    stopFailing();
  });

  it("初期化失敗後、epoch キーが存在しないまま容量が空けば次の保存で回復する", async () => {
    const stopFailing = failEpochKeyCreation();
    const tab = await importTabWithFailedEpoch();
    expect(tab.writeDeviceStorage(STORAGE_KEY, "edited")).toBe(false);
    expect(tab.getDeviceDataSaveProblem()).toBe("storage_error");

    // 容量が空いた。
    stopFailing();
    expect(tab.writeDeviceStorage(STORAGE_KEY, "edited-again")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("edited-again");
    expect(window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY)).not.toBeNull();
    expect(tab.isDeviceDataEpochCurrent()).toBe(true);
    expect(tab.getDeviceDataSaveProblem()).toBe("none");
  });

  it("初期化失敗後に epoch キーが存在する場合は控えに採用せず、保存せずに再読み込みを求める", async () => {
    const stopFailing = failEpochKeyCreation();
    const tab = await importTabWithFailedEpoch();
    stopFailing();
    // 起動後に別のタブが epoch キーを作成した（その前後で端末データが変わった可能性を否定できない）。
    window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, "other-tab");
    window.localStorage.setItem(STORAGE_KEY, "other-tab-data");

    expect(tab.writeDeviceStorage(STORAGE_KEY, "stale-edit")).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("other-tab-data");
    expect(window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY)).toBe("other-tab");
    expect(tab.getDeviceDataSaveProblem()).toBe("reload_required");
    // 容量があっても、このタブのうちは回復しない（再読み込みで控え直す）。
    expect(tab.isDeviceDataEpochCurrent()).toBe(false);
  });

  it("読み込み時に localStorage の読み取りが失敗しても例外を投げない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.resetModules();
    const tab = await import("./deviceData");
    getItemSpy.mockRestore();
    expect(tab.getDeviceDataSaveProblem()).toBe("none");
  });

  it("書き込みが容量超過で失敗したら知らせ、そのキーの保存が成功したら解消する", async () => {
    vi.resetModules();
    const tab = await import("./deviceData");
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === STORAGE_KEY) {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      original.call(this, key, value);
    });
    expect(() => tab.writeDeviceStorage(STORAGE_KEY, "big")).toThrow();
    expect(tab.getDeviceDataSaveProblem()).toBe("storage_error");
    // 別のキーの保存が成功しても、育成データが保存されるまでは解消しない。
    expect(tab.writeDeviceStorage(UI_STORAGE_KEY, "ui")).toBe(true);
    expect(tab.getDeviceDataSaveProblem()).toBe("storage_error");

    spy.mockRestore();
    expect(tab.writeDeviceStorage(STORAGE_KEY, "small")).toBe(true);
    expect(tab.getDeviceDataSaveProblem()).toBe("none");
  });

  it("端末データを削除したら保存失敗の案内は解消し、失敗した値も書かれない", async () => {
    vi.resetModules();
    const tab = await import("./deviceData");
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === STORAGE_KEY) {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      original.call(this, key, value);
    });
    expect(() => tab.writeDeviceStorage(STORAGE_KEY, "previous-user-edit")).toThrow();
    spy.mockRestore();

    tab.clearDeviceUserData();
    expect(tab.getDeviceDataSaveProblem()).toBe("none");
    expect(tab.writeDeviceStorage(LOCAL_DATA_OWNER_STORAGE_KEY, "owner")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("保存に失敗した値は覚えておかず、別のキーの保存が成功しても書き込まない（その間に別のタブで所有者が変わっても古い値で上書きしない）", async () => {
    vi.resetModules();
    const tab = await import("./deviceData");
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === STORAGE_KEY) {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      original.call(this, key, value);
    });
    expect(() => tab.writeDeviceStorage(STORAGE_KEY, "old-pending-edit")).toThrow();
    spy.mockRestore();

    // 容量が空いた後に別のキーの保存が成功しても、失敗した値は書かれない（失敗中のまま案内を続ける）。
    expect(tab.writeDeviceStorage(UI_STORAGE_KEY, "ui")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(tab.getDeviceDataSaveProblem()).toBe("storage_error");

    // 別のタブが所有者を変えて新しいデータを書いた後は、このタブからは何も書き込めない。
    window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, "other-tab");
    window.localStorage.setItem(STORAGE_KEY, "new-owner-data");
    window.localStorage.setItem(LOCAL_DATA_OWNER_STORAGE_KEY, "new-owner");
    expect(tab.writeDeviceStorage(UI_STORAGE_KEY, "ui-2")).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("new-owner-data");
    expect(window.localStorage.getItem(LOCAL_DATA_OWNER_STORAGE_KEY)).toBe("new-owner");
  });

  it("1→2→1 と戻した編集は、容量が空いた後に 2 が復活しない", async () => {
    // 保存済みの値は 1。
    window.localStorage.setItem(STORAGE_KEY, "1");
    const stopFailing = failEpochKeyCreation();
    const tab = await importTabWithFailedEpoch();

    // 2 は保存できない。
    expect(tab.writeDeviceStorage(STORAGE_KEY, "2")).toBe(false);
    expect(tab.getDeviceDataSaveProblem()).toBe("storage_error");
    // 1 に戻すと、保存済みの値と一致するので失われる変更はない。
    expect(tab.writeDeviceStorage(STORAGE_KEY, "1")).toBe(false);
    expect(tab.getDeviceDataSaveProblem()).toBe("none");

    // 容量が空いて別のキーの保存が成功しても、2 は書かれない。
    stopFailing();
    expect(tab.writeDeviceStorage(UI_STORAGE_KEY, "ui")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});
