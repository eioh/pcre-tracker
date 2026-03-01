import { beforeEach, describe, expect, it } from "vitest";
import {
  UI_STORAGE_KEY,
  buildDefaultUiState,
  loadUiState,
  parseUiState,
  saveUiState,
  type UiStateV1,
} from "./uiStorage";

describe("uiStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("未保存時は既定値を返す", () => {
    expect(loadUiState()).toEqual(buildDefaultUiState());
  });

  it("保存したUI設定を再読み込みできる", () => {
    const state: UiStateV1 = {
      schemaVersion: 1,
      activeTab: "dashboard",
      input: {
        searchText: "ヒヨリ",
        isDetailSettingsOpen: true,
        ownedFilter: "owned",
        limitedFilter: "limited",
        limitBreakFilter: "on",
        starMemoryCalcMode: "star6_max",
        ue1MemoryCalcMode: "sp_max",
        ue1HeartFragmentCalcMode: "all_max",
        starFilters: [4, 6],
        ue1Filters: [370, "sp"],
        ue2Filters: [5],
        memorySourceFilters: ["hard_quest", "none"],
        sortKey: "obtainedDate",
        sortDirection: "desc",
      },
    };

    saveUiState(state);
    expect(loadUiState()).toEqual(state);
  });

  it("不正な値は項目ごとに既定値へ補正する", () => {
    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 999,
        activeTab: "broken",
        input: {
          searchText: 123,
          isDetailSettingsOpen: "broken",
          ownedFilter: "foo",
          starFilters: [1, 99, 1, "x"],
          ue1Filters: [370, 999, "sp"],
          ue2Filters: [5, 99],
          memorySourceFilters: ["hard_quest", "unknown", "hard_quest"],
          sortDirection: "unknown",
        },
      }),
    );

    const loaded = loadUiState();
    expect(loaded.activeTab).toBe("input");
    expect(loaded.input.searchText).toBe("");
    expect(loaded.input.isDetailSettingsOpen).toBe(false);
    expect(loaded.input.ownedFilter).toBe("all");
    expect(loaded.input.limitedFilter).toBe("all");
    expect(loaded.input.limitBreakFilter).toBe("all");
    expect(loaded.input.starMemoryCalcMode).toBe("implemented_max");
    expect(loaded.input.ue1MemoryCalcMode).toBe("implemented_max");
    expect(loaded.input.ue1HeartFragmentCalcMode).toBe("implemented_max");
    expect(loaded.input.starFilters).toEqual([1]);
    expect(loaded.input.ue1Filters).toEqual([370, "sp"]);
    expect(loaded.input.ue2Filters).toEqual([5]);
    expect(loaded.input.memorySourceFilters).toEqual(["hard_quest"]);
    expect(loaded.input.sortKey).toBe("name");
    expect(loaded.input.sortDirection).toBeNull();
  });

  it("削除済みsortKeyは既定値へフォールバックする", () => {
    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        activeTab: "input",
        input: {
          sortKey: "starMemoryNeeded",
          sortDirection: "asc",
        },
      }),
    );

    const loaded = loadUiState();
    expect(loaded.input.sortKey).toBe("name");
    expect(loaded.input.sortDirection).toBe("asc");
  });

  it("新規sortKeyのガチャ回数を正しく復元する", () => {
    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        activeTab: "input",
        input: {
          sortKey: "gachaPullCount",
          sortDirection: "desc",
        },
      }),
    );

    const loaded = loadUiState();
    expect(loaded.input.sortKey).toBe("gachaPullCount");
    expect(loaded.input.sortDirection).toBe("desc");
  });

  it("parseUiStateは壊れたJSONでも既定値を返す", () => {
    expect(parseUiState("not-json")).toEqual(buildDefaultUiState());
  });
});
