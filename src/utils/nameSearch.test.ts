import { describe, expect, it } from "vitest";
import {
  buildNameSearchTokens,
  isCharacterNameMatched,
  isEditDistanceAtMostOne,
  normalizeForSearch,
  toHiragana,
  toRomaji,
} from "./nameSearch";

describe("nameSearch", () => {
  it("文字列正規化で全角半角と空白を吸収する", () => {
    expect(normalizeForSearch("  ＨＩＹＯＲＩ  ")).toBe("hiyori");
  });

  it("カタカナをひらがなへ変換できる", () => {
    expect(toHiragana("ヒヨリ")).toBe("ひより");
  });

  it("かなをローマ字へ変換できる", () => {
    expect(toRomaji("ヒヨリ")).toBe("hiyori");
  });

  it("検索トークンに日本語とローマ字を含める", () => {
    expect(buildNameSearchTokens("ヒヨリ")).toEqual(["ヒヨリ", "ひより", "hiyori"]);
  });

  it("編集距離1以内を一致として判定できる", () => {
    expect(isEditDistanceAtMostOne("hiyori", "huyori")).toBe(true);
    expect(isEditDistanceAtMostOne("hiyori", "hyorii")).toBe(false);
  });

  it("ひらがな・ローマ字・軽微タイポでキャラ名検索に一致する", () => {
    expect(isCharacterNameMatched("ヒヨリ", "ひより")).toBe(true);
    expect(isCharacterNameMatched("ヒヨリ", "hiyori")).toBe(true);
    expect(isCharacterNameMatched("ヒヨリ", "huyori")).toBe(true);
  });

  it("距離2相当の入力や無関係な語は一致しない", () => {
    expect(isCharacterNameMatched("ヒヨリ", "hyorii")).toBe(false);
    expect(isCharacterNameMatched("ヒヨリ", "yui")).toBe(false);
  });
});
