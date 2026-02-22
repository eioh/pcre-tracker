import { beforeEach, describe, expect, it } from "vitest";
import { loadStoredState, STORAGE_KEY } from "./storage";
import type { MasterCharacter } from "./types";

const masterCharacters: MasterCharacter[] = [
  {
    name: "ヒヨリ",
    limited: false,
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
    expect(hiyori?.star).toBe(1);
    expect(hiyori?.ue1Level).toBe(140);
    expect(hiyori?.ue1SpEquipped).toBe(false);
    expect(hiyori?.ue2Level).toBeNull();
  });
});
