import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardTab } from "./components/DashboardTab";
import { InputTab } from "./components/InputTab";
import { masterCharacters } from "./domain/master";
import { buildInitialState, loadStoredState, saveStoredState } from "./domain/storage";
import type { CharacterProgress, StoredStateV1 } from "./domain/types";

type ActiveTab = "input" | "dashboard";
type ProgressPatch = Partial<Pick<CharacterProgress, "owned" | "ue1Level" | "ue1SpEquipped" | "ue2Level">>;

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ja-JP");
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("input");
  const [state, setState] = useState<StoredStateV1>(() => loadStoredState(masterCharacters));

  useEffect(() => {
    saveStoredState(state);
  }, [state]);

  const handleUpdateProgress = useCallback((name: string, patch: ProgressPatch) => {
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
  }, []);

  const latestUpdatedAt = useMemo(() => {
    return Object.values(state.progressByName)
      .map((progress) => progress.updatedAt)
      .sort((a, b) => b.localeCompare(a))[0];
  }, [state.progressByName]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Princess Connect! Re:Dive</p>
          <h1>育成トラッカー</h1>
          <p className="subtitle">入力とダッシュボードを1ページで管理</p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              const shouldReset = window.confirm("保存データを初期化します。よろしいですか？");
              if (!shouldReset) {
                return;
              }
              setState(buildInitialState(masterCharacters));
            }}
          >
            保存データを初期化
          </button>
          <p className="updated-at">最終更新: {latestUpdatedAt ? formatUpdatedAt(latestUpdatedAt) : "-"}</p>
        </div>
      </header>

      <nav className="tab-list" aria-label="画面切り替え">
        <button
          type="button"
          className={activeTab === "input" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("input")}
        >
          育成入力
        </button>
        <button
          type="button"
          className={activeTab === "dashboard" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("dashboard")}
        >
          ダッシュボード
        </button>
      </nav>

      {activeTab === "input" ? (
        <InputTab masterCharacters={masterCharacters} state={state} onUpdateProgress={handleUpdateProgress} />
      ) : (
        <DashboardTab masterCharacters={masterCharacters} state={state} />
      )}
    </div>
  );
}
