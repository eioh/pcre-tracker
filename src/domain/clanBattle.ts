import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "./levels";
import type {
  CharacterProgress,
  ClanBattleFormation,
  ClanBattleMember,
  ClanBattleMemberSnapshot,
  ClanBattleMonthGroup,
  ClanBattleState,
  MasterCharacter,
} from "./types";

export const CLAN_BATTLE_MAX_MEMBERS = 5;

const MAX_DAMAGE = 999_999_999_999;
const CLAN_BATTLE_ID_RANDOM_BASE = 36;

// クラバト編成で保存する育成値だけを育成入力の現在値から取り出す。
export function buildClanBattleMemberSnapshot(progress: CharacterProgress): ClanBattleMemberSnapshot {
  return {
    limitBreak: progress.limitBreak,
    star: progress.star,
    connectRank: progress.connectRank,
    ue1Level: progress.ue1Level,
    ue1SpEquipped: progress.ue1SpEquipped,
    ue2Level: progress.ue2Level,
  };
}

// 新規レコード用の簡易IDを生成し、同名編成でも内部識別できるようにする。
export function createClanBattleId(prefix: string): string {
  const randomPart = Math.random().toString(CLAN_BATTLE_ID_RANDOM_BASE).slice(2, 10);
  return `${prefix}_${Date.now().toString(CLAN_BATTLE_ID_RANDOM_BASE)}_${randomPart}`;
}

// 指定年月のクラバト月グループを作成する。
export function createClanBattleMonthGroup(year: number, month: number): ClanBattleMonthGroup {
  return {
    id: createClanBattleId("cbm"),
    year,
    month,
    formations: [],
  };
}

// 入力された編成名を使って空のクラバト編成を作成する。
export function createClanBattleFormation(name: string): ClanBattleFormation {
  return {
    id: createClanBattleId("cbf"),
    name: name.trim() || "新しい編成",
    damage: 0,
    timeline: "",
    members: [],
  };
}

// キャラ名と育成入力の現在値から、編成内で独立保存するキャラ行を作成する。
export function createClanBattleMember(characterName: string, progress: CharacterProgress): ClanBattleMember {
  return {
    id: createClanBattleId("cbp"),
    characterName,
    support: false,
    ...buildClanBattleMemberSnapshot(progress),
  };
}

// 保存する与ダメージを0以上の整数に丸め、極端な値は上限で止める。
export function toClanBattleDamage(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(MAX_DAMAGE, Math.max(0, Math.floor(numeric)));
}

// 与ダメージを日本語の大きい単位1本の補助表示に変換する。
export function formatClanBattleDamage(value: number): string {
  const damage = toClanBattleDamage(value);
  if (damage === 0) {
    return "0";
  }
  const oku = Math.floor(damage / 100_000_000);
  const man = Math.floor((damage % 100_000_000) / 10_000);
  const rest = damage % 10_000;
  const parts: string[] = [];
  if (oku > 0) {
    parts.push(`${oku}億`);
  }
  if (man > 0) {
    parts.push(`${man}万`);
  }
  if (rest > 0 || parts.length === 0) {
    parts.push(String(rest));
  }
  return parts.join("");
}

// 現在年月と一致する月グループかを判定する。
export function isCurrentClanBattleMonth(group: Pick<ClanBattleMonthGroup, "year" | "month">, today = new Date()): boolean {
  return group.year === today.getFullYear() && group.month === today.getMonth() + 1;
}

// 編成内のキャラ保存値が育成入力の現在値と異なる項目名を返す。
export function getClanBattleMemberDiffs(member: ClanBattleMember, progress: CharacterProgress | undefined): string[] {
  if (!progress) {
    return ["育成入力なし"];
  }
  const current = buildClanBattleMemberSnapshot(progress);
  const diffs: string[] = [];
  if (member.limitBreak !== current.limitBreak) {
    diffs.push("限界突破");
  }
  if (member.star !== current.star) {
    diffs.push("☆");
  }
  if (member.connectRank !== current.connectRank) {
    diffs.push("コネクトRANK");
  }
  if (member.ue1Level !== current.ue1Level || member.ue1SpEquipped !== current.ue1SpEquipped) {
    diffs.push("専用1");
  }
  if (member.ue2Level !== current.ue2Level) {
    diffs.push("専用2");
  }
  return diffs;
}

// 未実装の専用装備など、キャラマスターと矛盾する保存値を表示可能な値へ補正する。
export function normalizeClanBattleMemberWithMaster(
  member: ClanBattleMember,
  character: MasterCharacter | undefined,
): ClanBattleMember {
  const ue1Level = character?.implemented.ue1 ? normalizeUe1Level(member.ue1Level) : null;
  const ue2Level = character?.implemented.ue2 ? normalizeUe2Level(member.ue2Level) : null;
  return {
    ...member,
    characterName: member.characterName.trim(),
    star: normalizeStar(member.star, character?.implemented.star6 === true),
    connectRank: normalizeConnectRank(member.connectRank),
    ue1Level,
    ue1SpEquipped: character?.implemented.ue1Sp === true && ue1Level === 370 ? member.ue1SpEquipped : false,
    ue2Level,
    support: member.support === true,
  };
}

// クラバト保存データ全体を現在のマスターに合わせて正規化する。
export function normalizeClanBattleState(state: ClanBattleState, masterCharacters: MasterCharacter[]): ClanBattleState {
  const characterByName = new Map(masterCharacters.map((character) => [character.name, character]));
  return {
    groups: state.groups
      .map((group) => ({
        id: group.id,
        year: normalizeYear(group.year),
        month: normalizeMonth(group.month),
        formations: group.formations.map((formation) => ({
          id: formation.id,
          name: formation.name.trim() || "新しい編成",
          damage: toClanBattleDamage(formation.damage),
          timeline: formation.timeline,
          members: normalizeSupportMemberCount(
            formation.members
              .slice(0, CLAN_BATTLE_MAX_MEMBERS)
              .map((member) => normalizeClanBattleMemberWithMaster(member, characterByName.get(member.characterName))),
          ),
        })),
      }))
      .filter((group) => group.year > 0 && group.month >= 1 && group.month <= 12),
  };
}

// クラバト保存データの既定値を返す。
export function buildDefaultClanBattleState(): ClanBattleState {
  return {
    groups: [],
  };
}

// サポート指定が複数ある場合、先頭1人だけをサポートとして残す。
function normalizeSupportMemberCount(members: ClanBattleMember[]): ClanBattleMember[] {
  let hasSupport = false;
  return members.map((member) => {
    if (!member.support) {
      return member;
    }
    if (hasSupport) {
      return { ...member, support: false };
    }
    hasSupport = true;
    return member;
  });
}

// 年月グループの年をクラバト記録として扱える範囲の整数へ正規化する。
function normalizeYear(value: number): number {
  if (!Number.isInteger(value)) {
    return 0;
  }
  return value >= 2000 && value <= 2100 ? value : 0;
}

// 年月グループの月を1〜12の整数へ正規化する。
function normalizeMonth(value: number): number {
  if (!Number.isInteger(value)) {
    return 0;
  }
  return value >= 1 && value <= 12 ? value : 0;
}

// コネクトRANKを育成入力と同じ0〜15へ正規化する。
function normalizeConnectRank(value: number): CharacterProgress["connectRank"] {
  if (!Number.isInteger(value) || value < 0) {
    return 0;
  }
  if (value > 15) {
    return 15;
  }
  return value as CharacterProgress["connectRank"];
}

// ☆を未実装☆6の上限に配慮して正規化する。
function normalizeStar(value: number, isStar6Implemented: boolean): CharacterProgress["star"] {
  const maxStar = isStar6Implemented ? 6 : 5;
  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }
  if (value > maxStar) {
    return maxStar as CharacterProgress["star"];
  }
  return value as CharacterProgress["star"];
}

// 専用1レベルを既存の許容値に丸める。
function normalizeUe1Level(value: CharacterProgress["ue1Level"]): CharacterProgress["ue1Level"] {
  if (value === null) {
    return 0;
  }
  return UE1_LEVEL_VALUES.includes(value as (typeof UE1_LEVEL_VALUES)[number])
    ? (value as (typeof UE1_LEVEL_VALUES)[number])
    : 0;
}

// 専用2レベルを既存の許容値に丸める。
function normalizeUe2Level(value: CharacterProgress["ue2Level"]): CharacterProgress["ue2Level"] {
  if (value === null) {
    return 0;
  }
  return UE2_LEVEL_VALUES.includes(value as (typeof UE2_LEVEL_VALUES)[number])
    ? (value as (typeof UE2_LEVEL_VALUES)[number])
    : 0;
}
