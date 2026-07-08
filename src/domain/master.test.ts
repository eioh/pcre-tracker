import { describe, expect, it } from "vitest";
import { masterCharacters } from "./master";

describe("masterCharacters の編成順データ", () => {
  it("全キャラが formationOrder を持つ", () => {
    for (const character of masterCharacters) {
      expect(Number.isInteger(character.formationOrder)).toBe(true);
      expect(character.formationOrder).toBeGreaterThanOrEqual(0);
    }
  });

  it("formationOrder は 0 からキャラ数-1 まで重複なく振られている", () => {
    const orders = masterCharacters.map((character) => character.formationOrder).sort((a, b) => a - b);
    expect(orders).toEqual(masterCharacters.map((_, index) => index));
  });
});
