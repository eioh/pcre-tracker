import { beforeEach, describe, expect, it } from "vitest";
import { loadStoredState, STORAGE_KEY } from "./storage";
import type { MasterCharacter } from "./types";

const masterCharacters: MasterCharacter[] = [
  {
    name: "ヒヨリ",
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
    expect(hiyori?.ownedMemoryPiece).toBe(0);
    expect(hiyori?.obtainedDate).toBeNull();
    expect(hiyori?.gachaPullCount).toBe(0);
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
});
