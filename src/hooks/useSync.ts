import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadConnectRankCalcState, saveConnectRankCalcState } from "../domain/connectRankCalcStorage";
import { saveStoredState } from "../domain/storage";
import { CONNECT_RANK_CALC_STORAGE_KEY, STORAGE_KEY } from "../domain/storageKeys";
import type { SyncPayloadV1 } from "../domain/sync";
import {
  buildSyncPayloadFromCurrent,
  decideStartupAction,
  fetchServerData,
  hasLocalRealData,
  isSafeToAutoAdopt,
  putServerData,
} from "../domain/syncClient";
import {
  clearSyncMeta,
  loadSyncMeta,
  loadTouchedFlag,
  markTouched,
  saveSyncMeta,
  type SyncMetaV1,
} from "../domain/syncMeta";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";
import { useSession } from "../lib/authClient";

// PUT のデバウンス間隔（ミリ秒）。10 秒（レート制限 30 回/5 分に対し十分低頻度。設計判断 3）。
const PUT_DEBOUNCE_MS = 10_000;

// 同期ステータス（ヘッダー表示用）。
export type SyncStatus =
  | "logged_out" // 未ログイン（同期しない）。
  | "loading" // セッション確認中。
  | "idle" // ログイン済み・同期済み。
  | "syncing" // 同期中（GET/PUT 実行中）。
  | "error"; // 同期エラー（次回変更・次回起動で自動リトライ）。

// 競合ダイアログに表示する情報（双方の updatedAt）。
export type ConflictInfo = {
  // この競合が「どのアカウントの文脈で」生成されたか。
  // 解決（採用/ローカル優先 PUT）の実行時に最新セッションと照合し、GET 待ち中や表示中に
  // アカウントが切り替わっていた場合は旧文脈の競合を解決として実行しない（データ喪失防止）。
  userId: string;
  // サーバー側データの updatedAt。
  serverUpdatedAt: string;
  // ローカル側データの updatedAt。
  localUpdatedAt: string;
  // 競合解決に使う、GET で得たサーバーの最新 revision と payload。
  serverRevision: number;
  serverPayload: SyncPayloadV1;
};

// useSync が App へ返すインターフェース。
export type UseSyncResult = {
  // ログイン中か（UI 切り替え用）。
  isLoggedIn: boolean;
  // セッション確認中か（初期表示のちらつき抑止用）。
  isSessionPending: boolean;
  // ログインユーザーの表示名（メニュー表示用。表示のみ。email はフォールバックに使わない。設計判断 4）。
  userLabel: string | null;
  // 同期ステータス。
  status: SyncStatus;
  // 競合ダイアログ情報（null なら非表示）。
  conflict: ConflictInfo | null;
  // ユーザーがローカル編集を行ったときに呼ぶ（localChangeSeq を加算し、デバウンス PUT を予約する）。
  notifyLocalChange: () => void;
  // バックアップインポート直後（リロード前提の localStorage 直接書き換え）に呼ぶ。
  // touched + localChangeSeq 加算（永続 dirty 化）のみ行い、**PUT は予約しない**。
  // インメモリ state はインポート前のままなので、リロード前に PUT が走ると旧 state が
  // インポート結果を上書き・送信してしまう。予約済み PUT も同じ理由でキャンセルする。
  // 同期はリロード後の起動フローが dirty を検出して行う。
  notifyLocalDataImported: () => void;
  // 競合ダイアログで「サーバーのデータを使う」を選んだとき。
  resolveConflictUseServer: () => void;
  // 競合ダイアログで「この端末のデータを使う」を選んだとき（PUT を伴うため非同期）。
  resolveConflictUseLocal: () => Promise<void>;
  // アカウント削除の直前に呼ぶ。予約済みデバウンス PUT をキャンセルし、世代を進めて in-flight PUT の
  // 完了処理（メタ書き込み・再予約）を無効化する。削除〜リロードの間に PUT が走って削除済み行を
  // 再作成するのを防ぐ（Phase 4）。
  stopSync: () => void;
};

// useSync の呼び出しに必要な依存。
export type UseSyncOptions = {
  // App の現在の育成データ state（正規化済み）を返すゲッター。常に最新を読むため関数で受け取る。
  getState: () => StoredStateV1;
  // マスターデータ（初期状態判定に使う）。
  masterCharacters: MasterCharacter[];
  // サーバーデータ採用時に呼ぶ。App 側で「ダイアログ表示 → リロード」を行う（既存インポート復元と同じパターン）。
  onServerDataAdopted: () => void;
};

// フロントエンド同期層の React 統合フック。
//
// 責務: セッション監視・アカウント切替検知・起動時 GET フロー・10 秒デバウンス PUT・
// 409/競合ダイアログ管理・401 ログアウト扱い。純粋な判定ロジックは syncClient.ts に委譲する。
export function useSync(options: UseSyncOptions): UseSyncResult {
  const { getState, masterCharacters, onServerDataAdopted } = options;
  const session = useSession();

  // 現在のセッションユーザー ID（未ログインなら null）。
  const userId = session.data?.user.id ?? null;
  // 表示名のみを表示ラベルに使う。email はフォールバックにも使わない（PII 方針。設計判断 4）。
  // 設計書「PII の扱い」節が email の画面表示（二次利用）を禁じているため、DOM に email を出さない。
  // さらに、GitHub/Google の表示名はユーザー設定次第でメールアドレスと同一文字列になり得るため、
  // name が email 形式（`@` を含む）の場合も null に落とす。null 時は SyncHeader が汎用表記
  // 「ログイン中」を表示し、ポリシーの「メールアドレスは画面上には表示しません」との矛盾を防ぐ。
  const rawUserName = session.data?.user.name || null;
  const userLabel = rawUserName !== null && !rawUserName.includes("@") ? rawUserName : null;

  const [status, setStatus] = useState<SyncStatus>("loading");
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  // getState / onServerDataAdopted は毎レンダーで参照が変わりうるため、effect の依存から外すために ref に保持する。
  const getStateRef = useRef(getState);
  getStateRef.current = getState;
  const onServerDataAdoptedRef = useRef(onServerDataAdopted);
  onServerDataAdoptedRef.current = onServerDataAdopted;

  // 常に最新のセッションユーザー ID を参照するための ref。
  // async 処理（GET/PUT）の復帰後にクロージャ変数 userId と比較することで、待機中のアカウント切替を検知する。
  // クロージャ値同士（session.data と userId）の比較は生成時 render の値で常に一致してしまうため必ずこの ref を使う。
  const latestUserIdRef = useRef<string | null>(userId);
  latestUserIdRef.current = userId;

  // 同期処理の世代カウンタ。
  // インポートやサーバーデータ採用など「localStorage を直接書き換えリロードを前提とする」操作で世代を進める。
  // in-flight の PUT/GET は開始時に世代を控え、await 復帰後に世代が進んでいたら後続処理
  // （メタ書き込み・再予約・saveStoredState を伴う次の PUT）を黙って中断する。
  // これにより「開始済みの PUT の完了処理が、インポート後に旧 in-memory state で localStorage を
  // 上書きする」レースを閉じる（デバウンス予約のキャンセルだけでは開始済み PUT を止められない）。
  const syncGenerationRef = useRef(0);

  // デバウンスタイマー ID。
  const putTimerRef = useRef<number | null>(null);
  // 起動時フローを（userId ごとに）一度だけ走らせるためのフラグ。
  const startupRanForUserRef = useRef<string | null>(null);

  // 同期メタを読み込むヘルパー（常に最新を localStorage から読む）。
  const readMeta = useCallback((): SyncMetaV1 | null => loadSyncMeta(), []);

  // ローカルに実データがあるかを判定する（in-memory state + 計算タブ + touched）。
  const computeHasLocalRealData = useCallback((): boolean => {
    return hasLocalRealData(
      {
        touched: loadTouchedFlag(),
        storedState: getStateRef.current(),
        calcState: loadConnectRankCalcState(),
      },
      masterCharacters,
    );
  }, [masterCharacters]);

  // ローカル編集を記録する。touched を立て、localChangeSeq を加算し、デバウンス PUT を予約する。
  const notifyLocalChange = useCallback(() => {
    // 未ログイン時は同期メタを一切触らない（ローカルモード完全維持）。touched だけ立てる。
    markTouched();
    if (!userId) {
      return;
    }
    const meta = readMeta();
    // 同期メタが未確立（起動フロー未完了）の場合は seq を進めない。起動フロー完了後の編集から数える。
    if (!meta || meta.userId !== userId) {
      return;
    }
    // localChangeSeq を単調増加させる（dirty = localChangeSeq > lastSyncedSeq）。
    const nextMeta: SyncMetaV1 = { ...meta, localChangeSeq: meta.localChangeSeq + 1 };
    saveSyncMeta(nextMeta);
    schedulePut();
  }, [userId, readMeta]);

  // バックアップインポート直後の記録。touched + 永続 dirty 化のみ行い、PUT は予約しない。
  // インメモリ state はインポート前の旧データのままなので、リロード前に runPut が走ると
  // saveStoredState(旧 state) がインポート結果の localStorage を上書きし、旧 state をサーバーへ
  // 送ってしまう（データ喪失）。同じ理由で、既に予約済みのデバウンス PUT もキャンセルする。
  // 完了ダイアログを閉じるとリロードされ、リロード後の起動フローが dirty を検出して
  // 正しいインポート済みデータを同期する。
  const notifyLocalDataImported = useCallback(() => {
    markTouched();
    // 世代を進め、開始済み（in-flight）の PUT/GET の完了処理を無効化する。
    // デバウンス予約のキャンセルだけでは、既に putServerData を await 中の runPut が
    // 成功復帰後に「後続編集あり → 再予約」して旧 in-memory state で localStorage を
    // 上書きする経路が残るため、世代不一致で完了処理ごと中断させる。
    syncGenerationRef.current += 1;
    // 予約済みのデバウンス PUT をキャンセルする（旧 in-memory state での上書きを防ぐ）。
    if (putTimerRef.current !== null) {
      window.clearTimeout(putTimerRef.current);
      putTimerRef.current = null;
    }
    if (!userId) {
      return;
    }
    const meta = readMeta();
    if (!meta || meta.userId !== userId) {
      return;
    }
    // 永続 dirty 化のみ（PUT 予約なし）。リロード後の起動フローで同期される。
    saveSyncMeta({ ...meta, localChangeSeq: meta.localChangeSeq + 1 });
  }, [userId, readMeta]);

  // アカウント削除の直前に同期を停止する（Phase 4）。
  // 世代を進めて in-flight の PUT/GET の完了処理を黙って中断させ、予約済みデバウンス PUT もキャンセルする。
  // これにより、削除リクエスト〜リロードの間に PUT が走って削除済みの app_state 行を再作成する
  // レースを閉じる（削除成功後はサーバーがセッションも失効させるため、以降の PUT は 401 になる）。
  const stopSync = useCallback(() => {
    syncGenerationRef.current += 1;
    if (putTimerRef.current !== null) {
      window.clearTimeout(putTimerRef.current);
      putTimerRef.current = null;
    }
  }, []);

  // 直前の PUT を実行する内部処理（デバウンス満了時・明示 flush 時に呼ぶ）。
  const runPut = useCallback(async () => {
    if (!userId) {
      return;
    }
    const meta = readMeta();
    if (!meta || meta.userId !== userId) {
      return;
    }
    // dirty でなければ送らない。
    if (meta.localChangeSeq <= meta.lastSyncedSeq) {
      return;
    }
    // この PUT が「どこまでの編集を送るか」を開始時点の seq で確定する（設計判断 1）。
    const seqBeingSent = meta.localChangeSeq;
    // 開始時点の世代を控える。await 復帰後に世代が進んでいたら（インポート等が挟まったら）完了処理を中断する。
    const generationAtStart = syncGenerationRef.current;
    // デバウンス保存待ちの育成データを先に localStorage へ確定させ、正規化経由のペイロード構築の前提を揃える。
    saveStoredState(getStateRef.current());
    const payload = buildSyncPayloadFromCurrent(getStateRef.current());

    setStatus("syncing");
    const result = await putServerData(meta.revision, payload);

    // PUT 中にインポート等で世代が進んでいたら、成功/失敗を問わず後続処理をすべて中断する。
    // ここでメタ書き込みや再予約を行うと、次の runPut が旧 in-memory state で saveStoredState し、
    // インポート済みの localStorage を上書きしてしまう（リロード後の起動フローに委ねる）。
    if (syncGenerationRef.current !== generationAtStart) {
      return;
    }

    if (result.kind === "ok") {
      // 成功時: revision 更新 + 送った seq を lastSyncedSeq に記録（PUT 中の後続編集は dirty のまま残る）。
      // PUT 中にセッションのアカウントが切り替わっていたらメタを書かない（旧アカウントの revision を新文脈へ持ち込まない）。
      if (latestUserIdRef.current !== userId) {
        return;
      }
      const latest = readMeta();
      // PUT 中にメタ破棄（clearSyncMeta）や別アカウントのメタへの差し替えが起きていないかも確認する。
      if (!latest || latest.userId !== userId) {
        return;
      }
      saveSyncMeta({
        userId,
        revision: result.revision,
        localChangeSeq: latest.localChangeSeq,
        lastSyncedSeq: seqBeingSent,
      });
      // まだ後続編集が残っていれば次のデバウンス PUT を予約する。
      if (latest.localChangeSeq > seqBeingSent) {
        setStatus("syncing");
        schedulePut();
      } else {
        setStatus("idle");
      }
      return;
    }

    if (result.kind === "conflict") {
      // 409: 最新サーバーデータを取得して競合ダイアログを提示する。
      await presentConflictFromServer();
      return;
    }

    if (result.kind === "unauthorized") {
      // 401: セッション切れ。メタ破棄しログアウト扱いに戻す。
      handleUnauthorized();
      return;
    }

    // その他エラー: モーダルは出さずステータス表示のみ（次回変更・次回起動で自動リトライ）。
    setStatus("error");
  }, [userId, readMeta]);

  // runPut を最新参照で呼べるよう ref に保持する（schedulePut の setTimeout から使う）。
  const runPutRef = useRef(runPut);
  runPutRef.current = runPut;

  // デバウンス PUT を予約する（既存タイマーはクリアして貼り直す）。
  const schedulePut = useCallback(() => {
    if (putTimerRef.current !== null) {
      window.clearTimeout(putTimerRef.current);
    }
    putTimerRef.current = window.setTimeout(() => {
      putTimerRef.current = null;
      void runPutRef.current();
    }, PUT_DEBOUNCE_MS);
  }, []);

  // 401 検出時の共通処理: メタ破棄・状態リセット。better-auth 側のセッションも失効しているため UI はログアウト表示へ戻る。
  const handleUnauthorized = useCallback(() => {
    clearSyncMeta();
    startupRanForUserRef.current = null;
    setConflict(null);
    setStatus("logged_out");
  }, []);

  // サーバーの最新データを GET し、競合ダイアログ情報を組み立てて提示する（409 / 409 後の再取得で使う）。
  const presentConflictFromServer = useCallback(async () => {
    if (!userId) {
      return;
    }
    // 開始時点の世代を控える（GET 中にインポート等が挟まったら旧文脈の競合を出さない）。
    const generationAtStart = syncGenerationRef.current;
    const result = await fetchServerData();
    // GET 待ち中にアカウントが切り替わっていたら、旧アカウント文脈の競合を提示せず中断する。
    // 旧文脈の競合をユーザーが解決すると、旧アカウント由来の payload/revision を
    // 新アカウントへ採用・PUT してしまうため（データ喪失防止）。
    if (latestUserIdRef.current !== userId) {
      return;
    }
    // GET 中に世代が進んでいたら（インポート等）同様に中断する。
    if (syncGenerationRef.current !== generationAtStart) {
      return;
    }
    if (result.kind === "unauthorized") {
      handleUnauthorized();
      return;
    }
    if (result.kind !== "found") {
      // GET が not_found/error の場合は競合を確定できないためエラー表示に留める。
      setStatus("error");
      return;
    }
    setConflict({
      // この競合がどのアカウント文脈で生成されたかを記録する（解決時に再照合する）。
      userId,
      serverUpdatedAt: result.updatedAt,
      localUpdatedAt: getStateRef.current().updatedAt,
      serverRevision: result.revision,
      serverPayload: result.payload,
    });
    // 競合中は status を error 相当（要対応）ではなく、ダイアログで解決を促すため idle に戻す。
    setStatus("idle");
  }, [userId, handleUnauthorized]);

  // 検証済みサーバーペイロードを localStorage へ書き込み、同期メタを更新して採用する。
  // 反映は App 側の onServerDataAdopted（ダイアログ → リロード）に委ねる（設計判断 6）。
  const adoptServerPayload = useCallback(
    (revision: number, payload: SyncPayloadV1) => {
      if (!userId) {
        return;
      }
      // 採用直前の最終確認: 呼び出し元の async 待機中にアカウントが切り替わっていたら何も書かない。
      // 旧アカウント文脈の revision/payload を新アカウントへ採用・メタ保存することを防ぐ（データ喪失防止）。
      if (latestUserIdRef.current !== userId) {
        return;
      }
      // 世代を進め、開始済み（in-flight）の PUT/GET の完了処理を無効化する。
      // ここからリロード（App 側ダイアログ経由）までの間に旧 in-memory state の PUT 完了処理が
      // 走ると、採用したサーバーデータの localStorage を上書きしてしまうため。
      syncGenerationRef.current += 1;
      // 予約済みのデバウンス PUT も同じ理由でキャンセルする。
      if (putTimerRef.current !== null) {
        window.clearTimeout(putTimerRef.current);
        putTimerRef.current = null;
      }
      // 2 キーを localStorage へ書き込む。
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.storage[STORAGE_KEY]));
      saveConnectRankCalcState(payload.storage[CONNECT_RANK_CALC_STORAGE_KEY]);
      // 採用直後は「サーバーと完全一致」なので dirty でない状態にする（seq を揃える）。
      saveSyncMeta({ userId, revision, localChangeSeq: 0, lastSyncedSeq: 0 });
      onServerDataAdoptedRef.current();
    },
    [userId],
  );

  // ローカルデータを baseRevision:null でアップロードする（引き継ぎ分岐 1）。
  const uploadLocalAsNew = useCallback(async () => {
    if (!userId) {
      return;
    }
    // 開始時点の世代を控える（PUT 中のインポート等で前提が崩れたら完了処理を中断する）。
    const generationAtStart = syncGenerationRef.current;
    saveStoredState(getStateRef.current());
    const payload = buildSyncPayloadFromCurrent(getStateRef.current());
    setStatus("syncing");
    const result = await putServerData(null, payload);
    // PUT 中に世代が進んでいたら後続処理をすべて中断する。
    if (syncGenerationRef.current !== generationAtStart) {
      return;
    }
    if (result.kind === "ok") {
      // PUT 中にアカウントが切り替わっていたらメタを書かない（await 後は開始時点の前提を再検証する）。
      if (latestUserIdRef.current !== userId) {
        return;
      }
      // アップロード成功: 完全同期状態としてメタを確立する。
      saveSyncMeta({ userId, revision: result.revision, localChangeSeq: 0, lastSyncedSeq: 0 });
      setStatus("idle");
      return;
    }
    if (result.kind === "conflict") {
      // 並行して別端末が先に行を作成していた（409）。最新を取得して競合提示。
      await presentConflictFromServer();
      return;
    }
    if (result.kind === "unauthorized") {
      handleUnauthorized();
      return;
    }
    setStatus("error");
  }, [userId, presentConflictFromServer, handleUnauthorized]);

  // 通常 PUT（同期済み revision 一致 & dirty）を実行する。
  const runDirtyPut = useCallback(async () => {
    await runPutRef.current();
  }, []);

  // 起動時・ログイン直後の同期フロー本体（設計判断 4）。
  const runStartupFlow = useCallback(async () => {
    if (!userId) {
      return;
    }

    // --- アカウント切替検知（設計判断 1）: メタの userId が現セッションと不一致ならメタ破棄 → 初回引き継ぎへ倒す。---
    let meta = readMeta();
    if (meta && meta.userId !== userId) {
      clearSyncMeta();
      meta = null;
    }

    // GET 前に控える localChangeSeq（自動採用直前の再検証に使う。設計判断 6）。
    const seqAtDecision = meta ? meta.localChangeSeq : 0;
    const dirty = meta ? meta.localChangeSeq > meta.lastSyncedSeq : false;
    const knownRevision = meta ? meta.revision : null;
    // 開始時点の世代を控える（GET 中にインポート等が挟まったら判定前提が崩れるため中断する）。
    const generationAtStart = syncGenerationRef.current;

    setStatus("syncing");
    const fetchResult = await fetchServerData();

    if (fetchResult.kind === "unauthorized") {
      handleUnauthorized();
      return;
    }
    if (fetchResult.kind === "error") {
      setStatus("error");
      return;
    }

    // GET 中にアカウントが切り替わっていないか、最新セッション ID（ref）と照合して再確認する。
    // クロージャの session.data と比較すると常に一致してしまう（生成時 render の値同士）ため ref を使う。
    if (latestUserIdRef.current !== userId) {
      return;
    }
    // GET 中にインポート等で世代が進んでいたら中断する（dirty/seq の判定前提が崩れている。
    // 特に put_dirty へ進むと旧 in-memory state の saveStoredState でインポート結果を上書きしてしまう）。
    if (syncGenerationRef.current !== generationAtStart) {
      return;
    }

    const localHasRealData = computeHasLocalRealData();
    const normalizedFetch: { kind: "found"; revision: number } | { kind: "not_found" } =
      fetchResult.kind === "found" ? { kind: "found", revision: fetchResult.revision } : { kind: "not_found" };

    const action = decideStartupAction({
      fetchResult: normalizedFetch,
      knownRevision,
      dirty,
      localHasRealData,
    });

    switch (action) {
      case "upload_new":
        await uploadLocalAsNew();
        return;
      case "noop":
        // サーバー空 & ローカル初期 → 何もしない（メタは次の変更・次の同期成功時に確立する）。
        // サーバーあり & revision 一致 & dirty でない → 同期済みの確認のみ。
        if (fetchResult.kind === "found") {
          // await 後は開始時点の前提を再検証する（adopt_server 分岐と同じ原則）。
          // GET 前に控えたクロージャの meta ではなく localStorage の最新メタを読み直す。
          // GET 中にユーザー編集が入って localChangeSeq が進んでいた場合、stale な meta で
          // lastSyncedSeq を進めてしまうと編集が clean 扱いになり永久に同期されなくなるため、
          // fresh な seq 値をそのまま保持し revision だけ最新（= 一致確認済みのサーバー値）に揃える。
          const fresh = readMeta();
          if (fresh && fresh.userId === userId) {
            saveSyncMeta({
              userId,
              revision: fetchResult.revision,
              localChangeSeq: fresh.localChangeSeq,
              lastSyncedSeq: fresh.lastSyncedSeq,
            });
          }
          // fresh が無い/別アカウントの場合は書かない（GET 中のメタ破棄・切替を尊重する）。
        }
        setStatus("idle");
        return;
      case "put_dirty":
        await runDirtyPut();
        return;
      case "adopt_server": {
        if (fetchResult.kind !== "found") {
          setStatus("idle");
          return;
        }
        // --- 自動採用の直前再検証（設計判断 6）: 判定〜採用の間にユーザー編集が入っていないか。---
        const currentSeq = readMeta()?.localChangeSeq ?? seqAtDecision;
        if (!isSafeToAutoAdopt(seqAtDecision, currentSeq)) {
          // 進んでいたら黙って採用せず競合へ倒す。
          setConflict({
            userId,
            serverUpdatedAt: fetchResult.updatedAt,
            localUpdatedAt: getStateRef.current().updatedAt,
            serverRevision: fetchResult.revision,
            serverPayload: fetchResult.payload,
          });
          setStatus("idle");
          return;
        }
        adoptServerPayload(fetchResult.revision, fetchResult.payload);
        return;
      }
      case "conflict": {
        if (fetchResult.kind !== "found") {
          setStatus("idle");
          return;
        }
        setConflict({
          userId,
          serverUpdatedAt: fetchResult.updatedAt,
          localUpdatedAt: getStateRef.current().updatedAt,
          serverRevision: fetchResult.revision,
          serverPayload: fetchResult.payload,
        });
        setStatus("idle");
        return;
      }
    }
  }, [
    userId,
    readMeta,
    computeHasLocalRealData,
    uploadLocalAsNew,
    runDirtyPut,
    adoptServerPayload,
    handleUnauthorized,
  ]);

  const runStartupFlowRef = useRef(runStartupFlow);
  runStartupFlowRef.current = runStartupFlow;

  // セッション状態に応じてステータスと起動フローを制御する。
  useEffect(() => {
    if (session.isPending) {
      setStatus("loading");
      return;
    }
    if (!userId) {
      // 未ログイン: 同期メタを持っていても触らない（次回ログイン時にアカウント突き合わせで処理）。
      startupRanForUserRef.current = null;
      setStatus("logged_out");
      return;
    }
    // ログイン確定。まだこの userId で起動フローを走らせていなければ走らせる。
    if (startupRanForUserRef.current !== userId) {
      startupRanForUserRef.current = userId;
      void runStartupFlowRef.current();
    }
  }, [session.isPending, userId]);

  // アンマウント時にデバウンスタイマーを片付ける。
  useEffect(() => {
    return () => {
      if (putTimerRef.current !== null) {
        window.clearTimeout(putTimerRef.current);
      }
    };
  }, []);

  // 競合ダイアログ: 「サーバーのデータを使う」。採用してリロード（ユーザーの明示選択なので seq 再検証は不要。設計判断 6）。
  const resolveConflictUseServer = useCallback(() => {
    const current = conflict;
    setConflict(null);
    if (!current) {
      return;
    }
    // この競合が生成されたアカウント文脈と現在のセッションが一致するかを照合する。
    // 表示中〜解決の間にアカウントが切り替わっていた場合、旧アカウント由来の payload/revision を
    // 新アカウントへ採用してしまうため、不一致なら競合をクリアするだけで何もしない。
    if (current.userId !== latestUserIdRef.current) {
      return;
    }
    adoptServerPayload(current.serverRevision, current.serverPayload);
  }, [conflict, adoptServerPayload]);

  // 競合ダイアログ: 「この端末のデータを使う」。GET で得た最新 revision を baseRevision に PUT する（設計判断 7）。
  const resolveConflictUseLocal = useCallback(async () => {
    const current = conflict;
    setConflict(null);
    if (!current || !userId) {
      return;
    }
    // 競合の生成文脈と現在のセッションを照合する（resolveConflictUseServer と同じ理由）。
    // 不一致なら、旧アカウント文脈の revision でこの端末のデータを新アカウントへ PUT しない。
    if (current.userId !== latestUserIdRef.current) {
      return;
    }
    // 開始時点の世代を控える（PUT 中のインポート等で前提が崩れたら完了処理を中断する）。
    const generationAtStart = syncGenerationRef.current;
    saveStoredState(getStateRef.current());
    const payload = buildSyncPayloadFromCurrent(getStateRef.current());
    setStatus("syncing");
    const result = await putServerData(current.serverRevision, payload);
    // PUT 中に世代が進んでいたら後続処理をすべて中断する。
    if (syncGenerationRef.current !== generationAtStart) {
      return;
    }
    if (result.kind === "ok") {
      // PUT 中にアカウントが切り替わっていたらメタを書かない（await 後は開始時点の前提を再検証する）。
      if (latestUserIdRef.current !== userId) {
        return;
      }
      const latest = loadSyncMeta();
      const localChangeSeq = latest && latest.userId === userId ? latest.localChangeSeq : 0;
      saveSyncMeta({ userId, revision: result.revision, localChangeSeq, lastSyncedSeq: localChangeSeq });
      setStatus("idle");
      return;
    }
    if (result.kind === "conflict") {
      // 再度 409（さらに別更新が挟まった）: 再度ダイアログを提示する。
      await presentConflictFromServer();
      return;
    }
    if (result.kind === "unauthorized") {
      handleUnauthorized();
      return;
    }
    setStatus("error");
  }, [conflict, userId, presentConflictFromServer, handleUnauthorized]);

  const isLoggedIn = userId !== null;
  const isSessionPending = session.isPending;

  return useMemo(
    () => ({
      isLoggedIn,
      isSessionPending,
      userLabel,
      status,
      conflict,
      notifyLocalChange,
      notifyLocalDataImported,
      resolveConflictUseServer,
      resolveConflictUseLocal,
      stopSync,
    }),
    [
      isLoggedIn,
      isSessionPending,
      userLabel,
      status,
      conflict,
      notifyLocalChange,
      notifyLocalDataImported,
      resolveConflictUseServer,
      resolveConflictUseLocal,
      stopSync,
    ],
  );
}
