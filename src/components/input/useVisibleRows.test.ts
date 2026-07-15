import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { Ue1SpImplementedFilter } from "../../domain/uiStorage";
import { useVisibleRows } from "./useVisibleRows";

// テスト用のマスターキャラデータを生成する。
function buildCharacter(overrides?: Partial<MasterCharacter>): MasterCharacter {
  return {
    name: "ヒヨリ",
    baseName: "ヒヨリ",
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: {
      star6: true,
      ue1: true,
      ue1Sp: true,
      ue2: true,
    },
    memoryPieceSources: ["hard_quest"],
    ...overrides,
  };
}

// テスト用の進捗データを生成する。
function buildProgress(overrides?: Partial<CharacterProgress>): CharacterProgress {
  return {
    owned: true,
    limitBreak: false,
    star: 3,
    connectRank: 1,
    ue1Level: 0,
    ue1SpEquipped: false,
    ue2Level: 0,
    adventureMemoryPieceTarget: false,
    ownedMemoryPiece: 0,
    obtainedDate: null,
    gachaPullCount: 0,
    ...overrides,
  };
}

// useVisibleRows呼び出し用の共通paramsを生成して、各テストで必要な値だけ上書きできるようにする。
function buildParams(overrides?: {
  masterCharacters?: MasterCharacter[];
  progressByName?: Record<string, CharacterProgress>;
  ue1SpImplementedFilter?: Ue1SpImplementedFilter;
}) {
  return {
    masterCharacters: overrides?.masterCharacters ?? [],
    progressByName: overrides?.progressByName ?? {},
    searchText: "",
    ownedFilter: "all" as const,
    limitedFilter: "all" as const,
    ue1SpImplementedFilter: overrides?.ue1SpImplementedFilter ?? ("all" as const),
    limitBreakFilter: "all" as const,
    adventureMemoryPieceFilter: "all" as const,
    purePieceAvailabilityFilter: "all" as const,
    starMemoryCalcMode: "implemented_max" as const,
    ue1MemoryCalcMode: "implemented_max" as const,
    ue1HeartFragmentCalcMode: "implemented_max" as const,
    starFilters: [],
    ue1Filters: [],
    ue2Filters: [],
    memorySourceFilters: [],
    sortKey: "name" as const,
    sortDirection: null,
  };
}

describe("useVisibleRows 専用1SP実装有無フィルタ", () => {
  const implementedCharacter = buildCharacter({ name: "ヒヨリ", baseName: "ヒヨリ" });
  const unimplementedCharacter = buildCharacter({
    name: "ユイ",
    baseName: "ユイ",
    implemented: { star6: true, ue1: true, ue1Sp: false, ue2: true },
  });
  const masterCharacters = [implementedCharacter, unimplementedCharacter];
  const progressByName: Record<string, CharacterProgress> = {
    ヒヨリ: buildProgress(),
    ユイ: buildProgress(),
  };

  it("実装済みのみを選ぶと専用1SP未実装キャラを除外する", () => {
    const { result } = renderHook(() =>
      useVisibleRows(buildParams({ masterCharacters, progressByName, ue1SpImplementedFilter: "implemented" })),
    );

    expect(result.current.map((row) => row.character.name)).toEqual(["ヒヨリ"]);
  });

  it("未実装のみを選ぶと専用1SP実装済みキャラを除外する", () => {
    const { result } = renderHook(() =>
      useVisibleRows(buildParams({ masterCharacters, progressByName, ue1SpImplementedFilter: "unimplemented" })),
    );

    expect(result.current.map((row) => row.character.name)).toEqual(["ユイ"]);
  });

  it("すべてを選ぶと絞り込まない", () => {
    const { result } = renderHook(() =>
      useVisibleRows(buildParams({ masterCharacters, progressByName, ue1SpImplementedFilter: "all" })),
    );

    expect(result.current.map((row) => row.character.name)).toEqual(["ヒヨリ", "ユイ"]);
  });

  it("フィルタ値の変更がrerenderで即時反映される", () => {
    const { result, rerender } = renderHook(
      (props: { ue1SpImplementedFilter: Ue1SpImplementedFilter }) =>
        useVisibleRows(buildParams({ masterCharacters, progressByName, ...props })),
      { initialProps: { ue1SpImplementedFilter: "all" } },
    );

    expect(result.current.map((row) => row.character.name)).toEqual(["ヒヨリ", "ユイ"]);

    rerender({ ue1SpImplementedFilter: "implemented" });

    expect(result.current.map((row) => row.character.name)).toEqual(["ヒヨリ"]);
  });
});
