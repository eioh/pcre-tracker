import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// authClient の useSession をテストから差し替えられるようモック化する。
// authClient は SyncHeader（DOM 統合テスト用ハーネス）が import するためスタブを含める。
const mockUseSession = vi.fn();
// signOut の戻り値（成功/失敗）をテストから制御する。
const mockSignOut = vi.fn();
vi.mock("../lib/authClient", () => ({
  authClient: { deleteUser: vi.fn() },
  useSession: () => mockUseSession(),
  signIn: { social: vi.fn() },
  signOut: () => mockSignOut(),
}));

import { masterCharacters } from "../domain/master";
import { buildInitialState, saveStoredState } from "../domain/storage";
import { isDeviceDataEpochCurrent } from "../domain/deviceData";
import {
  CONNECT_RANK_CALC_STORAGE_KEY,
  DEVICE_DATA_EPOCH_STORAGE_KEY,
  STORAGE_KEY,
  TOUCHED_STORAGE_KEY,
  UI_STORAGE_KEY,
} from "../domain/storageKeys";
import { SYNC_FORMAT_VERSION, type SyncPayloadV1 } from "../domain/sync";
import { loadLocalDataOwner, loadSyncMeta, saveLocalDataOwner, saveSyncMeta } from "../domain/syncMeta";
import { useSync } from "./useSync";
import { SyncHeader } from "../components/SyncHeader";
import type { StoredStateV1 } from "../domain/types";

// ログイン済みセッションを返すよう mockUseSession を設定する。
function setLoggedIn(userId: string) {
  mockUseSession.mockReturnValue({
    data: { user: { id: userId, email: "e@example.com", name: "テスト" } },
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
  });
}

// 未ログインセッションを返すよう設定する。
function setLoggedOut() {
  mockUseSession.mockReturnValue({ data: null, isPending: false, isRefetching: false, error: null, refetch: vi.fn() });
}

// サーバー応答用の SyncPayloadV1 を作る。
function makeServerPayload(): SyncPayloadV1 {
  return {
    formatVersion: SYNC_FORMAT_VERSION,
    storage: {
      [STORAGE_KEY]: buildInitialState(masterCharacters),
      [CONNECT_RANK_CALC_STORAGE_KEY]: { schemaVersion: 1, entries: [] },
    },
  };
}

// useSync を既定オプションで描画するヘルパー。
function renderUseSync(state: StoredStateV1) {
  const onServerDataAdopted = vi.fn();
  const onLocalDataCleared = vi.fn();
  const result = renderHook(() =>
    useSync({ getState: () => state, masterCharacters, onServerDataAdopted, onLocalDataCleared }),
  );
  return { ...result, onServerDataAdopted, onLocalDataCleared };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
  mockUseSession.mockReset();
  mockSignOut.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSync: アカウント切替（userId 不一致）", () => {
  it("別のアカウントの実データが残っていれば確認を出し、前のアカウントのメタを残して自動 PUT しない", async () => {
    // 別アカウント u_old のメタが端末に残っている状況（所有者キーのない旧版端末）。
    saveSyncMeta({ userId: "u_old", revision: 4, localChangeSeq: 2, lastSyncedSeq: 2 });
    // 現在の localStorage には実データを持つ（touched を立てて確実に実データ扱いにする）。
    const state = buildInitialState(masterCharacters);
    window.localStorage.setItem("pcr_growth_tracker_touched", "1");
    saveStoredState(state);

    // サーバー（新アカウント u_new）にはデータがある。
    const putSpy = vi.fn();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method === "GET") {
        return Response.json({ revision: 9, payload: makeServerPayload(), updatedAt: "2026-07-04T00:00:00.000Z" });
      }
      putSpy();
      return Response.json({ revision: 10, updatedAt: "2026-07-04T00:00:00.000Z" });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u_new");
    const { result, onServerDataAdopted } = renderUseSync(state);

    // 確認ダイアログ情報が提示され、自動 PUT・採用・競合ダイアログは発生しない。
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());
    expect(result.current.accountSwitch?.userId).toBe("u_new");
    expect(result.current.accountSwitch?.server).toMatchObject({ kind: "found", revision: 9 });
    expect(result.current.conflict).toBeNull();
    expect(putSpy).not.toHaveBeenCalled();
    expect(onServerDataAdopted).not.toHaveBeenCalled();
    // 利用者が選ぶまで、前アカウントのメタと所有者は変えない。
    expect(loadSyncMeta()).toEqual({ userId: "u_old", revision: 4, localChangeSeq: 2, lastSyncedSeq: 2 });
    expect(loadLocalDataOwner()).toBe("u_old");
  });
});

describe("useSync: PUT 中の後続編集は dirty のまま残る（seq 競合）", () => {
  it("PUT 開始時 seq のみ lastSyncedSeq に記録し、PUT 中の編集分は次回へ持ち越す", async () => {
    // 同期済みメタ（revision 一致・dirty でない）から開始する。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);

    // GET は revision 一致を返す。PUT は解決を制御できる Promise にする。
    let resolvePut: ((r: Response) => void) | null = null;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method === "GET") {
        return Response.json({ revision: 3, payload: makeServerPayload(), updatedAt: "2026-07-04T00:00:00.000Z" });
      }
      // PUT: 外部から解決するまで待たせる。
      return new Promise<Response>((resolve) => {
        resolvePut = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u1");
    const { result } = renderUseSync(state);

    // 起動フロー（GET）完了までメタが revision 一致で確立するのを待つ。
    await waitFor(() => expect(loadSyncMeta()?.userId).toBe("u1"));

    // 1 回目の編集 → localChangeSeq=1。デバウンスを待たず即 flush するため直接 runPut 相当を起こす。
    // ここではデバウンスを待たずに検証するため、notifyLocalChange 後に手動でタイマーを進める。
    vi.useFakeTimers();
    act(() => {
      result.current.notifyLocalChange();
    });
    expect(loadSyncMeta()?.localChangeSeq).toBe(1);

    // デバウンス満了で PUT 開始（seqBeingSent = 1）。
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    // PUT がまだ解決していないうちに 2 回目の編集 → localChangeSeq=2。
    act(() => {
      result.current.notifyLocalChange();
    });
    expect(loadSyncMeta()?.localChangeSeq).toBe(2);

    // PUT を成功で解決する（seqBeingSent=1 のみ lastSyncedSeq に記録されるべき）。
    vi.useRealTimers();
    await act(async () => {
      resolvePut?.(Response.json({ revision: 4, updatedAt: "2026-07-04T00:00:00.000Z" }));
      // マイクロタスクを流す。
      await Promise.resolve();
    });

    await waitFor(() => {
      const meta = loadSyncMeta();
      // 送ったのは seq=1 まで。localChangeSeq=2 は残り、lastSyncedSeq=1 なので dirty のまま。
      expect(meta?.lastSyncedSeq).toBe(1);
      expect(meta?.localChangeSeq).toBe(2);
      expect(meta?.revision).toBe(4);
    });
  });
});

describe("useSync: GET 中のアカウント切替（stale closure 回帰）", () => {
  it("GET 待ち中に別アカウントへ切り替わったら、旧フローの結果を採用せずメタも書かない", async () => {
    // u1 のメタあり（revision 5・clean）。GET が revision 6 を返せば「黙って採用」に進む状況を作る。
    saveSyncMeta({ userId: "u1", revision: 5, localChangeSeq: 0, lastSyncedSeq: 0 });
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);

    // サーバー payload は採用されたか判別できるよう計算タブにエントリを持たせる。
    const serverPayload: SyncPayloadV1 = {
      formatVersion: SYNC_FORMAT_VERSION,
      storage: {
        [STORAGE_KEY]: buildInitialState(masterCharacters),
        [CONNECT_RANK_CALC_STORAGE_KEY]: { schemaVersion: 1, entries: [{ characterName: "ペコリーヌ", targetRank: 10 }] },
      },
    };

    // 1 回目の GET（u1 の起動フロー）は外部から解決するまで待たせる。2 回目以降（u2 のフロー）は 404。
    let resolveFirstGet: ((r: Response) => void) | null = null;
    let getCallCount = 0;
    const putSpy = vi.fn();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        getCallCount += 1;
        if (getCallCount === 1) {
          return new Promise<Response>((resolve) => {
            resolveFirstGet = resolve;
          });
        }
        return new Response(null, { status: 404 });
      }
      putSpy();
      return Response.json({ revision: 99, updatedAt: "2026-07-04T00:00:00.000Z" });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u1");
    const { rerender, onServerDataAdopted } = renderUseSync(state);

    // u1 の起動フローが GET を発行し待機状態になるのを待つ。
    await waitFor(() => expect(getCallCount).toBe(1));

    // GET 待ち中に u2 へアカウント切替（rerender で新セッションを反映）。
    setLoggedIn("u2");
    rerender();

    // u2 の起動フロー: メタの userId 不一致 → メタ破棄 → GET(404) → ローカル初期なので noop。
    await waitFor(() => expect(getCallCount).toBe(2));

    // ここで u1 フローの GET を「revision 6 で採用すべきデータあり」として解決する。
    await act(async () => {
      resolveFirstGet?.(Response.json({ revision: 6, payload: serverPayload, updatedAt: "2026-07-04T00:00:00.000Z" }));
      await Promise.resolve();
    });

    // 旧アカウント（u1）文脈の結果は一切反映されないこと:
    // - サーバーデータ採用（リロード要求）が起きない
    // - u1 の revision でメタが書かれない（u2 フローが破棄したまま null）
    // - サーバー payload が localStorage に書かれない
    // - 自動 PUT も起きない
    expect(onServerDataAdopted).not.toHaveBeenCalled();
    expect(loadSyncMeta()).toBeNull();
    expect(window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY)).toBeNull();
    expect(putSpy).not.toHaveBeenCalled();
  });
});

describe("useSync: インポート時は PUT を予約しない（stale state PUT 回帰）", () => {
  it("notifyLocalDataImported は永続 dirty 化のみ行い、予約済み PUT もキャンセルする", async () => {
    // 同期済みメタ（revision 3・clean）から開始する。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);

    const putSpy = vi.fn();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return Response.json({ revision: 3, payload: makeServerPayload(), updatedAt: "2026-07-04T00:00:00.000Z" });
      }
      putSpy();
      return Response.json({ revision: 4, updatedAt: "2026-07-04T00:00:00.000Z" });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u1");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(loadSyncMeta()?.userId).toBe("u1"));

    vi.useFakeTimers();
    // 通常編集で PUT が予約された状態を作る（seq=1）。
    act(() => {
      result.current.notifyLocalChange();
    });
    expect(loadSyncMeta()?.localChangeSeq).toBe(1);

    // インポート発生（seq=2 へ永続 dirty 化 + 予約済み PUT のキャンセル）。
    act(() => {
      result.current.notifyLocalDataImported();
    });
    expect(loadSyncMeta()?.localChangeSeq).toBe(2);

    // デバウンス時間を大きく超えて進めても PUT は発火しない（旧 in-memory state での上書き・送信が起きない）。
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    vi.useRealTimers();
    expect(putSpy).not.toHaveBeenCalled();

    // dirty は localStorage に永続化されており、リロード後の起動フローで同期される。
    const meta = loadSyncMeta();
    expect(meta?.localChangeSeq).toBe(2);
    expect(meta?.lastSyncedSeq).toBe(0);
  });

  it("リロード後の起動フローが dirty を検出し、インポート済み localStorage のデータを PUT する", async () => {
    // 「インポート → リロード後」の状態を再現する: メタは dirty（seq=1 > lastSynced=0）で永続化済み、
    // localStorage にはインポート済みデータ（計算タブにエントリあり）が入っている。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 1, lastSyncedSeq: 0 });
    const importedCalc = { schemaVersion: 1 as const, entries: [{ characterName: "ペコリーヌ", targetRank: 12 }] };
    window.localStorage.setItem(CONNECT_RANK_CALC_STORAGE_KEY, JSON.stringify(importedCalc));
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);

    // GET は revision 一致（3）→ dirty なので put_dirty 分岐 → PUT。
    let putBody: unknown = null;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return Response.json({ revision: 3, payload: makeServerPayload(), updatedAt: "2026-07-04T00:00:00.000Z" });
      }
      putBody = JSON.parse((init as RequestInit).body as string);
      return Response.json({ revision: 4, updatedAt: "2026-07-04T00:00:00.000Z" });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u1");
    renderUseSync(state);

    // 起動フローが dirty を検出して PUT し、インポート済みの計算タブデータが送られる。
    await waitFor(() => expect(putBody).not.toBeNull());
    const body = putBody as { baseRevision: number; payload: SyncPayloadV1 };
    expect(body.baseRevision).toBe(3);
    expect(body.payload.storage[CONNECT_RANK_CALC_STORAGE_KEY]).toEqual(importedCalc);

    // PUT 成功でメタが同期済みへ更新される。
    await waitFor(() => {
      const meta = loadSyncMeta();
      expect(meta?.revision).toBe(4);
      expect(meta?.lastSyncedSeq).toBe(1);
    });
  });
});

describe("useSync: noop 分岐は GET 中の編集を巻き戻さない（stale メタ書き戻し回帰）", () => {
  it("GET 中に進んだ localChangeSeq を保持し、lastSyncedSeq を進めない", async () => {
    // 同期済みメタ（revision 3・clean）。GET は revision 一致（noop 分岐へ進む）。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);

    // GET を外部から解決するまで待たせる。
    let resolveGet: ((r: Response) => void) | null = null;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Promise<Response>((resolve) => {
          resolveGet = resolve;
        });
      }
      return Response.json({ revision: 4, updatedAt: "2026-07-04T00:00:00.000Z" });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u1");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(resolveGet).not.toBeNull());

    // GET 待ち中にユーザー編集が入る（seq=1・dirty 化）。
    act(() => {
      result.current.notifyLocalChange();
    });
    expect(loadSyncMeta()).toMatchObject({ localChangeSeq: 1, lastSyncedSeq: 0 });

    // GET を revision 一致で解決 → noop 分岐へ。
    await act(async () => {
      resolveGet?.(Response.json({ revision: 3, payload: makeServerPayload(), updatedAt: "2026-07-04T00:00:00.000Z" }));
      await Promise.resolve();
    });

    // GET 中の編集（seq=1）が保持され、lastSyncedSeq は進まない（= dirty のまま。予約済み PUT で同期される）。
    await waitFor(() => {
      const meta = loadSyncMeta();
      expect(meta?.localChangeSeq).toBe(1);
      expect(meta?.lastSyncedSeq).toBe(0);
      expect(meta?.revision).toBe(3);
    });
  });
});

describe("useSync: 409 後の競合 GET 中のアカウント切替（presentConflictFromServer 回帰）", () => {
  it("409 → 競合 GET 待ち中に別アカウントへ切り替わったら、旧文脈の競合を提示しない", async () => {
    // u1 の同期済みメタ（revision 3・clean）。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);

    // GET#1（u1 起動フロー）= revision 一致 / PUT = 409 / GET#2（競合再取得）= 保留 / GET#3（u2 起動フロー）= 404。
    let resolveConflictGet: ((r: Response) => void) | null = null;
    let getCallCount = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        getCallCount += 1;
        if (getCallCount === 1) {
          return Response.json({ revision: 3, payload: makeServerPayload(), updatedAt: "2026-07-04T00:00:00.000Z" });
        }
        if (getCallCount === 2) {
          return new Promise<Response>((resolve) => {
            resolveConflictGet = resolve;
          });
        }
        return new Response(null, { status: 404 });
      }
      return new Response(null, { status: 409 });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u1");
    const { result, rerender } = renderUseSync(state);
    await waitFor(() => expect(loadSyncMeta()?.userId).toBe("u1"));

    // 編集 → デバウンス満了 → PUT(409) → 競合再取得 GET#2 が保留になる。
    vi.useFakeTimers();
    act(() => {
      result.current.notifyLocalChange();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    vi.useRealTimers();
    expect(getCallCount).toBe(2);

    // 競合 GET 待ち中に u2 へアカウント切替。
    setLoggedIn("u2");
    rerender();
    await waitFor(() => expect(getCallCount).toBe(3));

    // 保留していた競合 GET を「採用すべきサーバーデータあり」で解決する。
    await act(async () => {
      resolveConflictGet?.(Response.json({ revision: 5, payload: makeServerPayload(), updatedAt: "2026-07-04T00:00:00.000Z" }));
      await Promise.resolve();
    });

    // 旧アカウント（u1）文脈の競合は提示されない（提示されるとユーザー解決経由で
    // 旧アカウント由来 payload の採用や新アカウントへの PUT につながる）。
    expect(result.current.conflict).toBeNull();
  });

  it("競合表示中にアカウントが切り替わったら、解決操作は何もせず競合をクリアするだけ", async () => {
    // u1 の dirty メタ + サーバー revision 不一致で競合ダイアログが出る状況。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 1, lastSyncedSeq: 0 });
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);

    // 採用されたか判別できるサーバー payload（計算タブにエントリあり）。
    const serverPayload: SyncPayloadV1 = {
      formatVersion: SYNC_FORMAT_VERSION,
      storage: {
        [STORAGE_KEY]: buildInitialState(masterCharacters),
        [CONNECT_RANK_CALC_STORAGE_KEY]: { schemaVersion: 1, entries: [{ characterName: "ペコリーヌ", targetRank: 10 }] },
      },
    };

    let getCallCount = 0;
    const putSpy = vi.fn();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        getCallCount += 1;
        if (getCallCount === 1) {
          // u1 起動フロー: revision 不一致 & dirty → 競合。
          return Response.json({ revision: 5, payload: serverPayload, updatedAt: "2026-07-04T00:00:00.000Z" });
        }
        // u2 起動フロー: サーバー空。
        return new Response(null, { status: 404 });
      }
      putSpy();
      return Response.json({ revision: 6, updatedAt: "2026-07-04T00:00:00.000Z" });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u1");
    const { result, rerender, onServerDataAdopted } = renderUseSync(state);
    await waitFor(() => expect(result.current.conflict).not.toBeNull());
    expect(result.current.conflict?.userId).toBe("u1");

    // 競合ダイアログ表示中に u2 へアカウント切替（u2 の起動フローも完了させる）。
    setLoggedIn("u2");
    rerender();
    await waitFor(() => expect(getCallCount).toBe(2));

    // 旧文脈（u1）の競合に対して「サーバーのデータを使う」を実行しても、何も採用されない。
    act(() => {
      result.current.resolveConflictUseServer();
    });
    expect(onServerDataAdopted).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY)).toBeNull();
    expect(result.current.conflict).toBeNull();

    // 「この端末のデータを使う」も同様に PUT しない（conflict クリア済みでも旧文脈 PUT が出ないことを確認）。
    await act(async () => {
      await result.current.resolveConflictUseLocal();
    });
    expect(putSpy).not.toHaveBeenCalled();
  });
});

describe("useSync: インポート時に in-flight PUT の完了処理を無効化する（世代カウンタ回帰）", () => {
  it("PUT 実行中にインポートが入ったら、完了処理（メタ書き込み・再予約）を中断しインポート結果を守る", async () => {
    // u1 の同期済みメタ（revision 3・clean）。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);

    // GET = revision 一致。PUT は解決を制御し、呼び出し回数を数える。
    let resolvePut: ((r: Response) => void) | null = null;
    let putCallCount = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return Response.json({ revision: 3, payload: makeServerPayload(), updatedAt: "2026-07-04T00:00:00.000Z" });
      }
      putCallCount += 1;
      return new Promise<Response>((resolve) => {
        resolvePut = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    setLoggedIn("u1");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(loadSyncMeta()?.userId).toBe("u1"));

    // 編集（seq=1）→ デバウンス満了 → PUT 開始（in-flight）。
    vi.useFakeTimers();
    act(() => {
      result.current.notifyLocalChange();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(putCallCount).toBe(1);

    // PUT 実行中にインポートが発生（世代が進む・seq=2 へ永続 dirty 化）。
    act(() => {
      result.current.notifyLocalDataImported();
    });
    // インポートによる localStorage 直接書き換えを再現する（判別用マーカー）。
    const importedMarker = JSON.stringify({ imported: true });
    window.localStorage.setItem(STORAGE_KEY, importedMarker);

    // in-flight だった PUT を成功で解決する。
    await act(async () => {
      resolvePut?.(Response.json({ revision: 4, updatedAt: "2026-07-04T00:00:00.000Z" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    // 完了処理は世代不一致で中断される: メタは書かれず（revision 3・lastSyncedSeq 0 のまま）、
    // 「後続編集あり → 再予約」も起きない。
    const meta = loadSyncMeta();
    expect(meta?.revision).toBe(3);
    expect(meta?.lastSyncedSeq).toBe(0);
    expect(meta?.localChangeSeq).toBe(2);

    // デバウンス時間を大きく進めても 2 回目の PUT（旧 in-memory state の saveStoredState を伴う）は発火せず、
    // インポート済みの localStorage が上書きされない。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    vi.useRealTimers();
    expect(putCallCount).toBe(1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(importedMarker);
  });
});

describe("useSync: 未ログイン時は同期通信ゼロ", () => {
  it("未ログインでは /api/data への fetch が一切発生しない", async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    setLoggedOut();
    const state = buildInitialState(masterCharacters);
    const { result } = renderUseSync(state);

    // 未ログイン時に編集しても通信は発生しない（ローカルモード維持）。
    act(() => {
      result.current.notifyLocalChange();
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("logged_out");
  });
});

describe("useSync: userLabel の PII 是正（email 形式の表示名）", () => {
  // useSync の userLabel を実際に SyncHeader へ渡して描画する DOM 統合ハーネス。
  function HeaderHarness({ state }: { state: StoredStateV1 }) {
    const sync = useSync({
      getState: () => state,
      masterCharacters,
      onServerDataAdopted: vi.fn(),
      onLocalDataCleared: vi.fn(),
    });
    return (
      <SyncHeader
        isLoggedIn={sync.isLoggedIn}
        isSessionPending={sync.isSessionPending}
        userLabel={sync.userLabel}
        status={sync.status}
        onOpenPrivacyPolicy={vi.fn()}
        onDeleteRequestStart={vi.fn()}
        onBeforeAccountDeleted={vi.fn()}
        onLogoutStart={vi.fn()}
        onDeleteDeviceData={vi.fn()}
        hasUnsyncedChanges={sync.hasUnsyncedChanges}
      />
    );
  }

  it("表示名が email 形式なら userLabel は null になる", () => {
    // GitHub/Google の表示名はユーザー設定次第でメールアドレスと同一文字列になり得る。
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", email: "user@example.com", name: "user@example.com" } },
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    const state = buildInitialState(masterCharacters);
    const { result } = renderUseSync(state);
    expect(result.current.userLabel).toBeNull();
  });

  it("表示名が email 形式のとき DOM に email が出ず汎用表記「ログイン中」になる", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", email: "user@example.com", name: "user@example.com" } },
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });
    // サーバー空（404）→ ローカル初期状態 → noop で同期フローは静かに完了する。
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    const state = buildInitialState(masterCharacters);
    render(<HeaderHarness state={state} />);

    // 汎用表記が表示され、email（@ を含む文字列）は DOM に一切現れない。
    await waitFor(() => expect(screen.getByText("ログイン中")).toBeInTheDocument());
    expect(document.body.textContent ?? "").not.toMatch(/@/);
  });

  it("表示名が通常の文字列ならそのまま userLabel に使う", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", email: "user@example.com", name: "テスト表示名" } },
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    const state = buildInitialState(masterCharacters);
    const { result } = renderUseSync(state);
    expect(result.current.userLabel).toBe("テスト表示名");
  });
});

// ---------------------------------------------------------------------------
// 端末データの所有者（共有端末で別のアカウントがログインしたときの確認）
// ---------------------------------------------------------------------------

// fetch モックの呼び出し記録。
type FetchCalls = { get: number; put: number; putBodies: { baseRevision: number | null; payload: SyncPayloadV1 }[] };

// GET / PUT の応答を差し替えられる fetch モックを登録する。未指定の GET は 404、PUT は revision 1 の成功を返す。
function stubFetch(handlers: {
  get?: (count: number) => Response | Promise<Response>;
  put?: (count: number) => Response | Promise<Response>;
}): FetchCalls {
  const calls: FetchCalls = { get: 0, put: 0, putBodies: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        calls.get += 1;
        return handlers.get ? handlers.get(calls.get) : new Response(null, { status: 404 });
      }
      calls.put += 1;
      calls.putBodies.push(JSON.parse(init?.body as string));
      return handlers.put
        ? handlers.put(calls.put)
        : Response.json({ revision: 1, updatedAt: "2026-10-01T00:00:00.000Z" });
    }),
  );
  return calls;
}

// GET 200 の応答（サーバーにデータあり）を作る。
function foundResponse(revision: number, payload: SyncPayloadV1 = makeServerPayload()): Response {
  return Response.json({ revision, payload, updatedAt: "2026-10-01T00:00:00.000Z" });
}

// 採用されたか判別できるサーバー payload（計算タブにエントリあり）。
function makeMarkedServerPayload(): SyncPayloadV1 {
  return {
    formatVersion: SYNC_FORMAT_VERSION,
    storage: {
      [STORAGE_KEY]: buildInitialState(masterCharacters),
      [CONNECT_RANK_CALC_STORAGE_KEY]: { schemaVersion: 1, entries: [{ characterName: "ペコリーヌ", targetRank: 10 }] },
    },
  };
}

// 別のアカウント（u_old）の実データが端末に残っている状況を作る。
function seedOtherAccountData(options: { dirty?: boolean; withOwnerKey?: boolean } = {}): StoredStateV1 {
  const { dirty = false, withOwnerKey = true } = options;
  const state = buildInitialState(masterCharacters);
  saveStoredState(state);
  window.localStorage.setItem(TOUCHED_STORAGE_KEY, "1");
  window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeTab: "dashboard" }));
  saveSyncMeta({ userId: "u_old", revision: 4, localChangeSeq: dirty ? 3 : 2, lastSyncedSeq: 2 });
  if (withOwnerKey) {
    saveLocalDataOwner("u_old");
  }
  return state;
}

// 別のタブが端末データの epoch を進めた状況を再現する。
function simulateEpochBumpedInAnotherTab() {
  // このタブの控えと一致する epoch キーを確実に作ってから、別の値へ書き換える。
  isDeviceDataEpochCurrent();
  window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, `other-tab-${Math.random()}`);
}

describe("useSync: 端末データの所有者の確認", () => {
  it("別アカウントの実データ + サーバー 404 なら確認を出し、PUT しない", async () => {
    const state = seedOtherAccountData();
    const calls = stubFetch({});

    setLoggedIn("u_new");
    const { result } = renderUseSync(state);

    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());
    expect(result.current.accountSwitch).toMatchObject({
      userId: "u_new",
      server: { kind: "not_found" },
      localUpdatedAt: state.updatedAt,
      previousOwnerHasUnsyncedChanges: false,
    });
    expect(result.current.status).toBe("idle");
    expect(calls.put).toBe(0);
    expect(loadLocalDataOwner()).toBe("u_old");
    expect(loadSyncMeta()?.userId).toBe("u_old");
  });

  it("別アカウントの実データ + サーバーにデータありなら、サーバー情報付きの確認を出し採用も PUT もしない", async () => {
    const state = seedOtherAccountData();
    const calls = stubFetch({ get: () => foundResponse(9, makeMarkedServerPayload()) });

    setLoggedIn("u_new");
    const { result, onServerDataAdopted } = renderUseSync(state);

    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());
    expect(result.current.accountSwitch?.server).toMatchObject({
      kind: "found",
      revision: 9,
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(calls.put).toBe(0);
    expect(onServerDataAdopted).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY)).toBeNull();
  });

  it("旧版端末（所有者キーなし・メタあり）は GET 前にメタの userId を所有者として保存し、未同期変更を伝える", async () => {
    const state = seedOtherAccountData({ dirty: true, withOwnerKey: false });
    let resolveGet: ((response: Response) => void) | null = null;
    stubFetch({
      get: () =>
        new Promise<Response>((resolve) => {
          resolveGet = resolve;
        }),
    });

    setLoggedIn("u_new");
    const { result } = renderUseSync(state);

    // GET 応答待ちの時点で、所有者はメタの userId で補われている。
    await waitFor(() => expect(resolveGet).not.toBeNull());
    expect(loadLocalDataOwner()).toBe("u_old");

    await act(async () => {
      resolveGet?.(new Response(null, { status: 404 }));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());
    expect(result.current.accountSwitch?.previousOwnerHasUnsyncedChanges).toBe(true);
  });

  it("確認中に再マウント（リロード相当）しても再び確認が出る", async () => {
    const state = seedOtherAccountData();
    const calls = stubFetch({});

    setLoggedIn("u_new");
    const first = renderUseSync(state);
    await waitFor(() => expect(first.result.current.accountSwitch).not.toBeNull());
    first.unmount();

    const second = renderUseSync(state);
    await waitFor(() => expect(second.result.current.accountSwitch).not.toBeNull());
    expect(calls.put).toBe(0);
    expect(loadLocalDataOwner()).toBe("u_old");
    expect(loadSyncMeta()?.userId).toBe("u_old");
  });

  it("引き継ぎ（サーバー 404）: 所有者を自分にして baseRevision:null で PUT し、メタを同期済みにする", async () => {
    const state = seedOtherAccountData();
    const calls = stubFetch({ put: () => Response.json({ revision: 1, updatedAt: "2026-10-01T00:00:00.000Z" }) });

    setLoggedIn("u_new");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());
    const epochBefore = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);

    await act(async () => {
      await result.current.resolveAccountSwitchCarryOver();
    });

    expect(calls.put).toBe(1);
    expect(calls.putBodies[0]?.baseRevision).toBeNull();
    expect(loadLocalDataOwner()).toBe("u_new");
    expect(loadSyncMeta()).toEqual({ userId: "u_new", revision: 1, localChangeSeq: 1, lastSyncedSeq: 1 });
    expect(result.current.accountSwitch).toBeNull();
    expect(result.current.isAccountSwitchBusy).toBe(false);
    // 所有者の変更で epoch が進む（別のタブは書き込めなくなる）が、このタブは引き続き書き込める。
    expect(window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY)).not.toBe(epochBefore);
    expect(isDeviceDataEpochCurrent()).toBe(true);
    // 端末データ（touched・UI 設定）は残る。
    expect(window.localStorage.getItem(TOUCHED_STORAGE_KEY)).toBe("1");
    expect(window.localStorage.getItem(UI_STORAGE_KEY)).not.toBeNull();
  });

  it("上書き（サーバーにデータあり）: サーバーの revision を基準に PUT する", async () => {
    const state = seedOtherAccountData();
    const calls = stubFetch({
      get: () => foundResponse(9),
      put: () => Response.json({ revision: 10, updatedAt: "2026-10-01T00:00:00.000Z" }),
    });

    setLoggedIn("u_new");
    const { result, onServerDataAdopted } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());

    await act(async () => {
      await result.current.resolveAccountSwitchCarryOver();
    });

    expect(calls.put).toBe(1);
    expect(calls.putBodies[0]?.baseRevision).toBe(9);
    expect(onServerDataAdopted).not.toHaveBeenCalled();
    expect(loadLocalDataOwner()).toBe("u_new");
    expect(loadSyncMeta()).toEqual({ userId: "u_new", revision: 10, localChangeSeq: 1, lastSyncedSeq: 1 });
    expect(result.current.accountSwitch).toBeNull();
  });

  it("サーバーのデータを使う: 端末データを削除してサーバーのデータを採用し、このタブからの書き込みを止める", async () => {
    const state = seedOtherAccountData();
    const serverPayload = makeMarkedServerPayload();
    const calls = stubFetch({ get: () => foundResponse(9, serverPayload) });

    setLoggedIn("u_new");
    const { result, onServerDataAdopted, onLocalDataCleared } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());

    act(() => {
      result.current.resolveAccountSwitchDiscard();
    });

    expect(calls.put).toBe(0);
    expect(onServerDataAdopted).toHaveBeenCalledTimes(1);
    expect(onLocalDataCleared).not.toHaveBeenCalled();
    expect(result.current.accountSwitch).toBeNull();
    // 端末データは削除され、所有者と採用したサーバーデータだけが書かれている。
    expect(window.localStorage.getItem(TOUCHED_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(UI_STORAGE_KEY)).toBeNull();
    expect(loadLocalDataOwner()).toBe("u_new");
    expect(loadSyncMeta()).toEqual({ userId: "u_new", revision: 9, localChangeSeq: 0, lastSyncedSeq: 0 });
    expect(JSON.parse(window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY) ?? "null")).toEqual(
      serverPayload.storage[CONNECT_RANK_CALC_STORAGE_KEY],
    );
    // 再読み込みまでの間、このタブの古い state は書き戻せない。
    expect(isDeviceDataEpochCurrent()).toBe(false);
    saveStoredState(state);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual(serverPayload.storage[STORAGE_KEY]);
  });

  it("使わずに初期状態から始める（サーバー 404）: 端末データを削除し onLocalDataCleared を呼ぶ", async () => {
    const state = seedOtherAccountData();
    const calls = stubFetch({});

    setLoggedIn("u_new");
    const { result, onServerDataAdopted, onLocalDataCleared } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());

    act(() => {
      result.current.resolveAccountSwitchDiscard();
    });

    expect(calls.put).toBe(0);
    expect(onLocalDataCleared).toHaveBeenCalledTimes(1);
    expect(onServerDataAdopted).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(TOUCHED_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(UI_STORAGE_KEY)).toBeNull();
    expect(loadSyncMeta()).toBeNull();
    expect(loadLocalDataOwner()).toBe("u_new");
    expect(isDeviceDataEpochCurrent()).toBe(false);
  });

  it("所有者のいない（ログイン前の）実データは、初回ログインで従来どおりアップロードする", async () => {
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);
    window.localStorage.setItem(TOUCHED_STORAGE_KEY, "1");
    const calls = stubFetch({});

    setLoggedIn("u1");
    const { result } = renderUseSync(state);

    await waitFor(() => expect(calls.put).toBe(1));
    expect(calls.putBodies[0]?.baseRevision).toBeNull();
    expect(result.current.accountSwitch).toBeNull();
    expect(loadLocalDataOwner()).toBe("u1");
    await waitFor(() => expect(loadSyncMeta()).toEqual({ userId: "u1", revision: 1, localChangeSeq: 1, lastSyncedSeq: 1 }));
  });

  it("同じユーザーなら確認を出さず、所有者キーのない端末では所有者を保存する", async () => {
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);
    window.localStorage.setItem(TOUCHED_STORAGE_KEY, "1");
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
    const calls = stubFetch({ get: () => foundResponse(3) });

    setLoggedIn("u1");
    const { result } = renderUseSync(state);

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.accountSwitch).toBeNull();
    expect(calls.put).toBe(0);
    expect(loadLocalDataOwner()).toBe("u1");
    expect(loadSyncMeta()).toEqual({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
  });

  it("別アカウントのデータでもローカルが初期状態なら確認せず、所有者を自分にして前のメタを破棄する", async () => {
    // touched なし・初期状態のデータ。前のアカウントのメタと所有者だけが残っている。
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);
    saveSyncMeta({ userId: "u_old", revision: 4, localChangeSeq: 2, lastSyncedSeq: 2 });
    saveLocalDataOwner("u_old");
    const calls = stubFetch({});

    setLoggedIn("u_new");
    const { result } = renderUseSync(state);

    await waitFor(() => expect(loadLocalDataOwner()).toBe("u_new"));
    expect(result.current.accountSwitch).toBeNull();
    expect(loadSyncMeta()).toBeNull();
    expect(calls.put).toBe(0);
  });

  it("401 で自分のメタを消しても所有者は残り、次に別のアカウントでログインすると確認が出る", async () => {
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);
    window.localStorage.setItem(TOUCHED_STORAGE_KEY, "1");
    // 所有者キーのない旧版端末で、u1 のメタだけがある。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 1, lastSyncedSeq: 0 });
    let getCount = 0;
    stubFetch({
      get: () => {
        getCount += 1;
        return getCount === 1 ? new Response(null, { status: 401 }) : new Response(null, { status: 404 });
      },
    });

    setLoggedIn("u1");
    const { result, rerender } = renderUseSync(state);
    await waitFor(() => expect(result.current.status).toBe("logged_out"));
    expect(loadSyncMeta()).toBeNull();
    expect(loadLocalDataOwner()).toBe("u1");

    // 別のアカウントでログインし直す。
    setLoggedIn("u2");
    rerender();
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());
    expect(result.current.accountSwitch?.userId).toBe("u2");
    // メタが消えているため、前のアカウントの未同期変更は分からない（警告は出さない）。
    expect(result.current.accountSwitch?.previousOwnerHasUnsyncedChanges).toBe(false);
  });

  it("401 でも別のアカウントのメタは消さない", async () => {
    const state = seedOtherAccountData();
    stubFetch({ get: () => new Response(null, { status: 401 }) });

    setLoggedIn("u_new");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(result.current.status).toBe("logged_out"));
    expect(loadSyncMeta()?.userId).toBe("u_old");
    expect(loadLocalDataOwner()).toBe("u_old");
  });

  it("確認中にログアウトしたら確認を閉じ、所有者とメタは変えない", async () => {
    const state = seedOtherAccountData();
    const calls = stubFetch({});

    setLoggedIn("u_new");
    const { result, rerender } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());

    setLoggedOut();
    rerender();

    await waitFor(() => expect(result.current.accountSwitch).toBeNull());
    expect(result.current.status).toBe("logged_out");
    expect(calls.put).toBe(0);
    expect(loadLocalDataOwner()).toBe("u_old");
    expect(loadSyncMeta()?.userId).toBe("u_old");
  });

  it("「ログアウトする」を選ぶと signOut を呼び、所有者とメタは変えない", async () => {
    const state = seedOtherAccountData();
    stubFetch({});
    mockSignOut.mockResolvedValue({ data: { success: true }, error: null });

    setLoggedIn("u_new");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());

    await act(async () => {
      await result.current.cancelAccountSwitchAndSignOut();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.accountSwitch).toBeNull();
    expect(loadLocalDataOwner()).toBe("u_old");
    expect(loadSyncMeta()?.userId).toBe("u_old");
    expect(window.localStorage.getItem(TOUCHED_STORAGE_KEY)).toBe("1");
  });

  it("ログアウトに失敗したら確認を残す", async () => {
    const state = seedOtherAccountData();
    stubFetch({});
    mockSignOut.mockResolvedValue({ data: null, error: { status: 500, statusText: "error" } });

    setLoggedIn("u_new");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());

    await act(async () => {
      await result.current.cancelAccountSwitchAndSignOut();
    });

    expect(result.current.accountSwitch).not.toBeNull();
    expect(result.current.isAccountSwitchBusy).toBe(false);
  });

  it("GET 待ち中に別アカウントへ切り替わったら、旧アカウントの文脈で確認を出さない", async () => {
    const state = seedOtherAccountData();
    let resolveFirstGet: ((response: Response) => void) | null = null;
    const calls = stubFetch({
      get: (count) =>
        count === 1
          ? new Promise<Response>((resolve) => {
              resolveFirstGet = resolve;
            })
          : new Response(null, { status: 404 }),
    });

    setLoggedIn("u1");
    const { result, rerender } = renderUseSync(state);
    await waitFor(() => expect(resolveFirstGet).not.toBeNull());

    // GET 待ち中に u2 へ切り替える。u2 の起動フローは 404 で確認を出す。
    setLoggedIn("u2");
    rerender();
    await waitFor(() => expect(result.current.accountSwitch?.userId).toBe("u2"));

    // u1 の GET を「サーバーにデータあり」で解決しても、u1 の確認には置き換わらない。
    await act(async () => {
      resolveFirstGet?.(foundResponse(6));
      await Promise.resolve();
    });
    expect(result.current.accountSwitch?.userId).toBe("u2");
    expect(result.current.accountSwitch?.server.kind).toBe("not_found");
    expect(calls.put).toBe(0);
    expect(loadLocalDataOwner()).toBe("u_old");
  });
});

describe("useSync: 引き継ぎ・上書きの PUT 中の編集", () => {
  it("引き継ぎの PUT 中の編集は dirty のまま残り、次の PUT で送られる", async () => {
    const state = seedOtherAccountData();
    let resolveFirstPut: ((response: Response) => void) | null = null;
    const calls = stubFetch({
      put: (count) =>
        count === 1
          ? new Promise<Response>((resolve) => {
              resolveFirstPut = resolve;
            })
          : Response.json({ revision: 2, updatedAt: "2026-10-01T00:00:00.000Z" }),
    });

    setLoggedIn("u_new");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());

    let carryOver: Promise<void> | null = null;
    act(() => {
      carryOver = result.current.resolveAccountSwitchCarryOver();
    });
    await waitFor(() => expect(calls.put).toBe(1));
    // PUT が終わるまで確認は閉じず、処理中になる。
    expect(result.current.accountSwitch).not.toBeNull();
    expect(result.current.isAccountSwitchBusy).toBe(true);
    // PUT の前に新しいユーザーのメタが確立されている。
    expect(loadSyncMeta()).toEqual({ userId: "u_new", revision: null, localChangeSeq: 1, lastSyncedSeq: 0 });

    // 送信中に編集する。
    vi.useFakeTimers();
    act(() => {
      result.current.notifyLocalChange();
    });
    expect(loadSyncMeta()?.localChangeSeq).toBe(2);

    await act(async () => {
      resolveFirstPut?.(Response.json({ revision: 1, updatedAt: "2026-10-01T00:00:00.000Z" }));
      await carryOver;
    });
    // 送った seq（1）だけが同期済みになり、送信中の編集（2）は dirty のまま。
    expect(loadSyncMeta()).toEqual({ userId: "u_new", revision: 1, localChangeSeq: 2, lastSyncedSeq: 1 });
    expect(result.current.accountSwitch).toBeNull();

    // デバウンス満了で残りの編集が送られる（baseRevision は引き継ぎで得た revision）。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    vi.useRealTimers();
    expect(calls.put).toBe(2);
    expect(calls.putBodies[1]?.baseRevision).toBe(1);
    await waitFor(() => expect(loadSyncMeta()).toMatchObject({ revision: 2, localChangeSeq: 2, lastSyncedSeq: 2 }));
  });

  it("競合解決「この端末のデータを使う」の PUT 中の編集は dirty のまま残り、次の PUT で送られる", async () => {
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);
    saveLocalDataOwner("u1");
    // dirty なメタ + サーバー revision 不一致 → 競合。
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 1, lastSyncedSeq: 0 });
    let resolveFirstPut: ((response: Response) => void) | null = null;
    const calls = stubFetch({
      get: () => foundResponse(5),
      put: (count) =>
        count === 1
          ? new Promise<Response>((resolve) => {
              resolveFirstPut = resolve;
            })
          : Response.json({ revision: 7, updatedAt: "2026-10-01T00:00:00.000Z" }),
    });

    setLoggedIn("u1");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(result.current.conflict).not.toBeNull());

    let resolving: Promise<void> | null = null;
    act(() => {
      resolving = result.current.resolveConflictUseLocal();
    });
    await waitFor(() => expect(calls.put).toBe(1));
    expect(calls.putBodies[0]?.baseRevision).toBe(5);

    vi.useFakeTimers();
    act(() => {
      result.current.notifyLocalChange();
    });
    expect(loadSyncMeta()?.localChangeSeq).toBe(2);

    await act(async () => {
      resolveFirstPut?.(Response.json({ revision: 6, updatedAt: "2026-10-01T00:00:00.000Z" }));
      await resolving;
    });
    // 以前は PUT 後に読み直した seq（2）を同期済みにしていたが、送った seq（1）だけを同期済みにする。
    expect(loadSyncMeta()).toEqual({ userId: "u1", revision: 6, localChangeSeq: 2, lastSyncedSeq: 1 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    vi.useRealTimers();
    expect(calls.put).toBe(2);
    expect(calls.putBodies[1]?.baseRevision).toBe(6);
  });
});

describe("useSync: 別のタブで端末データが変わったとき（epoch）", () => {
  it("起動時 GET の応答待ちの間に別のタブで epoch が進むと、応答後の採用で何も書き込まない", async () => {
    saveSyncMeta({ userId: "u1", revision: 5, localChangeSeq: 0, lastSyncedSeq: 0 });
    saveLocalDataOwner("u1");
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);
    const storedBefore = window.localStorage.getItem(STORAGE_KEY);
    let resolveGet: ((response: Response) => void) | null = null;
    const calls = stubFetch({
      get: () =>
        new Promise<Response>((resolve) => {
          resolveGet = resolve;
        }),
    });

    setLoggedIn("u1");
    const { result, onServerDataAdopted } = renderUseSync(state);
    await waitFor(() => expect(resolveGet).not.toBeNull());

    simulateEpochBumpedInAnotherTab();
    // 別のタブが端末データを削除した状況（所有者・メタ・育成データなし）。
    const epochAfter = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);

    // revision 6 は本来「黙って採用」に進む応答。
    await act(async () => {
      resolveGet?.(foundResponse(6, makeMarkedServerPayload()));
      await Promise.resolve();
    });

    expect(onServerDataAdopted).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CONNECT_RANK_CALC_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(storedBefore);
    expect(loadSyncMeta()).toEqual({ userId: "u1", revision: 5, localChangeSeq: 0, lastSyncedSeq: 0 });
    expect(window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY)).toBe(epochAfter);
    expect(result.current.accountSwitch).toBeNull();
    expect(calls.put).toBe(0);
  });

  it("別のタブで epoch が進んだ後は、編集を記録せず予約済みの PUT も送らない", async () => {
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
    saveLocalDataOwner("u1");
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);
    const calls = stubFetch({ get: () => foundResponse(3) });

    setLoggedIn("u1");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(result.current.status).toBe("idle"));

    vi.useFakeTimers();
    // 編集で PUT を予約した後に、別のタブで epoch が進む。
    act(() => {
      result.current.notifyLocalChange();
    });
    expect(loadSyncMeta()?.localChangeSeq).toBe(1);
    simulateEpochBumpedInAnotherTab();

    // 以後の編集は記録されない。
    act(() => {
      result.current.notifyLocalChange();
    });
    expect(loadSyncMeta()?.localChangeSeq).toBe(1);

    // デバウンス満了でも、古い state を PUT しない。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    vi.useRealTimers();
    expect(calls.put).toBe(0);
  });

  it("別のタブで epoch が進んだ後は、確認ダイアログの選択を実行しない", async () => {
    const state = seedOtherAccountData();
    const calls = stubFetch({});

    setLoggedIn("u_new");
    const { result, onLocalDataCleared } = renderUseSync(state);
    await waitFor(() => expect(result.current.accountSwitch).not.toBeNull());
    simulateEpochBumpedInAnotherTab();

    await act(async () => {
      await result.current.resolveAccountSwitchCarryOver();
    });
    act(() => {
      result.current.resolveAccountSwitchDiscard();
    });

    expect(calls.put).toBe(0);
    expect(onLocalDataCleared).not.toHaveBeenCalled();
    expect(loadLocalDataOwner()).toBe("u_old");
    expect(window.localStorage.getItem(TOUCHED_STORAGE_KEY)).toBe("1");
  });
});

describe("useSync: hasUnsyncedChanges", () => {
  it("自分のメタが dirty のときだけ true を返す", async () => {
    saveSyncMeta({ userId: "u1", revision: 3, localChangeSeq: 0, lastSyncedSeq: 0 });
    saveLocalDataOwner("u1");
    const state = buildInitialState(masterCharacters);
    saveStoredState(state);
    stubFetch({ get: () => foundResponse(3) });

    setLoggedIn("u1");
    const { result } = renderUseSync(state);
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.hasUnsyncedChanges()).toBe(false);

    act(() => {
      result.current.notifyLocalChange();
    });
    expect(result.current.hasUnsyncedChanges()).toBe(true);
  });
});
