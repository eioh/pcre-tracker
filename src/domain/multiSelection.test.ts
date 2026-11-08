import { describe, expect, it } from "vitest";
import { isMultiSelected, toggleMultiSelection } from "./multiSelection";

const allValues = [1, 2, 3] as const;

describe("isMultiSelected", () => {
  it("絞り込みなしなら全項目を選択中とみなす", () => {
    expect(isMultiSelected<number>(null, 1)).toBe(true);
  });

  it("配列なら含まれる項目だけ選択中とみなす", () => {
    expect(isMultiSelected<number>([2], 2)).toBe(true);
    expect(isMultiSelected<number>([2], 1)).toBe(false);
    expect(isMultiSelected<number>([], 1)).toBe(false);
  });
});

describe("toggleMultiSelection", () => {
  it("絞り込みなしから 1 項目外すと残りの項目だけになる", () => {
    expect(toggleMultiSelection<number>(null, 2, allValues)).toEqual([1, 3]);
  });

  it("何も選んでいない状態から 1 項目選べる", () => {
    expect(toggleMultiSelection<number>([], 3, allValues)).toEqual([3]);
  });

  it("最後の 1 項目を外すと何も選んでいない状態になる", () => {
    expect(toggleMultiSelection<number>([1], 1, allValues)).toEqual([]);
  });

  it("全項目がそろったら絞り込みなしへ戻す", () => {
    expect(toggleMultiSelection<number>([1, 3], 2, allValues)).toBeNull();
  });

  it("選んだ順ではなく選択肢の順に並べる", () => {
    expect(toggleMultiSelection<number>([3], 1, allValues)).toEqual([1, 3]);
  });
});
