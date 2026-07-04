import { buildDefaultConnectRankCalcState, isConnectRankCalcStateDefault, type ConnectRankCalcStateV1 } from "./connectRankCalcSchema";
import { loadConnectRankCalcState } from "./connectRankCalcStorage";
import { isStoredStateInitial } from "./storage";
import { CONNECT_RANK_CALC_STORAGE_KEY, STORAGE_KEY } from "./storageKeys";
import { parseSyncPayloadV1, SYNC_FORMAT_VERSION, type SyncPayloadV1 } from "./sync";
import type { MasterCharacter, StoredStateV1 } from "./types";

// フロントエンド同期層の純関数中心ロジック。
//
// ここには「ペイロード構築」「/api/data の fetch ラッパ」「起動時フロー・引き継ぎ 3 分岐の判定」を置く。
// DOM への直接依存は最小限（fetch と loadConnectRankCalcState のみ）に留め、判定ロジックは純関数として
// テスト容易にする。React 統合（セッション監視・デバウンス・state 反映）は `src/hooks/useSync.ts` が担当する。

// ---------------------------------------------------------------------------
// ペイロード構築
// ---------------------------------------------------------------------------

// App の in-memory state（正規化済み）と計算タブ状態から SyncPayloadV1 を構築する。
// 設計書指定の通り localStorage の raw 値からは構築せず、正規化を通った値のみを送る。
export function buildSyncPayload(state: StoredStateV1, calcState: ConnectRankCalcStateV1): SyncPayloadV1 {
  return {
    formatVersion: SYNC_FORMAT_VERSION,
    storage: {
      [STORAGE_KEY]: state,
      [CONNECT_RANK_CALC_STORAGE_KEY]: calcState,
    },
  };
}

// 育成データ state と、同期直前に読み込む計算タブ状態から SyncPayloadV1 を構築する。
// 計算タブ状態は loadConnectRankCalcState()（読み込み時正規化を通る）で取得する（設計判断 2）。
export function buildSyncPayloadFromCurrent(state: StoredStateV1): SyncPayloadV1 {
  return buildSyncPayload(state, loadConnectRankCalcState());
}

// ---------------------------------------------------------------------------
// fetch ラッパ
// ---------------------------------------------------------------------------

// GET /api/data の結果。404（サーバー空）は notFound、200 は data。
export type FetchDataResult =
  | { kind: "found"; revision: number; payload: SyncPayloadV1; updatedAt: string }
  | { kind: "not_found" }
  | { kind: "unauthorized" }
  | { kind: "error"; status: number };

// PUT /api/data の結果。
export type PutDataResult =
  | { kind: "ok"; revision: number; updatedAt: string }
  | { kind: "conflict" }
  | { kind: "unauthorized" }
  | { kind: "error"; status: number };

// GET /api/data を実行し、レスポンスを検証して返す。
// Cookie は same-origin ポリシーにより自動送信される（fetch デフォルトの credentials: "same-origin" で足りる）。
export async function fetchServerData(): Promise<FetchDataResult> {
  let response: Response;
  try {
    response = await fetch("/api/data", { method: "GET", credentials: "same-origin" });
  } catch {
    // ネットワーク障害等。恒常エラーはステータス表示で気付ける想定（モーダルは出さない）。
    return { kind: "error", status: 0 };
  }

  if (response.status === 404) {
    return { kind: "not_found" };
  }
  if (response.status === 401) {
    return { kind: "unauthorized" };
  }
  if (!response.ok) {
    return { kind: "error", status: response.status };
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    return { kind: "error", status: response.status };
  }

  // レスポンス body の形（{ revision, payload, updatedAt }）を検証する。
  if (typeof body !== "object" || body === null) {
    return { kind: "error", status: response.status };
  }
  const record = body as Record<string, unknown>;
  if (typeof record.revision !== "number" || typeof record.updatedAt !== "string") {
    return { kind: "error", status: response.status };
  }

  // payload は SyncPayloadV1 として深く検証する（不正なら error 扱い）。
  try {
    const payload = parseSyncPayloadV1(record.payload);
    return { kind: "found", revision: record.revision, payload, updatedAt: record.updatedAt };
  } catch {
    return { kind: "error", status: response.status };
  }
}

// PUT /api/data を実行する。baseRevision が null なら初回アップロード（INSERT）。
export async function putServerData(baseRevision: number | null, payload: SyncPayloadV1): Promise<PutDataResult> {
  let response: Response;
  try {
    response = await fetch("/api/data", {
      method: "PUT",
      // Content-Type: application/json は Worker 側 CSRF ミドルウェアで必須（設計書指定）。Origin はブラウザが自動送信する。
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ baseRevision, payload }),
    });
  } catch {
    return { kind: "error", status: 0 };
  }

  if (response.status === 409) {
    return { kind: "conflict" };
  }
  if (response.status === 401) {
    return { kind: "unauthorized" };
  }
  if (!response.ok) {
    return { kind: "error", status: response.status };
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    return { kind: "error", status: response.status };
  }
  if (typeof body !== "object" || body === null) {
    return { kind: "error", status: response.status };
  }
  const record = body as Record<string, unknown>;
  if (typeof record.revision !== "number") {
    return { kind: "error", status: response.status };
  }
  // updatedAt はサーバーが返すが、型が緩い場合に備えてフォールバックを持つ。
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString();
  return { kind: "ok", revision: record.revision, updatedAt };
}

// ---------------------------------------------------------------------------
// 「ローカルに実データあり」判定（設計書「ローカルが初期状態の判定方法」）
// ---------------------------------------------------------------------------

// 判定に必要なローカルの状態スナップショット。
export type LocalStateSnapshot = {
  // touched フラグ（一次判定用）。
  touched: boolean;
  // 育成データの in-memory state（正規化済み）。
  storedState: StoredStateV1;
  // 計算タブ状態（正規化済み）。
  calcState: ConnectRankCalcStateV1;
};

// ローカルに「実データあり」かどうかを判定する。
// - 一次: touched フラグがあれば「実データあり」確定。なければ二次判定へ（設計書: フラグ不在=初期状態と断定してはならない）。
// - 二次: 育成データが初期状態と一致 かつ 計算タブがデフォルトなら「初期状態」。それ以外は「実データあり」。
export function hasLocalRealData(snapshot: LocalStateSnapshot, masterCharacters: MasterCharacter[]): boolean {
  // 一次判定: touched フラグは「実データあり」を確定させる方向にのみ使う。
  if (snapshot.touched) {
    return true;
  }
  // 二次判定: 初期状態との同値比較（updatedAt 除外）。
  const storedIsInitial = isStoredStateInitial(snapshot.storedState, masterCharacters);
  const calcIsDefault = isConnectRankCalcStateDefault(snapshot.calcState);
  // 両方とも初期状態のときだけ「初期状態」。片方でも異なれば「実データあり」（曖昧側は安全に実データ扱い）。
  return !(storedIsInitial && calcIsDefault);
}

// ---------------------------------------------------------------------------
// 起動時フロー・引き継ぎ 3 分岐の判定（純関数）
// ---------------------------------------------------------------------------

// GET 結果とローカル状態から、次に取るべきアクションを決定する。
// 「同期メタあり（既知の revision あり）」と「初回ログイン（同期メタなし）」の両方を扱う。
//
// アクションの意味:
// - upload_new: サーバー空 & ローカル実データ → baseRevision:null でアップロード（引き継ぎ分岐 1）。
// - noop: 何もしない（サーバー空 & ローカル初期、または既に同期済みで dirty でない）。
// - put_dirty: 同期済み revision 一致 & dirty → 通常 PUT。
// - adopt_server: サーバーデータを採用（引き継ぎ分岐 2 / 他端末更新の黙って採用）。※採用直前に seq 再検証が必須。
// - conflict: 競合ダイアログを表示（引き継ぎ分岐 3 / dirty 競合）。
export type SyncStartupAction = "upload_new" | "noop" | "put_dirty" | "adopt_server" | "conflict";

// 起動時フロー判定の入力。
export type DecideStartupInput = {
  // GET の結果（found / not_found）。unauthorized/error は呼び出し側で処理し、ここには渡さない。
  fetchResult: { kind: "found"; revision: number } | { kind: "not_found" };
  // 同期メタが持つ既知の revision（メタなし=初回ログインなら null）。
  knownRevision: number | null;
  // 現在ローカルに未同期変更があるか（localChangeSeq > lastSyncedSeq）。メタなしなら false 相当で渡す。
  dirty: boolean;
  // ローカルに実データがあるか（hasLocalRealData の結果）。
  localHasRealData: boolean;
};

// 起動時・ログイン直後のアクションを純粋に決定する（設計判断 4）。
export function decideStartupAction(input: DecideStartupInput): SyncStartupAction {
  const { fetchResult, knownRevision, dirty, localHasRealData } = input;

  if (fetchResult.kind === "not_found") {
    // サーバー空。
    return localHasRealData ? "upload_new" : "noop";
  }

  // サーバーにデータあり（found）。
  if (knownRevision === null) {
    // 同期メタなし = 初回ログイン。設計書の 3 分岐で判定する。
    // - ローカル初期状態 → サーバー採用（分岐 2）。
    // - ローカル実データあり → 競合（分岐 3。自動マージ禁止）。
    return localHasRealData ? "conflict" : "adopt_server";
  }

  // 同期メタあり。
  if (fetchResult.revision === knownRevision) {
    // revision 一致 = 同期済み。dirty なら PUT、そうでなければ何もしない。
    return dirty ? "put_dirty" : "noop";
  }

  // revision 不一致 = 他端末で更新された。
  // dirty でなければ黙って採用（キャッシュ更新）。dirty なら競合。
  return dirty ? "conflict" : "adopt_server";
}

// ---------------------------------------------------------------------------
// サーバーデータ採用の直前再検証（seq 再検証。設計判断 6 の共通ルール）
// ---------------------------------------------------------------------------

// ユーザーの明示選択を経ない自動採用（起動時の黙って採用・初回引き継ぎ分岐 2）の直前に、
// 判定時に控えた localChangeSeq と現在値を比較する。進んでいたら自動採用を中止して競合へ倒す。
// true を返せば「そのまま自動採用してよい」。false なら「競合ダイアログへ倒す」。
export function isSafeToAutoAdopt(seqAtDecision: number, currentSeq: number): boolean {
  return currentSeq === seqAtDecision;
}
