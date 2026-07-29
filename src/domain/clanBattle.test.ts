import { describe, expect, it } from "vitest";
import {
  duplicateClanBattleFormation,
  formatClanBattleDamage,
  getClanBattleMemberDiffs,
  normalizeClanBattleState,
  sortClanBattleMembers,
  toClanBattleDamage,
} from "./clanBattle";
import type { CharacterProgress, ClanBattleFormation, ClanBattleMember, ClanBattleState, MasterCharacter } from "./types";

const progress: CharacterProgress = {
  owned: true,
  limitBreak: false,
  star: 5,
  connectRank: 10,
  ue1Level: 370,
  ue1SpEquipped: true,
  ue2Level: 3,
  adventureMemoryPieceTarget: false,
  ownedMemoryPiece: 0,
  obtainedDate: null,
  gachaPullCount: 0,
};

const masterCharacters: MasterCharacter[] = [
  {
    name: "ヒヨリ",
    baseName: "ヒヨリ",
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: { star6: true, ue1: true, ue1Sp: true, ue2: true },
    memoryPieceSources: [],
    formationOrder: 0,
  },
  {
    name: "ペコリーヌ",
    baseName: "ペコリーヌ",
    limited: false,
    attribute: "光",
    role: "アタッカー",
    implemented: { star6: true, ue1: true, ue1Sp: false, ue2: false },
    memoryPieceSources: [],
    formationOrder: 1,
  },
];

// ソート系テスト用の最小限のクラバトメンバーを生成する（並び替えに関与しない値は固定でよい）。
function buildMember(id: string, characterName: string): ClanBattleMember {
  return {
    id,
    characterName,
    support: false,
    limitBreak: false,
    star: 3,
    connectRank: 1,
    ue1Level: 0,
    ue1SpEquipped: false,
    ue2Level: 0,
  };
}

describe("clanBattle", () => {
  it("与ダメージを整数へ正規化し、日本語の大きい単位表示へ変換する", () => {
    expect(toClanBattleDamage("85000000.9")).toBe(85000000);
    expect(formatClanBattleDamage(123456789)).toBe("1億2345万6789");
  });

  it("編成キャラの保存値と育成入力の差分項目を返す", () => {
    const diffs = getClanBattleMemberDiffs(
      {
        id: "member-1",
        characterName: "ヒヨリ",
        support: false,
        limitBreak: true,
        star: 5,
        connectRank: 9,
        ue1Level: 370,
        ue1SpEquipped: true,
        ue2Level: 3,
      },
      progress,
    );

    expect(diffs).toEqual(["限界突破", "コネクトRANK"]);
  });

  it("サポート指定は先頭1人だけに補正する", () => {
    const state: ClanBattleState = {
      groups: [
        {
          id: "group-1",
          year: 2026,
          month: 6,
          formations: [
            {
              id: "formation-1",
              name: "1ボス",
              damage: 0,
              timeline: "",
              members: [
                { id: "a", characterName: "ヒヨリ", support: true, ...progress },
                { id: "b", characterName: "ヒヨリ", support: true, ...progress },
              ],
            },
          ],
        },
      ],
    };

    const normalized = normalizeClanBattleState(state, masterCharacters);
    expect(normalized.groups[0]?.formations[0]?.members.map((member) => member.support)).toEqual([true, false]);
  });

  describe("sortClanBattleMembers", () => {
    it("formationOrder昇順に並べ替える", () => {
      const characterByName = new Map(masterCharacters.map((character) => [character.name, character]));
      const members = [buildMember("a", "ペコリーヌ"), buildMember("b", "ヒヨリ")];

      const sorted = sortClanBattleMembers(members, characterByName);

      expect(sorted.map((member) => member.characterName)).toEqual(["ヒヨリ", "ペコリーヌ"]);
    });

    it("マスター未登録キャラは末尾へ送る", () => {
      const characterByName = new Map(masterCharacters.map((character) => [character.name, character]));
      const members = [buildMember("a", "未登録キャラ"), buildMember("b", "ヒヨリ")];

      const sorted = sortClanBattleMembers(members, characterByName);

      expect(sorted.map((member) => member.characterName)).toEqual(["ヒヨリ", "未登録キャラ"]);
    });

    it("未登録キャラ同士は元の順序を維持する（安定ソート）", () => {
      const characterByName = new Map(masterCharacters.map((character) => [character.name, character]));
      const members = [buildMember("a", "未登録A"), buildMember("b", "未登録B")];

      const sorted = sortClanBattleMembers(members, characterByName);

      expect(sorted.map((member) => member.id)).toEqual(["a", "b"]);
    });

    it("元配列を破壊しない", () => {
      const characterByName = new Map(masterCharacters.map((character) => [character.name, character]));
      const members = [buildMember("a", "ペコリーヌ"), buildMember("b", "ヒヨリ")];

      sortClanBattleMembers(members, characterByName);

      expect(members.map((member) => member.characterName)).toEqual(["ペコリーヌ", "ヒヨリ"]);
    });
  });

  it("normalizeClanBattleStateは逆順で保存されたmembersをformationOrder順に是正する", () => {
    const state: ClanBattleState = {
      groups: [
        {
          id: "group-1",
          year: 2026,
          month: 6,
          formations: [
            {
              id: "formation-1",
              name: "1ボス",
              damage: 0,
              timeline: "",
              members: [
                { id: "a", characterName: "ペコリーヌ", support: false, ...progress },
                { id: "b", characterName: "ヒヨリ", support: false, ...progress },
              ],
            },
          ],
        },
      ],
    };

    const normalized = normalizeClanBattleState(state, masterCharacters);

    expect(normalized.groups[0]?.formations[0]?.members.map((member) => member.characterName)).toEqual([
      "ヒヨリ",
      "ペコリーヌ",
    ]);
  });

  describe("duplicateClanBattleFormation", () => {
    // 複製対象の元編成（TL・ダメージ・メンバー2名を持つ）を生成する。
    function buildFormation(): ClanBattleFormation {
      return {
        id: "formation-1",
        name: "1ボス",
        damage: 123456789,
        timeline: "1:30　○×○×○　オートON",
        members: [
          { id: "a", characterName: "ヒヨリ", support: true, ...progress },
          { id: "b", characterName: "ペコリーヌ", support: false, ...progress },
        ],
      };
    }

    it("編成IDと全メンバーIDを新規採番する", () => {
      const original = buildFormation();
      const duplicated = duplicateClanBattleFormation(original);

      expect(duplicated.id).not.toBe(original.id);
      duplicated.members.forEach((member, index) => {
        expect(member.id).not.toBe(original.members[index]!.id);
      });
    });

    it("編成名に「 (コピー)」を付加する", () => {
      const original = buildFormation();
      const duplicated = duplicateClanBattleFormation(original);

      expect(duplicated.name).toBe("1ボス (コピー)");
    });

    it("timeline・damage・メンバー内容（ID以外）を元編成と一致させる", () => {
      const original = buildFormation();
      const duplicated = duplicateClanBattleFormation(original);

      expect(duplicated.timeline).toBe(original.timeline);
      expect(duplicated.damage).toBe(original.damage);
      expect(duplicated.members.map(({ id: _id, ...rest }) => rest)).toEqual(
        original.members.map(({ id: _id, ...rest }) => rest),
      );
    });

    it("元の編成オブジェクトを変異させない", () => {
      const original = buildFormation();
      const originalSnapshot = JSON.parse(JSON.stringify(original)) as ClanBattleFormation;

      duplicateClanBattleFormation(original);

      expect(original).toEqual(originalSnapshot);
    });
  });
});
