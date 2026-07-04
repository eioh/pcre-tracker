import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// authClient の useSession をテストから差し替えられるようモック化する。
// authClient は SyncHeader（DOM 統合テスト用ハーネス）が import するためスタブを含める。
const mockUseSession = vi.fn();
vi.mock("../lib/authClient", () => ({
  authClient: { deleteUser: vi.fn() },
  useSession: () => mockUseSession(),
  signIn: { social: vi.fn() },
  signOut: vi.fn(),
}));

import { masterCharacters } from "../domain/master";
import { buildInitialState, saveStoredState } from "../domain/storage";
import { CONNECT_RANK_CALC_STORAGE_KEY, STORAGE_KEY } from "../domain/storageKeys";
import { SYNC_FORMAT_VERSION, type SyncPayloadV1 } from "../domain/sync";
import { loadSyncMeta, saveSyncMeta } from "../domain/syncMeta";
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
  const result = renderHook(() =>
    useSync({ getState: () => state, masterCharacters, onServerDataAdopted }),
  );
  return { ...result, onServerDataAdopted };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
  mockUseSession.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSync: アカウント切替（userId 不一致）", () => {
  it("メタの userId が現セッションと不一致なら破棄し、実データありなら競合に倒れ自動 PUT しない", async () => {
    // 別アカウント u_old のメタが端末に残っている状況。
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
    const { result } = renderUseSync(state);

    // 競合ダイアログが提示され、自動 PUT は発生しない（無断アップロード禁止）。
    await waitFor(() => expect(result.current.conflict).not.toBeNull());
    expect(putSpy).not.toHaveBeenCalled();
    expect(result.current.conflict?.serverRevision).toBe(9);
    // 前アカウントのメタは破棄されている（新アカウントのメタはまだ確立していない）。
    expect(loadSyncMeta()).toBeNull();
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
    const sync = useSync({ getState: () => state, masterCharacters, onServerDataAdopted: vi.fn() });
    return (
      <SyncHeader
        isLoggedIn={sync.isLoggedIn}
        isSessionPending={sync.isSessionPending}
        userLabel={sync.userLabel}
        status={sync.status}
        onOpenPrivacyPolicy={vi.fn()}
        onDeleteRequestStart={vi.fn()}
        onBeforeAccountDeleted={vi.fn()}
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
