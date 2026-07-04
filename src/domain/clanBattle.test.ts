import { describe, expect, it } from "vitest";
import {
  formatClanBattleDamage,
  getClanBattleMemberDiffs,
  normalizeClanBattleState,
  toClanBattleDamage,
} from "./clanBattle";
import type { CharacterProgress, ClanBattleState, MasterCharacter } from "./types";

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
  },
];

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
});
