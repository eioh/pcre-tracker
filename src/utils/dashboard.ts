import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../domain/levels";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";
import { getConnectRankRemainingMemoryPieceCount } from "./connectRankMemoryCost";
import { getConnectRankRemainingMaterialCost, sumConnectRankMaterialCost } from "./connectRankMaterialCost";
import { getLimitBreakRemainingMemoryPieceCount } from "./limitBreakMemoryCost";
import { getStarRemainingMemoryPieceCount } from "./starMemoryCost";
import {
  getUe1RemainingHeartFragmentCount,
  getUe1RemainingHeartFragmentCountToMaxAssumed,
} from "./ue1HeartFragmentCost";
import { getUe1RemainingMemoryPieceCount } from "./ue1MemoryCost";

export type DistributionItem = {
  label: string;
  count: number;
};

export type GachaPullChartItem = {
  name: string;
  obtainedDate: string;
  gachaPullCount: number;
};

export type DashboardSummary = {
  totalCharacters: number;
  ownedCharacters: number;
  limitBreakCharacters: number;
  star6: {
    implemented: number;
    promoted: number;
  };
  starDistribution: DistributionItem[];
  ue1Distribution: DistributionItem[];
  ue2Distribution: DistributionItem[];
  ue1Sp: {
    implemented: number;
    equipped: number;
    unequipped: number;
    unimplemented: number;
  };
  ue1HeartFragmentNeededImplementedTotal: number;
  ue1HeartFragmentNeededAssumedMaxTotal: number;
  memoryPieceNeeded: {
    star: number;
    connectRank: number;
    ue1: number;
    limitBreak: number;
    total: number;
  };
  connectRankMaterialNeeded: {
    arts: number;
    soul: number;
    guard: number;
  };
};

// YYYY-MM-DD 形式の入力文字列を同形式へ正規化する。不正値は null を返す。
function normalizeDateOnly(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

// 期間指定でガチャ回数グラフ用データを抽出し、入手日順に並べ替える。
export function buildGachaPullChartItems(
  masterCharacters: MasterCharacter[],
  state: StoredStateV1,
  fromDate: string,
  toDate: string,
): GachaPullChartItem[] {
  const normalizedFromDate = normalizeDateOnly(fromDate);
  const normalizedToDate = normalizeDateOnly(toDate);
  if (!normalizedFromDate || !normalizedToDate || normalizedFromDate > normalizedToDate) {
    return [];
  }

  const items: GachaPullChartItem[] = [];
  for (const character of masterCharacters) {
    const progress = state.progressByName[character.name];
    if (!progress || progress.gachaPullCount <= 0 || progress.obtainedDate === null) {
      continue;
    }
    const normalizedObtainedDate = normalizeDateOnly(progress.obtainedDate);
    if (!normalizedObtainedDate) {
      continue;
    }
    if (normalizedObtainedDate < normalizedFromDate || normalizedObtainedDate > normalizedToDate) {
      continue;
    }
    items.push({
      name: character.name,
      obtainedDate: normalizedObtainedDate,
      gachaPullCount: progress.gachaPullCount,
    });
  }

  return items.sort((a, b) => {
    const dateComparison = a.obtainedDate.localeCompare(b.obtainedDate);
    if (dateComparison !== 0) {
      return dateComparison;
    }
    return a.name.localeCompare(b.name, "ja");
  });
}

// 専用1レベル表示用のラベルを生成する。
function formatUe1Label(level: number): string {
  return level === 0 ? "未装備(0)" : `Lv${level}`;
}

// 専用2レベル表示用のラベルを生成する。
function formatUe2Label(level: number): string {
  return level === 0 ? "未装備(0)" : `Lv${level}`;
}

// マスターと進捗からダッシュボード用の集計結果を生成する。
export function buildDashboardSummary(
  masterCharacters: MasterCharacter[],
  state: StoredStateV1,
): DashboardSummary {
  const starOrder = [1, 2, 3, 4, 5, 6].map((star) => `☆${star}`);
  const ue1Order = ["未実装", ...UE1_LEVEL_VALUES.map(formatUe1Label), "SP"];
  const ue2Order = ["未実装", ...UE2_LEVEL_VALUES.map(formatUe2Label)];

  const starCounts = new Map<string, number>(starOrder.map((label) => [label, 0]));
  const ue1Counts = new Map<string, number>(ue1Order.map((label) => [label, 0]));
  const ue2Counts = new Map<string, number>(ue2Order.map((label) => [label, 0]));

  let ownedCharacters = 0;
  let limitBreakCharacters = 0;
  let star6Implemented = 0;
  let star6Promoted = 0;
  let ue1SpImplemented = 0;
  let ue1SpEquipped = 0;
  let ue1SpUnequipped = 0;
  let ue1SpUnimplemented = 0;
  let ue1HeartFragmentNeededImplementedTotal = 0;
  let ue1HeartFragmentNeededAssumedMaxTotal = 0;
  let starMemoryNeededTotal = 0;
  let connectRankMemoryNeededTotal = 0;
  let ue1MemoryNeededTotal = 0;
  let limitBreakMemoryNeededTotal = 0;
  let connectRankMaterialNeededTotal = { arts: 0, soul: 0, guard: 0 };

  for (const character of masterCharacters) {
    const progress = state.progressByName[character.name];
    if (progress?.owned) {
      ownedCharacters += 1;
    }
    if (progress?.limitBreak) {
      limitBreakCharacters += 1;
    }
    const starLabel = `☆${progress?.star ?? 1}`;
    starCounts.set(starLabel, (starCounts.get(starLabel) ?? 0) + 1);
    if (character.implemented.star6) {
      star6Implemented += 1;
      if (progress?.star === 6) {
        star6Promoted += 1;
      }
    }

    if (character.implemented.ue1) {
      const label = progress?.ue1SpEquipped ? "SP" : formatUe1Label(progress?.ue1Level ?? 0);
      ue1Counts.set(label, (ue1Counts.get(label) ?? 0) + 1);
    } else {
      ue1Counts.set("未実装", (ue1Counts.get("未実装") ?? 0) + 1);
    }

    if (character.implemented.ue2) {
      const label = formatUe2Label(progress?.ue2Level ?? 0);
      ue2Counts.set(label, (ue2Counts.get(label) ?? 0) + 1);
    } else {
      ue2Counts.set("未実装", (ue2Counts.get("未実装") ?? 0) + 1);
    }

    if (!character.implemented.ue1Sp) {
      ue1SpUnimplemented += 1;
    } else {
      ue1SpImplemented += 1;
      if (progress?.ue1SpEquipped) {
        ue1SpEquipped += 1;
      } else {
        ue1SpUnequipped += 1;
      }
    }
    if (progress) {
      starMemoryNeededTotal += getStarRemainingMemoryPieceCount(character, progress, "implemented_max");
      connectRankMemoryNeededTotal += getConnectRankRemainingMemoryPieceCount(progress);
      connectRankMaterialNeededTotal = sumConnectRankMaterialCost(
        connectRankMaterialNeededTotal,
        getConnectRankRemainingMaterialCost(character.role, progress.connectRank),
      );
      ue1MemoryNeededTotal += getUe1RemainingMemoryPieceCount(character, progress, "implemented_max");
      limitBreakMemoryNeededTotal += getLimitBreakRemainingMemoryPieceCount(character, progress);
      ue1HeartFragmentNeededImplementedTotal += getUe1RemainingHeartFragmentCount(character, progress);
      ue1HeartFragmentNeededAssumedMaxTotal += getUe1RemainingHeartFragmentCountToMaxAssumed(progress);
    }
  }

  return {
    totalCharacters: masterCharacters.length,
    ownedCharacters,
    limitBreakCharacters,
    star6: {
      implemented: star6Implemented,
      promoted: star6Promoted,
    },
    starDistribution: starOrder.map((label) => ({ label, count: starCounts.get(label) ?? 0 })),
    ue1Distribution: ue1Order.map((label) => ({ label, count: ue1Counts.get(label) ?? 0 })),
    ue2Distribution: ue2Order.map((label) => ({ label, count: ue2Counts.get(label) ?? 0 })),
    ue1Sp: {
      implemented: ue1SpImplemented,
      equipped: ue1SpEquipped,
      unequipped: ue1SpUnequipped,
      unimplemented: ue1SpUnimplemented,
    },
    ue1HeartFragmentNeededImplementedTotal,
    ue1HeartFragmentNeededAssumedMaxTotal,
    memoryPieceNeeded: {
      star: starMemoryNeededTotal,
      connectRank: connectRankMemoryNeededTotal,
      ue1: ue1MemoryNeededTotal,
      limitBreak: limitBreakMemoryNeededTotal,
      total: starMemoryNeededTotal + connectRankMemoryNeededTotal + ue1MemoryNeededTotal + limitBreakMemoryNeededTotal,
    },
    connectRankMaterialNeeded: connectRankMaterialNeededTotal,
  };
}
