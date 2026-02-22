import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../domain/levels";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";

export type DistributionItem = {
  label: string;
  count: number;
};

export type DashboardSummary = {
  totalCharacters: number;
  ownedCharacters: number;
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
};

function formatUe1Label(level: number): string {
  return level === 0 ? "未装備(0)" : `Lv${level}`;
}

function formatUe2Label(level: number): string {
  return level === 0 ? "未装備(0)" : `Lv${level}`;
}

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
  let star6Implemented = 0;
  let star6Promoted = 0;
  let ue1SpImplemented = 0;
  let ue1SpEquipped = 0;
  let ue1SpUnequipped = 0;
  let ue1SpUnimplemented = 0;

  for (const character of masterCharacters) {
    const progress = state.progressByName[character.name];
    if (progress?.owned) {
      ownedCharacters += 1;
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
      continue;
    }

    ue1SpImplemented += 1;
    if (progress?.ue1SpEquipped) {
      ue1SpEquipped += 1;
    } else {
      ue1SpUnequipped += 1;
    }
  }

  return {
    totalCharacters: masterCharacters.length,
    ownedCharacters,
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
  };
}
