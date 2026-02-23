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
        ownedFilter: "owned",
        limitedFilter: "limited",
        limitBreakFilter: "on",
        starMemoryCalcMode: "star6_max",
        ue1MemoryCalcMode: "sp_max",
        starFilters: [4, 6],
        starMemoryNeedFilters: [0, 450],
        ue1Filters: [370, "sp"],
        ue2Filters: [5],
        memorySourceFilters: ["hard_quest", "none"],
        sortKey: "totalMemoryNeeded",
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
          ownedFilter: "foo",
          starFilters: [1, 99, 1, "x"],
          starMemoryNeedFilters: [450, -1, 999],
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
    expect(loaded.input.ownedFilter).toBe("all");
    expect(loaded.input.starFilters).toEqual([1]);
    expect(loaded.input.starMemoryNeedFilters).toEqual([450]);
    expect(loaded.input.ue1Filters).toEqual([370, "sp"]);
    expect(loaded.input.ue2Filters).toEqual([5]);
    expect(loaded.input.memorySourceFilters).toEqual(["hard_quest"]);
    expect(loaded.input.sortDirection).toBeNull();
  });

  it("parseUiStateは壊れたJSONで例外を投げる", () => {
    expect(() => parseUiState("not-json")).toThrow();
  });
});
