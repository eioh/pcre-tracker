import { describe, expect, it } from "vitest";
import {
  duplicateClanBattleFormation,
  formatClanBattleDamage,
  getClanBattleMemberDiffs,
  moveClanBattleFormation,
  normalizeClanBattleState,
  reorderClanBattleFormations,
  sortClanBattleMembers,
  toClanBattleDamage,
} from "./clanBattle";
import type {
  CharacterProgress,
  ClanBattleFormation,
  ClanBattleMember,
  ClanBattleMonthGroup,
  ClanBattleState,
  MasterCharacter,
} from "./types";

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

  describe("reorderClanBattleFormations", () => {
    // ID以外の内容を問わない並び替えテスト用の最小限の編成を生成する。
    function buildFormationList(ids: string[]): ClanBattleFormation[] {
      return ids.map((id) => ({ id, name: id, damage: 0, timeline: "", members: [] }));
    }

    it("前から後ろへ、後ろから前へ、それぞれ移動すると期待順になる", () => {
      const formations = buildFormationList(["a", "b", "c"]);

      expect(reorderClanBattleFormations(formations, "a", "c").map((formation) => formation.id)).toEqual([
        "b",
        "c",
        "a",
      ]);
      expect(reorderClanBattleFormations(formations, "c", "a").map((formation) => formation.id)).toEqual([
        "c",
        "a",
        "b",
      ]);
    });

    it("activeIdとoverIdが同じ場合は同一参照を返す", () => {
      const formations = buildFormationList(["a", "b", "c"]);

      const reordered = reorderClanBattleFormations(formations, "b", "b");

      expect(reordered).toBe(formations);
    });

    it("存在しないidを渡すと同一参照を返す", () => {
      const formations = buildFormationList(["a", "b", "c"]);

      expect(reorderClanBattleFormations(formations, "missing", "a")).toBe(formations);
      expect(reorderClanBattleFormations(formations, "a", "missing")).toBe(formations);
    });

    it("元配列を変異させない", () => {
      const formations = buildFormationList(["a", "b", "c"]);

      reorderClanBattleFormations(formations, "a", "c");

      expect(formations.map((formation) => formation.id)).toEqual(["a", "b", "c"]);
    });
  });

  describe("moveClanBattleFormation", () => {
    // ID以外の内容を問わない移動テスト用の最小限の編成を生成する。
    function buildFormationList(ids: string[]): ClanBattleFormation[] {
      return ids.map((id) => ({ id, name: id, damage: 0, timeline: "", members: [] }));
    }

    // groupId・formation構成を指定してクラバトstateを組み立てる。
    function buildState(groups: Array<{ id: string; formationIds: string[] }>): ClanBattleState {
      return {
        groups: groups.map(
          (group, index): ClanBattleMonthGroup => ({
            id: group.id,
            year: 2026,
            month: index + 1,
            formations: buildFormationList(group.formationIds),
          }),
        ),
      };
    }

    // 各グループのformation ID配列だけを取り出して比較しやすくする。
    function idsOf(state: ClanBattleState): string[][] {
      return state.groups.map((group) => group.formations.map((formation) => formation.id));
    }

    it("月をまたいで先頭へ移動する", () => {
      const state = buildState([
        { id: "g1", formationIds: ["a", "b"] },
        { id: "g2", formationIds: ["x", "y"] },
      ]);

      const next = moveClanBattleFormation(state, "b", "g2", 0);

      expect(idsOf(next)).toEqual([["a"], ["b", "x", "y"]]);
    });

    it("月をまたいで中間へ移動する", () => {
      const state = buildState([
        { id: "g1", formationIds: ["a", "b"] },
        { id: "g2", formationIds: ["x", "y"] },
      ]);

      const next = moveClanBattleFormation(state, "b", "g2", 1);

      expect(idsOf(next)).toEqual([["a"], ["x", "b", "y"]]);
    });

    it("月をまたいで末尾へ移動する", () => {
      const state = buildState([
        { id: "g1", formationIds: ["a", "b"] },
        { id: "g2", formationIds: ["x", "y"] },
      ]);

      const next = moveClanBattleFormation(state, "b", "g2", 2);

      expect(idsOf(next)).toEqual([["a"], ["x", "y", "b"]]);
    });

    it("月をまたいで空グループへ移動する", () => {
      const state = buildState([
        { id: "g1", formationIds: ["a", "b"] },
        { id: "g2", formationIds: [] },
      ]);

      const next = moveClanBattleFormation(state, "a", "g2", 0);

      expect(idsOf(next)).toEqual([["b"], ["a"]]);
    });

    it("同一グループ内で前から後ろへ移動するとtoIndexが1つ補正される", () => {
      const state = buildState([{ id: "g1", formationIds: ["a", "b", "c", "d"] }]);

      // 表示上「dの直後（挿入位置4）」を指定してaを移動する。
      const next = moveClanBattleFormation(state, "a", "g1", 4);

      expect(idsOf(next)).toEqual([["b", "c", "d", "a"]]);
    });

    it("同一グループ内で後ろから前へ移動する", () => {
      const state = buildState([{ id: "g1", formationIds: ["a", "b", "c", "d"] }]);

      const next = moveClanBattleFormation(state, "d", "g1", 0);

      expect(idsOf(next)).toEqual([["d", "a", "b", "c"]]);
    });

    it("toIndexが負の値でも0にクランプする", () => {
      const state = buildState([
        { id: "g1", formationIds: ["a", "b"] },
        { id: "g2", formationIds: ["x", "y"] },
      ]);

      const next = moveClanBattleFormation(state, "b", "g2", -5);

      expect(idsOf(next)).toEqual([["a"], ["b", "x", "y"]]);
    });

    it("toIndexが配列長を超えても末尾にクランプする", () => {
      const state = buildState([
        { id: "g1", formationIds: ["a", "b"] },
        { id: "g2", formationIds: ["x", "y"] },
      ]);

      const next = moveClanBattleFormation(state, "b", "g2", 999);

      expect(idsOf(next)).toEqual([["a"], ["x", "y", "b"]]);
    });

    it("同一グループ内でtoIndexが範囲外でもクランプする", () => {
      const state = buildState([{ id: "g1", formationIds: ["a", "b", "c"] }]);

      expect(idsOf(moveClanBattleFormation(state, "a", "g1", -10))).toEqual([["a", "b", "c"]]);
      expect(idsOf(moveClanBattleFormation(state, "a", "g1", 999))).toEqual([["b", "c", "a"]]);
    });

    it("実質no-op（元の位置に戻る移動）の場合は同一参照を返す", () => {
      const state = buildState([{ id: "g1", formationIds: ["a", "b", "c"] }]);

      // bの現在位置(1)へ挿入 = 変化なし
      expect(moveClanBattleFormation(state, "b", "g1", 1)).toBe(state);
      // bの直後(2)へ挿入 = 補正後1で変化なし
      expect(moveClanBattleFormation(state, "b", "g1", 2)).toBe(state);
    });

    it("formationIdが見つからない場合は同一参照を返す", () => {
      const state = buildState([{ id: "g1", formationIds: ["a", "b"] }]);

      expect(moveClanBattleFormation(state, "missing", "g1", 0)).toBe(state);
    });

    it("toGroupIdが見つからない場合は同一参照を返す", () => {
      const state = buildState([{ id: "g1", formationIds: ["a", "b"] }]);

      expect(moveClanBattleFormation(state, "a", "missing", 0)).toBe(state);
    });

    it("移動対象以外のグループは同一参照を維持する（イミュータビリティ）", () => {
      const state = buildState([
        { id: "g1", formationIds: ["a", "b"] },
        { id: "g2", formationIds: ["x", "y"] },
        { id: "g3", formationIds: ["p", "q"] },
      ]);

      const next = moveClanBattleFormation(state, "a", "g2", 0);

      expect(next.groups[0]).not.toBe(state.groups[0]);
      expect(next.groups[1]).not.toBe(state.groups[1]);
      expect(next.groups[2]).toBe(state.groups[2]);
    });

    it("元のstateを変異させない", () => {
      const state = buildState([
        { id: "g1", formationIds: ["a", "b"] },
        { id: "g2", formationIds: ["x", "y"] },
      ]);

      moveClanBattleFormation(state, "a", "g2", 0);

      expect(idsOf(state)).toEqual([["a", "b"], ["x", "y"]]);
    });
  });
});
