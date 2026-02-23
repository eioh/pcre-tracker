import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
type ProgressPatch = Partial<
  Pick<CharacterProgress, "owned" | "limitBreak" | "star" | "ue1Level" | "ue1SpEquipped" | "ue2Level">
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // JSONファイルからバックアップを読み込み、localStorageへ復元する。
  const handleImportBackupFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const shouldImport = window.confirm("現在の保存データを上書きします。インポートしますか？");
    if (!shouldImport) {
      return;
    }

    try {
      const text = await file.text();
      const payload = parseBackupPayload(text);
      applyBackupPayloadToLocalStorage(payload);
      window.alert("インポートが完了しました。画面を再読み込みします。");
      window.location.reload();
    } catch {
      window.alert("インポートに失敗しました。JSON形式を確認してください。");
    }
  }, []);

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
            <button
              type="button"
              className="cursor-pointer rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-main transition hover:-translate-y-0.5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={handleExportBackup}
            >
              エクスポート
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-main transition hover:-translate-y-0.5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={() => fileInputRef.current?.click()}
            >
              インポート
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-main transition hover:-translate-y-0.5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={() => {
                const shouldReset = window.confirm("保存データを初期化します。よろしいですか？");
                if (!shouldReset) {
                  return;
                }
                setState(buildInitialState(masterCharacters));
                setUiState(buildDefaultUiState());
              }}
            >
              保存データを初期化
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                void handleImportBackupFile(event);
              }}
            />
          </div>
          <p className="m-0 text-sm text-muted">最終更新: {latestUpdatedAt ? formatUpdatedAt(latestUpdatedAt) : "-"}</p>
        </div>
      </header>

      <nav
        className="mb-5 inline-flex gap-2 rounded-full border border-white/20 bg-white/5 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        aria-label="画面切り替え"
      >
        <button
          type="button"
          className={
            safeUiState.activeTab === "input"
              ? "rounded-full bg-linear-to-r from-accent to-accent-strong px-5 py-2.5 text-sm font-bold text-bg-start"
              : "cursor-pointer rounded-full bg-transparent px-5 py-2.5 text-sm font-bold text-muted transition hover:text-main"
          }
          onClick={() => setUiState((previous) => ({ ...previous, activeTab: "input" }))}
        >
          育成入力
        </button>
        <button
          type="button"
          className={
            safeUiState.activeTab === "dashboard"
              ? "rounded-full bg-linear-to-r from-accent to-accent-strong px-5 py-2.5 text-sm font-bold text-bg-start"
              : "cursor-pointer rounded-full bg-transparent px-5 py-2.5 text-sm font-bold text-muted transition hover:text-main"
          }
          onClick={() => setUiState((previous) => ({ ...previous, activeTab: "dashboard" }))}
        >
          ダッシュボード
        </button>
      </nav>

      {safeUiState.activeTab === "input" ? (
        <InputTab
          masterCharacters={masterCharacters}
          state={state}
          onUpdateProgress={handleUpdateProgress}
          initialSettings={safeUiState.input}
          onSettingsChange={handleInputSettingsChange}
        />
      ) : (
        <DashboardTab masterCharacters={masterCharacters} state={state} />
      )}
    </div>
  );
}
