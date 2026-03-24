import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { masterCharacters } from "./domain/master";

// タブ表示時にのみ読み込むことで初期バンドルを軽量化する。
const DashboardTab = lazy(() => import("./components/DashboardTab").then((m) => ({ default: m.DashboardTab })));
const InputTab = lazy(() => import("./components/InputTab").then((m) => ({ default: m.InputTab })));
const CoinShopTab = lazy(() => import("./components/CoinShopTab").then((m) => ({ default: m.CoinShopTab })));
const ConnectRankCalcTab = lazy(() =>
  import("./components/ConnectRankCalcTab").then((m) => ({ default: m.ConnectRankCalcTab })),
);
import {
  applyBackupPayloadToLocalStorage,
  buildBackupPayloadFromLocalStorage,
  parseBackupPayload,
  serializeBackupPayload,
} from "./domain/backup";
import { buildInitialState, loadStoredState, saveStoredState, toPurePieceCount } from "./domain/storage";
import type { CharacterProgress, StoredStateV1 } from "./domain/types";
import { buildDefaultUiState, loadUiState, saveUiState, type ActiveTab, type InputViewSettings } from "./domain/uiStorage";
import { buildDefaultConnectRankCalcState, saveConnectRankCalcState } from "./domain/connectRankCalcStorage";
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
import { PenLine, LayoutDashboard, Coins, Calculator, Download, Upload, RotateCcw } from "lucide-react";

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
    | "ownedMemoryPiece"
    | "obtainedDate"
    | "gachaPullCount"
  >
>;

// タブの遅延読み込み中に表示するフォールバックUI。
function TabLoadingFallback() {
  return (
    <section className="flex min-h-[200px] items-center justify-center rounded-[20px] border border-white/30 bg-linear-to-br from-section-from to-section-to p-8">
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

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      saveStoredState(state);
    }, STORED_STATE_SAVE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [state]);

  useEffect(() => {
    saveUiState(uiState);
  }, [uiState]);

  // 現在のlocalStorage内容をバックアップJSONとしてダウンロードする。
  const handleExportBackup = useCallback(() => {
    const payload = buildBackupPayloadFromLocalStorage();
    const blob = new Blob([serializeBackupPayload(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pcr-growth-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

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
  }, [pendingImportFile]);

  // 保存データを初期化し、UI設定も既定値へ戻す。
  const handleConfirmReset = useCallback(() => {
    setState(buildInitialState(masterCharacters));
    setUiState(buildDefaultUiState());
    saveConnectRankCalcState(buildDefaultConnectRankCalcState());
    // 外部要因で入力設定を既定値へ戻したことをInputTabへ伝える。
    setInputSettingsSyncToken((previous) => previous + 1);
    setConnectRankCalcResetToken((previous) => previous + 1);
    setIsResetDialogOpen(false);
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
    },
    [],
  );

  const safeUiState = uiState ?? buildDefaultUiState();
  const handleInputSettingsChange = useCallback((settings: InputViewSettings) => {
    setUiState((previous) => ({ ...previous, input: settings }));
  }, []);

  // キャラ名単位（☆6用）のピュアピ所持数を更新する。
  const handleUpdateCharacterPurePiece = useCallback((name: string, value: number) => {
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
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 pb-9 pt-7">
      <header className="mb-5 flex flex-col items-start justify-between gap-6 lg:flex-row">
        <div>
          <p className="m-0 font-orbitron text-xs tracking-[0.12em] text-accent">Princess Connect! Re:Dive</p>
          <h1 className="mb-1 mt-2 font-orbitron text-[clamp(1.8rem,4vw,2.5rem)] tracking-[0.04em]">育成トラッカー</h1>
          <p className="m-0 text-sm text-muted md:text-base">育成状況を管理</p>
        </div>

        <div className="flex w-full flex-col items-start gap-2.5 lg:w-auto lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
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

      <Tabs
        value={safeUiState.activeTab}
        onValueChange={(value) => {
          const validTabs: ActiveTab[] = ["input", "dashboard", "coin_shop", "connect_rank_calc"];
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
            />
          </Suspense>
        </TabsContent>
        <TabsContent value="dashboard">
          <Suspense fallback={<TabLoadingFallback />}>
            <DashboardTab masterCharacters={masterCharacters} state={state} />
          </Suspense>
        </TabsContent>
        <TabsContent value="coin_shop">
          <Suspense fallback={<TabLoadingFallback />}>
            <CoinShopTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="connect_rank_calc">
          <Suspense fallback={<TabLoadingFallback />}>
            <ConnectRankCalcTab masterCharacters={masterCharacters} state={state} resetToken={connectRankCalcResetToken} />
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
    </div>
  );
}
