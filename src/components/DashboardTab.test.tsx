import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardTab } from "./DashboardTab";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";
import { DistributionChart } from "./ui/distribution-chart";

const masterCharacters: MasterCharacter[] = [
  {
    name: "ヒヨリ",
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: { star6: true, ue1: true, ue1Sp: true, ue2: true },
    memoryPieceSources: ["hard_quest"],
  },
  {
    name: "ユイ",
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
      obtainedDate: null,
      gachaPullCount: 0,
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
      obtainedDate: null,
      gachaPullCount: 0,
    },
  },
};

// DashboardTabの表示対象をテスト用データで描画する。
function renderDashboard(): void {
  render(<DashboardTab masterCharacters={masterCharacters} state={state} />);
}

describe("DashboardTab", () => {
  it("主要KPIを表示できる", () => {
    renderDashboard();

    const ownedCard = screen.getByText("所持キャラ数").closest("article");
    expect(ownedCard).not.toBeNull();
    expect(within(ownedCard as HTMLElement).getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("所持率 50.0%")).toBeInTheDocument();
    expect(screen.getByText("必要メモピ合計")).toBeInTheDocument();
    expect(screen.getByText("590")).toBeInTheDocument();
    expect(screen.getByText("コネクトRANK必要素材")).toBeInTheDocument();
    expect(screen.getByText("54 / 120 / 256")).toBeInTheDocument();
  });

  it("分布チャートのタイトルと件数を表示できる", () => {
    renderDashboard();

    expect(screen.getByText("☆分布")).toBeInTheDocument();
    expect(screen.getByText("専用1レベル分布")).toBeInTheDocument();
    expect(screen.getByText("専用2レベル分布")).toBeInTheDocument();
    const distributionSection = screen.getByText("☆分布").closest("section");
    expect(distributionSection).not.toBeNull();
    expect(within(distributionSection as HTMLElement).getAllByText("1")).toHaveLength(2);
  });

  it("分布バーの幅をstyleで反映する", () => {
    renderDashboard();

    const bar = document.querySelector("li div[style]") as HTMLDivElement | null;
    expect(bar).not.toBeNull();
    expect(bar?.style.width).not.toBe("");
  });

  it("分布コンポーネントは空データ時に空状態メッセージを表示する", () => {
    render(<DistributionChart title="空分布" items={[]} />);
    expect(screen.getByText("データがありません")).toBeInTheDocument();
  });
});
