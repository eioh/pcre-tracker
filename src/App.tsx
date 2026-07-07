import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { masterCharacters } from "./domain/master";

// タブ表示時にのみ読み込むことで初期バンドルを軽量化する。
const DashboardTab = lazy(() => import("./components/DashboardTab").then((m) => ({ default: m.DashboardTab })));
const InputTab = lazy(() => import("./components/InputTab").then((m) => ({ default: m.InputTab })));
const CoinShopTab = lazy(() => import("./components/CoinShopTab").then((m) => ({ default: m.CoinShopTab })));
const ConnectRankCalcTab = lazy(() =>
  import("./components/ConnectRankCalcTab").then((m) => ({ default: m.ConnectRankCalcTab })),
);
const ClanBattleTab = lazy(() => import("./components/ClanBattleTab").then((m) => ({ default: m.ClanBattleTab })));
import {
  applyBackupPayloadToLocalStorage,
  buildBackupPayloadFromLocalStorage,
  parseBackupPayload,
  serializeBackupPayload,
} from "./domain/backup";
import { buildInitialState, loadStoredState, saveStoredState, toPurePieceCount } from "./domain/storage";
import type { CharacterProgress, ClanBattleState, StoredStateV1 } from "./domain/types";
import { buildDefaultUiState, loadUiState, saveUiState, type ActiveTab, type InputViewSettings } from "./domain/uiStorage";
import { buildDefaultConnectRankCalcState, saveConnectRankCalcState } from "./domain/connectRankCalcStorage";
import type { SaveStatus } from "./components/input/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import { Button } from "./components/ui/button";
import { FileImportButton } from "./components/ui/file-import-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { PenLine, LayoutDashboard, Coins, Calculator, Download, Upload, RotateCcw, Swords } from "lucide-react";
import { SyncHeader } from "./components/SyncHeader";
import { MobileHeader } from "./components/MobileHeader";
import { PrivacyPolicyPage } from "./components/PrivacyPolicyPage";
import { useSync } from "./hooks/useSync";
import { useIsMobile } from "./hooks/useIsMobile";
import { clearSyncMeta } from "./domain/syncMeta";

const STORED_STATE_SAVE_DEBOUNCE_MS = 400;

type ProgressPatch = Partial<
  Pick<
    CharacterProgress,
    | "owned"
    | "limitBreak"
    | "star"
    | "connectRank"
    | "ue1Level"
    | "ue1SpEquipped"
    | "ue2Level"
    | "adventureMemoryPieceTarget"
    | "ownedMemoryPiece"
    | "obtainedDate"
    | "gachaPullCount"
  >
>;

// タブの遅延読み込み中に表示するフォールバックUI。
function TabLoadingFallback() {
  return (
    <section className="flex min-h-[200px] items-center justify-center rounded-[8px] border border-white/30 bg-linear-to-br from-section-from to-section-to p-8">
      <p className="text-sm text-muted">読み込み中...</p>
    </section>
  );
}

// 最終更新日時の文字列を表示用フォーマットへ変換する。
function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ja-JP");
}

// 育成入力画面とダッシュボード画面を切り替えるアプリのルートコンポーネント。
export default function App() {
  const [state, setState] = useState<StoredStateV1>(() => loadStoredState(masterCharacters));
  const [uiState, setUiState] = useState(() => loadUiState());
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [messageDialog, setMessageDialog] = useState<{ title: string; description: string; reloadOnClose: boolean } | null>(null);
  const [inputSettingsSyncToken, setInputSettingsSyncToken] = useState(0);
  const [connectRankCalcResetToken, setConnectRankCalcResetToken] = useState(0);
  const [hasOpenedInput, setHasOpenedInput] = useState(() => uiState.activeTab === "input");
  // 現在のパス名（SPA フォールバックでの簡易ルーティング用。設計判断 1）。
  const [pathname, setPathname] = useState(() => window.location.pathname);
  // 768px 未満ではコンパクトヘッダー（MobileHeader）へ切り替える。
  const isMobile = useIsMobile();

  // ブラウザの戻る/進む操作でパス名の state を追随させる。
  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // プライバシーポリシーページへ遷移する（history を積んで戻る導線を確保する）。
  const handleOpenPrivacyPolicy = useCallback(() => {
    window.history.pushState(null, "", "/privacy");
    setPathname("/privacy");
    window.scrollTo(0, 0);
  }, []);

  // ポリシーページからアプリ本体（トップ）へ戻る。
  const handleClosePrivacyPolicy = useCallback(() => {
    window.history.pushState(null, "", "/");
    setPathname("/");
    window.scrollTo(0, 0);
  }, []);

  // アカウント削除成功の直前に呼ぶ。同期メタのみ破棄し、touched と育成データは残す（設計判断 3）。
  const handleBeforeAccountDeleted = useCallback(() => {
    clearSyncMeta();
  }, []);

  // localStorage への debounce 保存が予約中かどうか（モバイル編集シートの保存インジケータ用）。
  const [isLocalSavePending, setIsLocalSavePending] = useState(false);
  // 直近に保存予約した state の参照。初回マウント（StrictMode の再実行を含む）では state が
  // 変化していないため、「保存中」を表示しない判定基準に使う。
  const lastScheduledSaveStateRef = useRef(state);

  useEffect(() => {
    // state が実際に変化したときのみ「保存中」を立てる（初回マウント時の書き戻しでは表示しない）。
    if (lastScheduledSaveStateRef.current !== state) {
      lastScheduledSaveStateRef.current = state;
      setIsLocalSavePending(true);
    }
    const timerId = window.setTimeout(() => {
      saveStoredState(state);
      setIsLocalSavePending(false);
    }, STORED_STATE_SAVE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [state]);

  useEffect(() => {
    saveUiState(uiState);
  }, [uiState]);

  // useSync へ常に最新の state を渡すためのゲッター（参照安定・値は最新）。
  const stateRef = useRef(state);
  stateRef.current = state;
  const getState = useCallback(() => stateRef.current, []);

  // サーバーデータ採用時: 既存インポート復元と同じ「ダイアログ表示 → リロード」パターンで反映する（設計判断 6）。
  const handleServerDataAdopted = useCallback(() => {
    setMessageDialog({
      title: "サーバーのデータを反映しました",
      description: "サーバー側の育成データを取り込みました。閉じると画面を再読み込みします。",
      reloadOnClose: true,
    });
  }, []);

  // 同期層（セッション監視・起動時 GET・デバウンス PUT・競合ダイアログ）。
  const sync = useSync({ getState, masterCharacters, onServerDataAdopted: handleServerDataAdopted });

  // モバイル編集シートへ渡す保存ステータス。ローカル保存中を最優先し、ログイン時のみ同期の
  // 進行中/エラーを補助表示する。sync.status の idle は編集直後でも（PUT の 10 秒 debounce により）
  // 最大10秒続くため、「同期済み」とは表示せずローカル保存完了＝保存済みとして扱う。
  const sheetSaveStatus = useMemo<SaveStatus>(() => {
    if (isLocalSavePending) {
      return "saving";
    }
    if (sync.isLoggedIn && sync.status === "syncing") {
      return "syncing";
    }
    if (sync.isLoggedIn && sync.status === "error") {
      return "error";
    }
    return "saved";
  }, [isLocalSavePending, sync.isLoggedIn, sync.status]);

  // 現在のlocalStorage内容をバックアップJSONとしてダウンロードする。
  const handleExportBackup = useCallback(() => {
    // 直前の編集がdebounce保存待ちでもバックアップへ含まれるよう、現在のstateを先に同期する。
    saveStoredState(state);
    saveUiState(uiState);
    const payload = buildBackupPayloadFromLocalStorage();
    const blob = new Blob([serializeBackupPayload(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pcr-growth-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [state, uiState]);

  // 選択したバックアップファイルをインポート確認ダイアログへ渡す。
  const handleSelectImportFile = useCallback((file: File) => {
    setPendingImportFile(file);
  }, []);

  // 承認後にバックアップを復元し、結果メッセージを表示する。
  const handleConfirmImport = useCallback(async () => {
    if (!pendingImportFile) {
      return;
    }
    setIsImporting(true);
    try {
      const text = await pendingImportFile.text();
      const payload = parseBackupPayload(text);
      applyBackupPayloadToLocalStorage(payload);
      // インポートはユーザーが自分のデータを持ち込む操作のため、安全側として touched を立てる（設計判断 8）。
      // これによりログイン後の引き継ぎ判定で「実データあり」と確定し、サーバーデータでの無断上書きを防ぐ。
      // ログイン中の場合はさらに同期メタの localChangeSeq を進めて永続 dirty 化する（PUT 予約はしない）。
      // notifyLocalChange ではなくインポート専用経路を使う理由: インメモリ state はインポート前の旧データの
      // ままなので、リロード前にデバウンス PUT が走ると旧 state がインポート結果を上書き・送信してしまう。
      // 同期はリロード後の起動フローが dirty を検出し、正しいインポート済みデータで行う。
      sync.notifyLocalDataImported();
      setMessageDialog({
        title: "インポート完了",
        description: "インポートが完了しました。閉じると画面を再読み込みします。",
        reloadOnClose: true,
      });
    } catch {
      setMessageDialog({
        title: "インポート失敗",
        description: "インポートに失敗しました。JSON形式を確認してください。",
        reloadOnClose: false,
      });
    } finally {
      setIsImporting(false);
      setPendingImportFile(null);
    }
  }, [pendingImportFile, sync]);

  // 保存データを初期化し、UI設定も既定値へ戻す。
  const handleConfirmReset = useCallback(() => {
    setState(buildInitialState(masterCharacters));
    setUiState(buildDefaultUiState());
    saveConnectRankCalcState(buildDefaultConnectRankCalcState());
    // 外部要因で入力設定を既定値へ戻したことをInputTabへ伝える。
    setInputSettingsSyncToken((previous) => previous + 1);
    setConnectRankCalcResetToken((previous) => previous + 1);
    setIsResetDialogOpen(false);
    // 初期化はユーザー操作による保存データ変更のため、同期カウンタを進めてサーバーへも反映させる。
    sync.notifyLocalChange();
  }, [sync]);

  // 保存データ初期化の確認ダイアログを開く（MobileHeader のメニュー項目から呼ぶ）。
  const handleRequestReset = useCallback(() => {
    setIsResetDialogOpen(true);
  }, []);

  // 結果メッセージを閉じ、必要なら画面を再読み込みする。
  const handleCloseMessageDialog = useCallback(() => {
    const shouldReload = messageDialog?.reloadOnClose ?? false;
    setMessageDialog(null);
    if (shouldReload) {
      window.location.reload();
    }
  }, [messageDialog]);

  // 指定キャラの育成状態を部分更新し、保存データ全体の最終更新時刻を最新化する。
  const handleUpdateProgress = useCallback(
    (name: string, patch: ProgressPatch) => {
      setState((previous) => {
        const current = previous.progressByName[name];
        if (!current) {
          return previous;
        }
        return {
          ...previous,
          updatedAt: new Date().toISOString(),
          progressByName: {
            ...previous.progressByName,
            [name]: {
              ...current,
              ...patch,
            },
          },
        };
      });
      // ユーザー編集操作: touched を立て、同期カウンタを進める（設計判断 8）。
      sync.notifyLocalChange();
    },
    [sync],
  );

  const safeUiState = uiState ?? buildDefaultUiState();
  const handleInputSettingsChange = useCallback((settings: InputViewSettings) => {
    setUiState((previous) => ({ ...previous, input: settings }));
  }, []);

  // キャラ名単位（☆6用）のピュアピ所持数を更新する。
  const handleUpdateCharacterPurePiece = useCallback(
    (name: string, value: number) => {
      setState((previous) => {
        const nextValue = toPurePieceCount(value);
        if (previous.purePieceByCharacterName[name] === nextValue) {
          return previous;
        }
        return {
          ...previous,
          updatedAt: new Date().toISOString(),
          purePieceByCharacterName: {
            ...previous.purePieceByCharacterName,
            [name]: nextValue,
          },
        };
      });
      // ユーザー編集操作: touched を立て、同期カウンタを進める（設計判断 8）。
      sync.notifyLocalChange();
    },
    [sync],
  );

  // クラバト編成データを更新し、保存データ全体の最終更新時刻を最新化する。
  const handleUpdateClanBattle = useCallback(
    (clanBattle: ClanBattleState) => {
      setState((previous) => ({
        ...previous,
        updatedAt: new Date().toISOString(),
        clanBattle,
      }));
      // ユーザー編集操作: touched を立て、同期カウンタを進める（設計判断 8）。
      sync.notifyLocalChange();
    },
    [sync],
  );

  // 計算タブが自身の状態を保存したときの同期トリガ（設計判断 3）。
  const handleConnectRankCalcSaved = useCallback(() => {
    // 計算タブ編集も育成データ同様「実データあり」の根拠となるため touched を立て、同期カウンタを進める。
    sync.notifyLocalChange();
  }, [sync]);

  // `/privacy` パスではプライバシーポリシーページを描画する（SPA フォールバックにより固定 URL になる。設計判断 1）。
  if (pathname === "/privacy") {
    return <PrivacyPolicyPage onBack={handleClosePrivacyPolicy} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 pb-9 pt-7">
      {/* 768px 未満はコンパクトヘッダー+メニューシート、それ以上は従来ヘッダー（無改変）を描画する。 */}
      {isMobile ? (
        <MobileHeader
          isLoggedIn={sync.isLoggedIn}
          isSessionPending={sync.isSessionPending}
          userLabel={sync.userLabel}
          status={sync.status}
          onOpenPrivacyPolicy={handleOpenPrivacyPolicy}
          onDeleteRequestStart={sync.stopSync}
          onBeforeAccountDeleted={handleBeforeAccountDeleted}
          updatedAt={state.updatedAt ? formatUpdatedAt(state.updatedAt) : "-"}
          onExportBackup={handleExportBackup}
          onSelectImportFile={handleSelectImportFile}
          onRequestReset={handleRequestReset}
        />
      ) : (
      <header className="mb-5 flex flex-col items-start justify-between gap-6 lg:flex-row">
        <div>
          <p className="m-0 font-orbitron text-xs tracking-[0.12em] text-accent">Princess Connect! Re:Dive</p>
          <h1 className="mb-1 mt-2 font-orbitron text-[clamp(1.8rem,4vw,2.5rem)] tracking-[0.04em]">育成トラッカー</h1>
          <p className="m-0 text-sm text-muted md:text-base">育成状況を管理</p>
        </div>

        <div className="flex w-full flex-col items-start gap-2.5 lg:w-auto lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <SyncHeader
              isLoggedIn={sync.isLoggedIn}
              isSessionPending={sync.isSessionPending}
              userLabel={sync.userLabel}
              status={sync.status}
              onOpenPrivacyPolicy={handleOpenPrivacyPolicy}
              onDeleteRequestStart={sync.stopSync}
              onBeforeAccountDeleted={handleBeforeAccountDeleted}
            />
            <Button variant="outline" onClick={handleExportBackup}>
              <Download className="size-4" aria-hidden="true" />
              エクスポート
            </Button>
            <FileImportButton
              label="インポート"
              icon={<Upload className="size-4" aria-hidden="true" />}
              accept="application/json,.json"
              onSelectFile={handleSelectImportFile}
            />
            <Button
              variant="outline"
              onClick={() => {
                setIsResetDialogOpen(true);
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              保存データを初期化
            </Button>
          </div>
          <p className="m-0 text-sm text-muted">最終更新: {state.updatedAt ? formatUpdatedAt(state.updatedAt) : "-"}</p>
        </div>
      </header>
      )}

      <Tabs
        value={safeUiState.activeTab}
        onValueChange={(value) => {
          const validTabs: ActiveTab[] = ["input", "dashboard", "coin_shop", "connect_rank_calc", "clan_battle"];
          if (!validTabs.includes(value as ActiveTab)) {
            return;
          }
          // 初回表示後はInputTabを保持し、タブ再切り替え時の再マウントを回避する。
          if (value === "input") {
            setHasOpenedInput(true);
          }
          setUiState((previous) => ({ ...previous, activeTab: value as ActiveTab }));
        }}
      >
        <TabsList className="mb-5" aria-label="画面切り替え">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="size-4" />
            ダッシュボード
          </TabsTrigger>
          <TabsTrigger value="input">
            <PenLine className="size-4" />
            育成入力
          </TabsTrigger>
          <TabsTrigger value="clan_battle">
            <Swords className="size-4" />
            クラバト編成
          </TabsTrigger>
          <TabsTrigger value="coin_shop">
            <Coins className="size-4" />
            ショップ
          </TabsTrigger>
          <TabsTrigger value="connect_rank_calc">
            <Calculator className="size-4" />
            コネクトランク計算
          </TabsTrigger>
        </TabsList>

        <TabsContent value="input" forceMount={hasOpenedInput ? true : undefined}>
          <Suspense fallback={<TabLoadingFallback />}>
            <InputTab
              masterCharacters={masterCharacters}
              state={state}
              onUpdateProgress={handleUpdateProgress}
              onUpdateCharacterPurePiece={handleUpdateCharacterPurePiece}
              initialSettings={safeUiState.input}
              onSettingsChange={handleInputSettingsChange}
              settingsSyncToken={inputSettingsSyncToken}
              saveStatus={sheetSaveStatus}
            />
          </Suspense>
        </TabsContent>
        <TabsContent value="dashboard">
          <Suspense fallback={<TabLoadingFallback />}>
            <DashboardTab masterCharacters={masterCharacters} state={state} />
          </Suspense>
        </TabsContent>
        <TabsContent value="clan_battle">
          <Suspense fallback={<TabLoadingFallback />}>
            <ClanBattleTab masterCharacters={masterCharacters} state={state} onChange={handleUpdateClanBattle} />
          </Suspense>
        </TabsContent>
        <TabsContent value="coin_shop">
          <Suspense fallback={<TabLoadingFallback />}>
            <CoinShopTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="connect_rank_calc">
          <Suspense fallback={<TabLoadingFallback />}>
            <ConnectRankCalcTab
              masterCharacters={masterCharacters}
              state={state}
              resetToken={connectRankCalcResetToken}
              onStateSaved={handleConnectRankCalcSaved}
            />
          </Suspense>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={pendingImportFile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingImportFile(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>バックアップをインポートしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              現在の保存データを上書きします。処理を続行する場合は「インポート」を押してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              disabled={isImporting}
              onClick={(event) => {
                // インポート完了までダイアログを開いたままにし、進行中状態を表示する。
                event.preventDefault();
                void handleConfirmImport();
              }}
            >
              {isImporting ? "処理中..." : "インポート"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存データを初期化しますか？</AlertDialogTitle>
            <AlertDialogDescription>保存中の進捗と表示設定を既定値へ戻します。この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReset}>初期化する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={messageDialog !== null} onOpenChange={(open) => !open && handleCloseMessageDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{messageDialog?.title ?? ""}</AlertDialogTitle>
            <AlertDialogDescription>{messageDialog?.description ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleCloseMessageDialog}>閉じる</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
        同期の競合ダイアログ（引き継ぎ分岐 3 / 409 / 起動時競合）。双方の updatedAt を提示し、
        「サーバーのデータを使う」/「この端末のデータを使う」の二択。自動マージはしない（設計判断 7）。
        ダイアログ外クリック等での閉操作では選択を確定しない（誤操作でデータを失わないよう保留する）。
      */}
      <AlertDialog open={sync.conflict !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>データの競合を検出しました</AlertDialogTitle>
            <AlertDialogDescription>
              サーバーとこの端末の育成データが異なります。どちらのデータを使うか選択してください。もう一方のデータは上書きされます。
              {sync.conflict ? (
                <>
                  <br />
                  サーバー側の更新: {formatUpdatedAt(sync.conflict.serverUpdatedAt)}
                  <br />
                  この端末の更新: {formatUpdatedAt(sync.conflict.localUpdatedAt)}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => void sync.resolveConflictUseLocal()}>この端末のデータを使う</AlertDialogCancel>
            <AlertDialogAction onClick={() => sync.resolveConflictUseServer()}>サーバーのデータを使う</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* フッター: ログイン前でも読めるプライバシーポリシーへの導線（設計判断 1）。 */}
      <footer className="mt-9 border-t border-white/10 pt-5 text-center text-xs text-muted">
        <button
          type="button"
          className="text-accent underline underline-offset-2"
          onClick={handleOpenPrivacyPolicy}
        >
          プライバシーポリシー
        </button>
      </footer>
    </div>
  );
}
