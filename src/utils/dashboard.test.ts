import { describe, expect, it } from "vitest";
import { buildDashboardSummary, buildGachaPullChartItems } from "./dashboard";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";

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

describe("buildDashboardSummary", () => {
  it("主要KPIと分布を計算できる", () => {
    const summary = buildDashboardSummary(masterCharacters, state);

    expect(summary.totalCharacters).toBe(2);
    expect(summary.ownedCharacters).toBe(1);
    expect(summary.limitBreakCharacters).toBe(1);
    expect(summary.star6.implemented).toBe(2);
    expect(summary.star6.promoted).toBe(1);
    expect(summary.ue1Sp.implemented).toBe(1);
    expect(summary.ue1Sp.equipped).toBe(1);
    expect(summary.ue1Sp.unimplemented).toBe(1);
    expect(summary.ue1HeartFragmentNeededImplementedTotal).toBe(0);
    expect(summary.ue1HeartFragmentNeededAssumedMaxTotal).toBe(318);
    expect(summary.memoryPieceNeeded.star).toBe(450);
    expect(summary.memoryPieceNeeded.connectRank).toBe(20);
    expect(summary.memoryPieceNeeded.ue1).toBe(0);
    expect(summary.memoryPieceNeeded.limitBreak).toBe(120);
    expect(summary.memoryPieceNeeded.total).toBe(590);
    expect(summary.connectRankMaterialNeeded.arts).toBe(54);
    expect(summary.connectRankMaterialNeeded.soul).toBe(120);
    expect(summary.connectRankMaterialNeeded.guard).toBe(256);

    const ue1Sp = summary.ue1Distribution.find((item) => item.label === "SP");
    const ue1Unimplemented = summary.ue1Distribution.find((item) => item.label === "未実装");
    const ue2Lv2 = summary.ue2Distribution.find((item) => item.label === "Lv2");
    const star6 = summary.starDistribution.find((item) => item.label === "☆6");
    const star1 = summary.starDistribution.find((item) => item.label === "☆1");

    expect(star6?.count).toBe(1);
    expect(star1?.count).toBe(1);
    expect(ue1Sp?.count).toBe(1);
    expect(ue1Unimplemented?.count).toBe(1);
    expect(ue2Lv2?.count).toBe(1);
  });
});

describe("buildGachaPullChartItems", () => {
  it("日付範囲内かつガチャ回数が1以上のキャラのみを日付順で返す", () => {
    const chartState: StoredStateV1 = {
      ...state,
      progressByName: {
        ヒヨリ: {
          ...state.progressByName["ヒヨリ"],
          obtainedDate: "2026-01-05",
          gachaPullCount: 120,
        },
        ユイ: {
          ...state.progressByName["ユイ"],
          obtainedDate: "2026-01-03",
          gachaPullCount: 0,
        },
      },
    };
    const items = buildGachaPullChartItems(masterCharacters, chartState, "2026-01-01", "2026-01-31");

    expect(items).toEqual([
      {
        name: "ヒヨリ",
        obtainedDate: "2026-01-05",
        gachaPullCount: 120,
      },
    ]);
  });

  it("不正な期間指定や開始日>終了日の場合は空配列を返す", () => {
    const items1 = buildGachaPullChartItems(masterCharacters, state, "2026-01-xx", "2026-01-31");
    const items2 = buildGachaPullChartItems(masterCharacters, state, "2026-02-01", "2026-01-31");
    expect(items1).toEqual([]);
    expect(items2).toEqual([]);
  });
});
