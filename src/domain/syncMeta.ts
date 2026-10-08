import { removeDeviceStorage, writeDeviceStorage } from "./deviceData";
import { LOCAL_DATA_OWNER_STORAGE_KEY, SYNC_META_STORAGE_KEY, TOUCHED_STORAGE_KEY } from "./storageKeys";

// 同期メタ情報（`pcr_growth_tracker_sync`）と touched フラグ（`pcr_growth_tracker_touched`）の
// 読み書きを担う DOM 依存モジュール。
//
// これらのキーは端末ローカルの判定専用データであり、**同期対象（SyncPayloadV1）にも
// バックアップ対象（LocalStorageBackupV1）にも含めない**（設計書「初回ログイン時のデータ引き継ぎ」節）。
//
// 同期メタは「サーバー revision」「ローカル変更カウンタ（localChangeSeq）」「同期済みカウンタ
// （lastSyncedSeq）」と、それが紐づくアカウント（userId）を持つ。dirty は boolean で持たず、
// `localChangeSeq > lastSyncedSeq` を dirty とみなす（設計判断 1）。単調増加カウンタにすることで、
// PUT 中に発生した後続編集を「送っていないのに同期済み扱いにする」余地を型レベルで排除する。

// 同期メタ情報の型。userId でセッションユーザーと突き合わせる（アカウント切替検知のため）。
export type SyncMetaV1 = {
  // このメタが紐づくアカウントのユーザー ID（better-auth の user.id）。
  userId: string;
  // サーバーが発行した最新の revision（GET/PUT 応答で得た値）。
  // null はサーバーにまだ行がない（初回アップロード前）ことを表す。この状態の PUT は baseRevision:null で送る。
  revision: number | null;
  // ローカル編集ごとに単調増加させるカウンタ。
  localChangeSeq: number;
  // 直近の PUT 成功時に、その PUT 開始時点の localChangeSeq を記録したもの。
  lastSyncedSeq: number;
};

// 与えられた値が SyncMetaV1 として妥当な形かを判定する型ガード。
function isSyncMetaV1(value: unknown): value is SyncMetaV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.userId === "string" &&
    (record.revision === null || (typeof record.revision === "number" && Number.isFinite(record.revision))) &&
    typeof record.localChangeSeq === "number" &&
    Number.isFinite(record.localChangeSeq) &&
    typeof record.lastSyncedSeq === "number" &&
    Number.isFinite(record.lastSyncedSeq)
  );
}

// 同期メタ情報を localStorage から読み込む。未保存・破損時は null を返す。
export function loadSyncMeta(): SyncMetaV1 | null {
  if (typeof window === "undefined") {
    return null;
  }
  const rawText = window.localStorage.getItem(SYNC_META_STORAGE_KEY);
  if (!rawText) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawText) as unknown;
    return isSyncMetaV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// 同期メタ情報を localStorage へ保存する。
export function saveSyncMeta(meta: SyncMetaV1): void {
  if (typeof window === "undefined") {
    return;
  }
  writeDeviceStorage(SYNC_META_STORAGE_KEY, JSON.stringify(meta));
}

// 同期メタ情報を破棄する（所有者の切り替え時・401 検出時・アカウント削除時に呼ぶ）。
export function clearSyncMeta(): void {
  if (typeof window === "undefined") {
    return;
  }
  removeDeviceStorage(SYNC_META_STORAGE_KEY);
}

// touched フラグ（ユーザーが一度でも編集操作を行ったか）を読み込む。
export function loadTouchedFlag(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(TOUCHED_STORAGE_KEY) === "1";
}

// touched フラグを立てる（ユーザーの編集操作ハンドラから呼ぶ）。
// 保存関数（save*）内では呼ばない（マウント直後の自動保存で誤って立つのを防ぐ。設計判断 8）。
export function markTouched(): void {
  if (typeof window === "undefined") {
    return;
  }
  writeDeviceStorage(TOUCHED_STORAGE_KEY, "1");
}

// ---------------------------------------------------------------------------
// 端末データの所有者（`pcr_growth_tracker_owner`）
// ---------------------------------------------------------------------------
//
// この端末のデータをどのアカウントで使っているかを記録する。同期メタと違い、401 やログアウトでは消さない。
// 別のアカウントでログインしたとき、所有者と現在のユーザーが異なり、端末に実データがあれば確認ダイアログを出す。

// 所有者情報の保存形式。
type LocalDataOwnerV1 = {
  // 端末データを使っているアカウントのユーザー ID（better-auth の user.id）。
  userId: string;
};

// 与えられた値が所有者情報として妥当な形かを判定する型ガード。
function isLocalDataOwnerV1(value: unknown): value is LocalDataOwnerV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.userId === "string" && record.userId !== "";
}

// 端末データの所有者のユーザー ID を読み込む。未保存・破損時は null を返す。
export function loadLocalDataOwner(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const rawText = window.localStorage.getItem(LOCAL_DATA_OWNER_STORAGE_KEY);
  if (!rawText) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawText) as unknown;
    return isLocalDataOwnerV1(parsed) ? parsed.userId : null;
  } catch {
    return null;
  }
}

// 端末データの所有者を保存する。
export function saveLocalDataOwner(userId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const owner: LocalDataOwnerV1 = { userId };
  writeDeviceStorage(LOCAL_DATA_OWNER_STORAGE_KEY, JSON.stringify(owner));
}

// 端末データの所有者を削除する。
export function clearLocalDataOwner(): void {
  if (typeof window === "undefined") {
    return;
  }
  removeDeviceStorage(LOCAL_DATA_OWNER_STORAGE_KEY);
}
