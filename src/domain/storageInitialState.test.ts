import { describe, expect, it } from "vitest";
import { masterCharacters } from "./master";
import { buildInitialState, isStoredStateEqualIgnoringUpdatedAt, isStoredStateInitial } from "./storage";
import type { StoredStateV1 } from "./types";

describe("初期状態判定（isStoredStateEqualIgnoringUpdatedAt / isStoredStateInitial）", () => {
  it("updatedAt だけが異なる 2 値は等価とみなす", () => {
    const a = buildInitialState(masterCharacters);
    const b: StoredStateV1 = { ...buildInitialState(masterCharacters), updatedAt: "2000-01-01T00:00:00.000Z" };
    expect(isStoredStateEqualIgnoringUpdatedAt(a, b)).toBe(true);
  });

  it("buildInitialState の結果は初期状態と判定される（updatedAt が現在時刻でも）", () => {
    expect(isStoredStateInitial(buildInitialState(masterCharacters), masterCharacters)).toBe(true);
  });

  it("進捗を編集した state は初期状態と判定されない", () => {
    const initial = buildInitialState(masterCharacters);
    const name = masterCharacters[0]!.name;
    const edited: StoredStateV1 = {
      ...initial,
      progressByName: {
        ...initial.progressByName,
        [name]: { ...initial.progressByName[name]!, owned: true },
      },
    };
    expect(isStoredStateInitial(edited, masterCharacters)).toBe(false);
  });

  it("ピュアピを編集した state は初期状態と判定されない", () => {
    const initial = buildInitialState(masterCharacters);
    const name = masterCharacters[0]!.name;
    const edited: StoredStateV1 = {
      ...initial,
      purePieceByCharacterName: { ...initial.purePieceByCharacterName, [name]: 5 },
    };
    expect(isStoredStateInitial(edited, masterCharacters)).toBe(false);
  });
});
