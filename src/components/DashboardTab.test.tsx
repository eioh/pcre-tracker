import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardTab } from "./DashboardTab";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";
import { DistributionChart } from "./ui/distribution-chart";

const masterCharacters: MasterCharacter[] = [
  {
    name: "ヒヨリ",
    baseName: "ヒヨリ",
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: { star6: true, ue1: true, ue1Sp: true, ue2: true },
    memoryPieceSources: ["hard_quest"],
  },
  {
    name: "ユイ",
    baseName: "ユイ",
    limited: false,
    attribute: "光",
    role: "ヒーラー",
    implemented: { star6: true, ue1: false, ue1Sp: false, ue2: false },
    memoryPieceSources: ["side_story"],
  },
];

const state: StoredStateV1 = {
  schemaVersion: 1,
  updatedAt: "2026-02-22T00:00:00.000Z",
  progressByName: {
    ヒヨリ: {
      owned: true,
      limitBreak: true,
      star: 6,
      connectRank: 15,
      ue1Level: 370,
      ue1SpEquipped: true,
      ue2Level: 2,
      ownedMemoryPiece: 0,
      obtainedDate: "2026-02-20",
      gachaPullCount: 120,
    },
    ユイ: {
      owned: false,
      limitBreak: false,
      star: 1,
      connectRank: 1,
      ue1Level: null,
      ue1SpEquipped: false,
      ue2Level: null,
      ownedMemoryPiece: 0,
      obtainedDate: "2026-01-10",
      gachaPullCount: 0,
    },
  },
  purePieceByCharacterName: {
    ヒヨリ: 0,
    ユイ: 0,
  },
  purePieceByBaseName: {
    ヒヨリ: 0,
    ユイ: 0,
  },
};

// 日付を YYYY-MM-DD へ整形する。
function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// DashboardTabの表示対象をテスト用データで描画する。
function renderDashboard(overrideState?: StoredStateV1): void {
  render(<DashboardTab masterCharacters={masterCharacters} state={overrideState ?? state} />);
}

describe("DashboardTab", () => {
  it("主要KPIを表示できる", () => {
    renderDashboard();

    const ownedCard = screen.getByText("所持キャラ数").parentElement;
    expect(ownedCard).not.toBeNull();
    expect(within(ownedCard as HTMLElement).getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("所持率 50.0%")).toBeInTheDocument();
    expect(screen.getByText("コネクトRANK必要素材")).toBeInTheDocument();
    const materialCard = screen.getByText("コネクトRANK必要素材").parentElement;
    expect(materialCard).not.toBeNull();
    expect(within(materialCard as HTMLElement).getByText(/54/)).toBeInTheDocument();
    expect(within(materialCard as HTMLElement).getByText(/120/)).toBeInTheDocument();
    expect(within(materialCard as HTMLElement).getByText(/256/)).toBeInTheDocument();
    expect(within(materialCard as HTMLElement).getByText(/140/)).toBeInTheDocument();
    expect(within(materialCard as HTMLElement).getByText(/80/)).toBeInTheDocument();
    expect(within(materialCard as HTMLElement).getByText(/ブロンズ \/ シルバー \/ ゴールド レガリア/)).toBeInTheDocument();
  });

  it("分布チャートのタイトルとチャート領域を表示できる", () => {
    renderDashboard();

    expect(screen.getByText("☆分布")).toBeInTheDocument();
    expect(screen.getByText("専用1レベル分布")).toBeInTheDocument();
    expect(screen.getByText("専用2レベル分布")).toBeInTheDocument();
    const distributionSection = screen.getByText("☆分布").closest("section");
    expect(distributionSection).not.toBeNull();
    expect((distributionSection as HTMLElement).querySelector('[data-slot="chart"]')).not.toBeNull();
  });

  it("分布チャートをrechartsコンテナとして描画する", () => {
    renderDashboard();

    const distributionSection = screen.getByText("☆分布").closest("section");
    expect(distributionSection).not.toBeNull();
    expect((distributionSection as HTMLElement).querySelector(".recharts-responsive-container")).not.toBeNull();
  });

  it("分布コンポーネントは空データ時に空状態メッセージを表示する", () => {
    render(<DistributionChart title="空分布" items={[]} />);
    expect(screen.getByText("データがありません")).toBeInTheDocument();
  });

  it("ガチャ回数グラフと日付範囲入力を表示できる", () => {
    renderDashboard();

    expect(screen.getByText("ガチャ回数推移")).toBeInTheDocument();
    expect(screen.getByText("開始日")).toBeInTheDocument();
    expect(screen.getByText("終了日")).toBeInTheDocument();

    const today = new Date();
    expect(screen.getByText(`${today.getFullYear()}/01/01`)).toBeInTheDocument();
    expect(screen.getByText(formatDateOnly(today).replaceAll("-", "/"))).toBeInTheDocument();
    expect(screen.getByText("表示範囲の平均: 120.0回")).toBeInTheDocument();
  });

  it("日付範囲で絞り込み、データがなければ空表示になる", () => {
    const outOfRangeState: StoredStateV1 = {
      ...state,
      progressByName: {
        ...state.progressByName,
        ヒヨリ: {
          ...state.progressByName["ヒヨリ"],
          obtainedDate: "2025-02-20",
        },
      },
    };
    renderDashboard(outOfRangeState);

    expect(screen.getByText("該当データがありません")).toBeInTheDocument();
    expect(screen.getByText("表示範囲の平均: -")).toBeInTheDocument();
  });
});
