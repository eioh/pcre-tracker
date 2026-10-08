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
    console.warn("端末データの世代を保存できないため、このタブでは端末データを保存しません", { error });
    return null;
  }
}

// このタブが控えている epoch。モジュール読み込み時（＝タブ起動時）に確定させる。
// 遅延初期化にすると、別のタブが epoch を進めた後に初めて書き込むタブが新しい値を控えてしまい、書き戻しを止められない。
// null は起動時に確定できなかったことを表す。後から読み直すと同じ理由で書き戻しを止められないため、
// このタブの間は端末データへ書き込まない側に倒す（アプリは起動し、表示と操作はできる。
// 起動時に世代を保存できない状態では、端末データの保存もほぼ失敗するため、失うものは小さい）。
let capturedEpoch: string | null = readOrCreateEpoch();

// このタブの控えが localStorage の現在の epoch と一致するか（＝このタブから端末データへ書き込んでよいか）を返す。
// キーが存在しない場合（サイトデータの手動消去など。アプリ自身は epoch キーを削除しない）は、
// 別のタブが epoch を進めた証拠がないため一致とみなし、控えの値で作り直す。
// 起動時に epoch を確定できなかったタブと、localStorage の読み書きに失敗した場合は一致しないとみなす。
export function isDeviceDataEpochCurrent(): boolean {
  if (typeof window === "undefined" || capturedEpoch === null) {
    return false;
  }
  try {
    const stored = window.localStorage.getItem(DEVICE_DATA_EPOCH_STORAGE_KEY);
    if (stored === null) {
      window.localStorage.setItem(DEVICE_DATA_EPOCH_STORAGE_KEY, capturedEpoch);
      return true;
    }
    return stored === capturedEpoch;
  } catch {
    return false;
  }
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

// 端末データのキーへ値を書き込む。epoch が古いタブからの書き込みは何もしない。
// 書き込んだら true を返す。localStorage の例外（容量超過など）は呼び出し側で扱えるようそのまま投げる。
export function writeDeviceStorage(key: DeviceDataStorageKey, value: string): boolean {
  if (!isDeviceDataEpochCurrent()) {
    return false;
  }
  window.localStorage.setItem(key, value);
  return true;
}

// 端末データのキーを削除する。epoch が古いタブからの削除は何もしない。削除したら true を返す。
export function removeDeviceStorage(key: DeviceDataStorageKey): boolean {
  if (!isDeviceDataEpochCurrent()) {
    return false;
  }
  window.localStorage.removeItem(key);
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
}
