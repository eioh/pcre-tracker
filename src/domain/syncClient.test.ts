import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { masterCharacters } from "./master";
import { buildInitialState } from "./storage";
import { CONNECT_RANK_CALC_STORAGE_KEY, STORAGE_KEY } from "./storageKeys";
import { SYNC_FORMAT_VERSION, type SyncPayloadV1 } from "./sync";
import {
  buildSyncPayload,
  buildSyncPayloadFromCurrent,
  decideStartupAction,
  fetchServerData,
  hasLocalRealData,
  isSafeToAutoAdopt,
  putServerData,
  type LocalStateSnapshot,
} from "./syncClient";
import type { StoredStateV1 } from "./types";

// 検証済みの最小 SyncPayloadV1 を生成するヘルパー。
function makePayload(): SyncPayloadV1 {
  return {
    formatVersion: SYNC_FORMAT_VERSION,
    storage: {
      [STORAGE_KEY]: buildInitialState(masterCharacters),
      [CONNECT_RANK_CALC_STORAGE_KEY]: { schemaVersion: 1, entries: [] },
    },
  };
}

describe("buildSyncPayload", () => {
  it("in-memory state と計算タブ状態から SyncPayloadV1 を構築する", () => {
    const state = buildInitialState(masterCharacters);
    const calc = { schemaVersion: 1 as const, entries: [{ characterName: "ペコリーヌ", targetRank: 10 }] };
    const payload = buildSyncPayload(state, calc);
    expect(payload.formatVersion).toBe(SYNC_FORMAT_VERSION);
    expect(payload.storage[STORAGE_KEY]).toBe(state);
    expect(payload.storage[CONNECT_RANK_CALC_STORAGE_KEY]).toBe(calc);
  });

  it("buildSyncPayloadFromCurrent は正規化を通った計算タブ状態を含む（localStorage の raw 値からは構築しない）", () => {
    window.localStorage.clear();
    // 不正な計算タブデータを localStorage に置いても、読み込み時正規化でデフォルトへ補正されることを確認する。
    window.localStorage.setItem(CONNECT_RANK_CALC_STORAGE_KEY, "not json");
    const state = buildInitialState(masterCharacters);
    const payload = buildSyncPayloadFromCurrent(state);
    expect(payload.storage[CONNECT_RANK_CALC_STORAGE_KEY]).toEqual({ schemaVersion: 1, entries: [] });
  });
});

describe("hasLocalRealData", () => {
  const initialState = buildInitialState(masterCharacters);
  const defaultCalc = { schemaVersion: 1 as const, entries: [] };

  it("touched フラグがあれば初期状態でも実データありと確定する", () => {
    const snapshot: LocalStateSnapshot = { touched: true, storedState: initialState, calcState: defaultCalc };
    expect(hasLocalRealData(snapshot, masterCharacters)).toBe(true);
  });

  it("touched なし & 育成データ初期 & 計算タブデフォルト なら初期状態と判定する", () => {
    const snapshot: LocalStateSnapshot = { touched: false, storedState: initialState, calcState: defaultCalc };
    expect(hasLocalRealData(snapshot, masterCharacters)).toBe(false);
  });

  it("touched なしでも育成データが初期と異なれば実データありと判定する", () => {
    const edited: StoredStateV1 = {
      ...initialState,
      progressByName: {
        ...initialState.progressByName,
        [masterCharacters[0]!.name]: { ...initialState.progressByName[masterCharacters[0]!.name]!, owned: true },
      },
    };
    const snapshot: LocalStateSnapshot = { touched: false, storedState: edited, calcState: defaultCalc };
    expect(hasLocalRealData(snapshot, masterCharacters)).toBe(true);
  });

  it("touched なしでも計算タブにエントリがあれば実データありと判定する", () => {
    const snapshot: LocalStateSnapshot = {
      touched: false,
      storedState: initialState,
      calcState: { schemaVersion: 1, entries: [{ characterName: "ペコリーヌ", targetRank: 10 }] },
    };
    expect(hasLocalRealData(snapshot, masterCharacters)).toBe(true);
  });
});

describe("decideStartupAction", () => {
  it("サーバー空 & ローカル実データあり → upload_new（引き継ぎ分岐 1）", () => {
    expect(
      decideStartupAction({ fetchResult: { kind: "not_found" }, knownRevision: null, dirty: false, localHasRealData: true }),
    ).toBe("upload_new");
  });

  it("サーバー空 & ローカル初期 → noop", () => {
    expect(
      decideStartupAction({ fetchResult: { kind: "not_found" }, knownRevision: null, dirty: false, localHasRealData: false }),
    ).toBe("noop");
  });

  it("初回ログイン & サーバーあり & ローカル初期 → adopt_server（引き継ぎ分岐 2）", () => {
    expect(
      decideStartupAction({ fetchResult: { kind: "found", revision: 3 }, knownRevision: null, dirty: false, localHasRealData: false }),
    ).toBe("adopt_server");
  });

  it("初回ログイン & サーバーあり & ローカル実データあり → conflict（引き継ぎ分岐 3。自動マージ禁止）", () => {
    expect(
      decideStartupAction({ fetchResult: { kind: "found", revision: 3 }, knownRevision: null, dirty: false, localHasRealData: true }),
    ).toBe("conflict");
  });

  it("同期メタあり & revision 一致 & dirty でない → noop", () => {
    expect(
      decideStartupAction({ fetchResult: { kind: "found", revision: 5 }, knownRevision: 5, dirty: false, localHasRealData: true }),
    ).toBe("noop");
  });

  it("同期メタあり & revision 一致 & dirty → put_dirty", () => {
    expect(
      decideStartupAction({ fetchResult: { kind: "found", revision: 5 }, knownRevision: 5, dirty: true, localHasRealData: true }),
    ).toBe("put_dirty");
  });

  it("同期メタあり & revision 不一致 & dirty でない → adopt_server（他端末更新の黙って採用）", () => {
    expect(
      decideStartupAction({ fetchResult: { kind: "found", revision: 6 }, knownRevision: 5, dirty: false, localHasRealData: true }),
    ).toBe("adopt_server");
  });

  it("同期メタあり & revision 不一致 & dirty → conflict", () => {
    expect(
      decideStartupAction({ fetchResult: { kind: "found", revision: 6 }, knownRevision: 5, dirty: true, localHasRealData: true }),
    ).toBe("conflict");
  });
});

describe("isSafeToAutoAdopt", () => {
  it("判定時と現在の seq が一致すれば自動採用してよい", () => {
    expect(isSafeToAutoAdopt(3, 3)).toBe(true);
  });

  it("seq が進んでいたら（採用直前に編集が入っていたら）自動採用しない", () => {
    expect(isSafeToAutoAdopt(3, 4)).toBe(false);
  });
});

describe("fetchServerData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("404 は not_found を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const result = await fetchServerData();
    expect(result.kind).toBe("not_found");
  });

  it("401 は unauthorized を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const result = await fetchServerData();
    expect(result.kind).toBe("unauthorized");
  });

  it("200 で妥当な body なら found を返し payload を検証する", async () => {
    const body = { revision: 7, payload: makePayload(), updatedAt: "2026-07-04T00:00:00.000Z" };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
    const result = await fetchServerData();
    expect(result).toMatchObject({ kind: "found", revision: 7, updatedAt: "2026-07-04T00:00:00.000Z" });
  });

  it("payload が不正なら error を返す", async () => {
    const body = { revision: 7, payload: { broken: true }, updatedAt: "2026-07-04T00:00:00.000Z" };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
    const result = await fetchServerData();
    expect(result.kind).toBe("error");
  });

  it("ネットワーク障害は error(status:0) を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network");
    }));
    const result = await fetchServerData();
    expect(result).toEqual({ kind: "error", status: 0 });
  });
});

describe("putServerData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Content-Type: application/json を付与し baseRevision と payload を送る", async () => {
    const fetchMock = vi.fn(async () => Response.json({ revision: 2, updatedAt: "2026-07-04T00:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchMock);
    const payload = makePayload();
    const result = await putServerData(1, payload);
    expect(result).toEqual({ kind: "ok", revision: 2, updatedAt: "2026-07-04T00:00:00.000Z" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).headers).toMatchObject({ "Content-Type": "application/json" });
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.baseRevision).toBe(1);
    expect(sentBody.payload.formatVersion).toBe(SYNC_FORMAT_VERSION);
  });

  it("409 は conflict を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 409 })));
    const result = await putServerData(1, makePayload());
    expect(result.kind).toBe("conflict");
  });

  it("401 は unauthorized を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const result = await putServerData(1, makePayload());
    expect(result.kind).toBe("unauthorized");
  });

  it("baseRevision:null は初回アップロードとして送る", async () => {
    const fetchMock = vi.fn(async () => Response.json({ revision: 1, updatedAt: "2026-07-04T00:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchMock);
    await putServerData(null, makePayload());
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(sentBody.baseRevision).toBeNull();
  });
});

// テスト間で localStorage を汚さないようにする。
beforeEach(() => {
  window.localStorage.clear();
});
