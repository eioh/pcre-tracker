import {
  CONNECT_RANK_CALC_STORAGE_KEY,
  DEVICE_DATA_EPOCH_STORAGE_KEY,
  LOCAL_DATA_OWNER_STORAGE_KEY,
  STORAGE_KEY,
  SYNC_META_STORAGE_KEY,
  TOUCHED_STORAGE_KEY,
  UI_STORAGE_KEY,
} from "./storageKeys";

// この端末に保存した利用者のデータ（端末データ）の書き込み口と、端末データの世代（epoch）を管理する DOM 依存モジュール。
//
// 端末データは次の 6 キー。共有端末でのログアウト時の削除や、別のアカウントでログインしたときの
// 「使わない」選択では、これらをまとめて削除する。
// - 育成データ / コネクトランク計算タブ / UI 設定 / touched フラグ / 同期メタ / 所有者
//
// 複数タブ対策: あるタブで端末データを削除したり所有者を変えたりしても、別のタブには古い state と
// 保存処理（debounce 保存・pagehide 時の保存）が残っていて、古いデータを書き戻せてしまう。
// そこで、削除・所有者変更のたびに epoch キーを新しい値へ更新し、各タブは起動時に読み込んだ値を控えておく。
// 控えと localStorage の値が一致しないタブ（＝別のタブで削除・所有者変更が起きた後のタブ）からの
// 書き込みは、すべてここのヘルパーで止める。保存関数ごとにチェックを足すと漏れが出るため、
// 端末データへの書き込み・削除は必ず `writeDeviceStorage` / `removeDeviceStorage` を通す。

// 端末データのキー（epoch キー自体は含めない）。
export const DEVICE_DATA_STORAGE_KEYS = [
  STORAGE_KEY,
  CONNECT_RANK_CALC_STORAGE_KEY,
  UI_STORAGE_KEY,
  TOUCHED_STORAGE_KEY,
  SYNC_META_STORAGE_KEY,
  LOCAL_DATA_OWNER_STORAGE_KEY,
] as const;

// 端末データのキーの型。ヘルパーの引数をこの 6 キーに限定する。
export type DeviceDataStorageKey = (typeof DEVICE_DATA_STORAGE_KEYS)[number];

// epoch の新しい値を作る。crypto.randomUUID が使えない環境（非セキュアコンテキスト等）では時刻と乱数で代用する。
function createEpochValue(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// タブ起動時の epoch を読み込む。キーがなければ新しい値を作って保存する。
// localStorage の読み書きに失敗したとき（容量超過・ストレージが使えない環境など）は null を返す。
// モジュール読み込み時に呼ぶため、例外を投げるとアプリ全体が起動できなくなる。ここでは例外を外へ出さない。
function readOrCreateEpoch(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);
    if (stored !== null) {
      return stored;
    }
    const created = createEpochValue();
    window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, created);
    return created;
  } catch (error) {
    console.warn("端末データの世代を保存できませんでした", { error });
    return null;
  }
}

// このタブが控えている epoch。モジュール読み込み時（＝タブ起動時）に確定させる。
// 遅延初期化にすると、別のタブが epoch を進めた後に初めて書き込むタブが新しい値を控えてしまい、書き戻しを止められない。
// null は起動時に確定できなかったこと（容量超過など）を表す。確定できるまで、このタブからは端末データへ書き込まない
// （回復の条件は checkDeviceDataEpoch を参照）。
let capturedEpoch: string | null = readOrCreateEpoch();

// 起動時に epoch を確定できず、その後に epoch キーが存在していたか（このタブでは再読み込みするまで保存できない）。
let reloadRequired = false;

// 端末データの書き込み可否の判定結果。
// - current: 書き込んでよい。
// - stale: 別のタブで端末データが削除・変更された（再読み込み案内は App の storage イベントの経路で出す）。
// - storage_error: localStorage の読み書きに失敗した（容量超過など）。容量が空けば次の保存で回復する。
// - reload_required: このタブでは epoch を確定できない。再読み込みが必要。
type DeviceDataEpochState = "current" | "stale" | "storage_error" | "reload_required";

// このタブから端末データへ書き込んでよいかを判定する。
// 起動時に epoch を確定できなかったタブは、ここで確定を再試行する。
// - epoch キーがまだ存在しない: どのタブも epoch を進めていない（端末データの削除・所有者の変更は、必ず先に
//   epoch キーを書き込み、その書き込みが失敗すれば削除や変更に進まない）。このタブの state が古くなる操作は
//   起きていないので、ここで作成して控えにする。作成が失敗すれば storage_error（容量が空けば次の保存で回復する）。
// - epoch キーが既に存在する: 起動後に別のタブが作成・更新した値かもしれず、その前後で端末データが削除・変更された
//   可能性を否定できない。控えには採用せず、再読み込みを求める（再読み込みすれば起動時に通常どおり控えられる）。
// 控えがあるタブでキーが存在しない場合（サイトデータの手動消去など。アプリ自身は epoch キーを削除しない）は、
// 別のタブが epoch を進めた証拠がないため一致とみなし、控えの値で作り直す。
function checkDeviceDataEpoch(): DeviceDataEpochState {
  if (typeof window === "undefined") {
    return "storage_error";
  }
  if (capturedEpoch === null) {
    if (reloadRequired) {
      return "reload_required";
    }
    try {
      if (window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY) !== null) {
        updateSaveProblem(() => {
          reloadRequired = true;
        });
        return "reload_required";
      }
      const created = createEpochValue();
      window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, created);
      capturedEpoch = created;
      return "current";
    } catch {
      return "storage_error";
    }
  }
  try {
    const stored = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);
    if (stored === null) {
      window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, capturedEpoch);
      return "current";
    }
    return stored === capturedEpoch ? "current" : "stale";
  } catch {
    return "storage_error";
  }
}

// このタブの控えが localStorage の現在の epoch と一致するか（＝このタブから端末データへ書き込んでよいか）を返す。
export function isDeviceDataEpochCurrent(): boolean {
  return checkDeviceDataEpoch() === "current";
}

// ---------------------------------------------------------------------------
// 保存できなかったことの通知（無言でデータを捨てないため）
// ---------------------------------------------------------------------------

// 端末データの保存の問題。none 以外のときは App が利用者に知らせる。
// - storage_error: 保存できなかったキーがある（容量超過など）。そのキーの保存が成功すれば解消する。
// - reload_required: このタブでは保存できない。再読み込みが必要。
export type DeviceDataSaveProblem = "none" | "storage_error" | "reload_required";

// 直近の保存が失敗したままのキーと、そのキーに最後に書き込もうとした値（null は削除）。
// そのキーの保存が成功するか、別のキーの保存が成功したときの再試行が成功したら取り除く。
const failedWrites = new Map<DeviceDataStorageKey, string | null>();
// 保存の問題の変化を受け取るリスナー。
const saveProblemListeners = new Set<() => void>();

// 現在の保存の問題を返す（useSyncExternalStore のスナップショット）。
export function getDeviceDataSaveProblem(): DeviceDataSaveProblem {
  if (reloadRequired) {
    return "reload_required";
  }
  return failedWrites.size > 0 ? "storage_error" : "none";
}

// 保存の問題の変化を購読する。戻り値で購読を解除する。
export function subscribeDeviceDataSaveProblem(listener: () => void): () => void {
  saveProblemListeners.add(listener);
  return () => {
    saveProblemListeners.delete(listener);
  };
}

// 保存の問題が変わったらリスナーへ知らせる。
function updateSaveProblem(change: () => void): void {
  const before = getDeviceDataSaveProblem();
  change();
  if (getDeviceDataSaveProblem() !== before) {
    for (const listener of saveProblemListeners) {
      listener();
    }
  }
}

// キーの保存が失敗したことを、書き込もうとした値とともに記録する。
function markSaveFailed(key: DeviceDataStorageKey, value: string | null): void {
  updateSaveProblem(() => {
    failedWrites.set(key, value);
  });
}

// キーの保存が成功したことを記録し、保存できていない他のキーを再試行する。
// 保存が成功した＝容量が空いた・epoch を確定できた可能性があるため、利用者が同じキーを再び編集するのを待たずに回復させる。
// 再試行する値は、そのキーにこのタブが最後に書き込もうとした値（成功していれば保存されていたはずの値）。
// 呼び出し元で epoch が現在の値と一致することを確かめた直後に呼ぶ。
function markSaveSucceeded(key: DeviceDataStorageKey): void {
  if (failedWrites.size === 0) {
    return;
  }
  updateSaveProblem(() => {
    failedWrites.delete(key);
    for (const [pendingKey, pendingValue] of failedWrites) {
      try {
        if (pendingValue === null) {
          window.localStorage.removeItem(pendingKey);
        } else {
          window.localStorage.setItem(pendingKey, pendingValue);
        }
        failedWrites.delete(pendingKey);
      } catch {
        // まだ保存できない。次の保存の成功時に再試行する。
      }
    }
  });
}

// 書き込みを拒否した理由に応じて、保存できなかったことを記録する。
// stale（別のタブで変更済み）は App の再読み込み案内の経路で知らせるため、ここでは記録しない。
// 保存先の値が既に書き込もうとした値と同じなら、失われるものがないので記録しない。
function recordRefusedWrite(key: DeviceDataStorageKey, state: DeviceDataEpochState, value: string | null): void {
  // reload_required は checkDeviceDataEpoch で記録済み。
  if (state !== "storage_error") {
    return;
  }
  try {
    if (window.localStorage.getItem(key) === value) {
      return;
    }
  } catch {
    // 読み取りもできない場合は、保存できなかったものとして扱う。
  }
  markSaveFailed(key, value);
}

// 端末データの epoch を進める（このタブの控えも新しい値へ更新する）。
// 別のタブはこれ以降、端末データへ書き込めなくなる。このタブは引き続き書き込める（所有者の引き継ぎなど、
// 操作後もこのタブで使い続ける場合に使う）。
export function bumpDeviceDataEpoch(): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = createEpochValue();
  window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, next);
  capturedEpoch = next;
}

// 端末データの epoch を進め、このタブの控えは古いままにする。
// 別のタブに加えてこのタブ自身も、これ以降は端末データへ書き込めなくなる。端末データを削除して
// 再読み込みするまでの間に、このタブに残った古い state（pagehide 時の保存など）が書き戻されるのを防ぐ。
export function sealDeviceDataWrites(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, createEpochValue());
}

// 端末データのキーへ値を書き込む。書き込めない状態のタブからは何もしない。書き込んだら true を返す。
// 書き込めなかったときは、理由に応じて保存の問題として記録する（App が利用者に知らせる）。
// localStorage の例外（容量超過など）は、記録したうえで呼び出し側で扱えるようそのまま投げる（バックアップ復元のロールバック等）。
export function writeDeviceStorage(key: DeviceDataStorageKey, value: string): boolean {
  const state = checkDeviceDataEpoch();
  if (state !== "current") {
    recordRefusedWrite(key, state, value);
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    markSaveFailed(key, value);
    throw error;
  }
  markSaveSucceeded(key);
  return true;
}

// 端末データのキーを削除する。書き込めない状態のタブからは何もしない。削除したら true を返す。
export function removeDeviceStorage(key: DeviceDataStorageKey): boolean {
  const state = checkDeviceDataEpoch();
  if (state !== "current") {
    recordRefusedWrite(key, state, null);
    return false;
  }
  window.localStorage.removeItem(key);
  markSaveSucceeded(key);
  return true;
}

// 端末データの 6 キーをすべて削除する（ログアウト時の削除・別アカウントのデータを使わない選択で使う）。
// 呼び出し側で epoch を進めた直後に呼ぶ前提のため、epoch の一致は確認しない（削除はデータを残さない方向の操作）。
// epoch キーは削除しない（削除すると、古いタブが「epoch を進めた証拠がない」とみなして書き込めてしまう）。
export function clearDeviceUserData(): void {
  if (typeof window === "undefined") {
    return;
  }
  for (const key of DEVICE_DATA_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
  // 保存できていなかった値も捨てる（削除後の保存の成功時に再試行され、削除したデータが戻るのを防ぐ）。
  updateSaveProblem(() => {
    failedWrites.clear();
  });
}
