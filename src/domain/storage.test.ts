import { beforeEach, describe, expect, it } from "vitest";
import { loadStoredState, STORAGE_KEY } from "./storage";
import type { MasterCharacter } from "./types";

const masterCharacters: MasterCharacter[] = [
  {
    name: "ヒヨリ",
    baseName: "ヒヨリ",
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: { star6: true, ue1: true, ue1Sp: true, ue2: false },
    memoryPieceSources: [],
  },
];

describe("loadStoredState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("schemaVersionなしデータを移行し、未実装項目を補正する", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        progressByName: {
          ヒヨリ: {
            owned: true,
            ue1Level: 140,
            ue1SpEquipped: true,
            ue2Level: 5,
            updatedAt: "2026-02-22T00:00:00.000Z",
          },
        },
      }),
    );

    const loaded = loadStoredState(masterCharacters);
    expect(loaded.schemaVersion).toBe(1);
    const hiyori = loaded.progressByName["ヒヨリ"];
    expect(hiyori).toBeDefined();
    expect(hiyori?.limitBreak).toBe(false);
    expect(hiyori?.star).toBe(1);
    expect(hiyori?.connectRank).toBe(0);
    expect(hiyori?.ue1Level).toBe(140);
    expect(hiyori?.ue1SpEquipped).toBe(false);
    expect(hiyori?.ue2Level).toBeNull();
    expect(hiyori?.adventureMemoryPieceTarget).toBe(false);
    expect(hiyori?.ownedMemoryPiece).toBe(0);
    expect(hiyori?.obtainedDate).toBeNull();
    expect(hiyori?.gachaPullCount).toBe(0);
    expect(loaded.purePieceByCharacterName["ヒヨリ"]).toBe(0);
    expect(loaded.purePieceByBaseName["ヒヨリ"]).toBe(0);
    expect(loaded.clanBattle.groups).toEqual([]);
  });

  it("ガチャ回数を0〜300の範囲へ正規化し、日付不正値を補正する", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        progressByName: {
          ヒヨリ: {
            owned: true,
            limitBreak: false,
            star: 3,
            connectRank: 15,
            ue1Level: 0,
            ue1SpEquipped: false,
            ue2Level: null,
            ownedMemoryPiece: 0,
            obtainedDate: "2026/02/30",
            gachaPullCount: 401.2,
            updatedAt: "2026-02-22T00:00:00.000Z",
          },
        },
      }),
    );

    const loaded = loadStoredState(masterCharacters);
    const hiyori = loaded.progressByName["ヒヨリ"];
    expect(hiyori).toBeDefined();
    expect(hiyori?.obtainedDate).toBeNull();
    expect(hiyori?.gachaPullCount).toBe(300);
  });

  it("入手日のスラッシュ形式をハイフン形式へ正規化する", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        progressByName: {
          ヒヨリ: {
            owned: true,
            limitBreak: false,
            star: 3,
            connectRank: 15,
            ue1Level: 0,
            ue1SpEquipped: false,
            ue2Level: null,
            ownedMemoryPiece: 1,
            obtainedDate: "2026/02/28",
            gachaPullCount: 12,
            updatedAt: "2026-02-22T00:00:00.000Z",
          },
        },
      }),
    );

    const loaded = loadStoredState(masterCharacters);
    const hiyori = loaded.progressByName["ヒヨリ"];
    expect(hiyori?.obtainedDate).toBe("2026-02-28");
  });

  it("コネクトRANKの未開放(0)を保持して読み込む", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        progressByName: {
          ヒヨリ: {
            owned: true,
            limitBreak: false,
            star: 3,
            connectRank: 0,
            ue1Level: 0,
            ue1SpEquipped: false,
            ue2Level: null,
            ownedMemoryPiece: 1,
            obtainedDate: null,
            gachaPullCount: 12,
            updatedAt: "2026-02-22T00:00:00.000Z",
          },
        },
      }),
    );

    const loaded = loadStoredState(masterCharacters);
    const hiyori = loaded.progressByName["ヒヨリ"];
    expect(hiyori?.connectRank).toBe(0);
  });

  it("ピュアピ所持数を 0〜99,999 の整数へ正規化する", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        progressByName: {
          ヒヨリ: {
            owned: false,
            limitBreak: false,
            star: 1,
            connectRank: 0,
            ue1Level: 0,
            ue1SpEquipped: false,
            ue2Level: null,
            ownedMemoryPiece: 0,
            obtainedDate: null,
            gachaPullCount: 0,
          },
        },
        purePieceByBaseName: {
          ヒヨリ: 100000.8,
        },
        purePieceByCharacterName: {
          ヒヨリ: -3.2,
        },
      }),
    );

    const loaded = loadStoredState(masterCharacters);
    expect(loaded.purePieceByBaseName["ヒヨリ"]).toBe(99999);
    expect(loaded.purePieceByCharacterName["ヒヨリ"]).toBe(0);
  });

  it("クラバト編成を読み込み、壊れたメンバー値だけを補正して保持する", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: "2026-06-28T00:00:00.000Z",
        progressByName: {
          ヒヨリ: {
            owned: true,
            limitBreak: false,
            star: 5,
            connectRank: 10,
            ue1Level: 180,
            ue1SpEquipped: false,
            ue2Level: null,
            ownedMemoryPiece: 0,
            obtainedDate: null,
            gachaPullCount: 0,
          },
        },
        clanBattle: {
          groups: [
            {
              id: "group-1",
              year: 2026,
              month: 6,
              formations: [
                {
                  id: "formation-1",
                  name: "1ボス",
                  damage: 123456789.9,
                  timeline: "1:30 test",
                  members: [
                    {
                      id: "member-1",
                      characterName: "ヒヨリ",
                      support: true,
                      limitBreak: true,
                      star: 99,
                      connectRank: 999,
                      ue1Level: "broken",
                      ue1SpEquipped: true,
                      ue2Level: 5,
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    );

    const loaded = loadStoredState(masterCharacters);
    const formation = loaded.clanBattle.groups[0]?.formations[0];
    const member = formation?.members[0];
    expect(loaded.clanBattle.groups).toHaveLength(1);
    expect(formation?.damage).toBe(123456789);
    expect(member?.characterName).toBe("ヒヨリ");
    expect(member?.star).toBe(6);
    expect(member?.connectRank).toBe(15);
    expect(member?.ue1Level).toBe(0);
    expect(member?.ue1SpEquipped).toBe(false);
    expect(member?.ue2Level).toBeNull();
  });
});
