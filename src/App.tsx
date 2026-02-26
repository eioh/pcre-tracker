import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardTab } from "./components/DashboardTab";
import { InputTab } from "./components/InputTab";
import { masterCharacters } from "./domain/master";
import {
  applyBackupPayloadToLocalStorage,
  buildBackupPayloadFromLocalStorage,
  parseBackupPayload,
  serializeBackupPayload,
} from "./domain/backup";
import { buildInitialState, loadStoredState, saveStoredState } from "./domain/storage";
import type { CharacterProgress, StoredStateV1 } from "./domain/types";
import { buildDefaultUiState, loadUiState, saveUiState, type InputViewSettings } from "./domain/uiStorage";
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

type ProgressPatch = Partial<
  Pick<
    CharacterProgress,
    "owned" | "limitBreak" | "star" | "connectRank" | "ue1Level" | "ue1SpEquipped" | "ue2Level" | "ownedMemoryPiece"
  >
>;

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

  useEffect(() => {
    saveStoredState(state);
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

  // 指定キャラの育成状態を部分更新し、更新日時を最新化する。
  const handleUpdateProgress = useCallback(
    (name: string, patch: ProgressPatch) => {
      setState((previous) => {
        const current = previous.progressByName[name];
        if (!current) {
          return previous;
        }
        return {
          ...previous,
          progressByName: {
            ...previous.progressByName,
            [name]: {
              ...current,
              ...patch,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },
    [],
  );

  // 全キャラの更新日時から最新の1件を表示用に取得する。
  const latestUpdatedAt = useMemo(() => {
    return Object.values(state.progressByName)
      .map((progress) => progress.updatedAt)
      .sort((a, b) => b.localeCompare(a))[0];
  }, [state.progressByName]);

  const safeUiState = uiState ?? buildDefaultUiState();
  const handleInputSettingsChange = useCallback((settings: InputViewSettings) => {
    setUiState((previous) => ({ ...previous, input: settings }));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 pb-9 pt-7">
      <header className="mb-5 flex flex-col items-start justify-between gap-6 lg:flex-row">
        <div>
          <p className="m-0 font-orbitron text-xs tracking-[0.12em] text-accent">Princess Connect! Re:Dive</p>
          <h1 className="mb-1 mt-2 font-orbitron text-[clamp(1.8rem,4vw,2.5rem)] tracking-[0.04em]">育成トラッカー</h1>
          <p className="m-0 text-sm text-muted md:text-base">入力とダッシュボードを1ページで管理</p>
        </div>

        <div className="flex w-full flex-col items-start gap-2.5 lg:w-auto lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleExportBackup}>
              エクスポート
            </Button>
            <FileImportButton label="インポート" accept="application/json,.json" onSelectFile={handleSelectImportFile} />
            <Button
              variant="outline"
              onClick={() => {
                setIsResetDialogOpen(true);
              }}
            >
              保存データを初期化
            </Button>
          </div>
          <p className="m-0 text-sm text-muted">最終更新: {latestUpdatedAt ? formatUpdatedAt(latestUpdatedAt) : "-"}</p>
        </div>
      </header>

      <Tabs
        value={safeUiState.activeTab}
        onValueChange={(value) => {
          if (value !== "input" && value !== "dashboard") {
            return;
          }
          setUiState((previous) => ({ ...previous, activeTab: value }));
        }}
      >
        <TabsList className="mb-5" aria-label="画面切り替え">
          <TabsTrigger value="input">育成入力</TabsTrigger>
          <TabsTrigger value="dashboard">ダッシュボード</TabsTrigger>
        </TabsList>

        <TabsContent value="input">
          <InputTab
            masterCharacters={masterCharacters}
            state={state}
            onUpdateProgress={handleUpdateProgress}
            initialSettings={safeUiState.input}
            onSettingsChange={handleInputSettingsChange}
          />
        </TabsContent>
        <TabsContent value="dashboard">
          <DashboardTab masterCharacters={masterCharacters} state={state} />
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
