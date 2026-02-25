import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type {
  LimitBreakFilter,
  LimitedFilter,
  MemorySourceFilter,
  OwnedFilter,
  StarFilter,
  Ue1Filter,
  Ue2Filter,
} from "../../domain/uiStorage";
import { describe, expect, it, vi } from "vitest";
import { InputFilters } from "./InputFilters";

// InputFiltersの初期propsを生成して、各テストで必要な値だけ上書きできるようにする。
function buildProps(overrides?: Partial<ComponentProps<typeof InputFilters>>): ComponentProps<typeof InputFilters> {
  return {
    searchText: "",
    onSearchTextChange: vi.fn(),
    ownedFilter: "all",
    onOwnedFilterChange: vi.fn<(value: OwnedFilter) => void>(),
    limitedFilter: "all",
    onLimitedFilterChange: vi.fn<(value: LimitedFilter) => void>(),
    limitBreakFilter: "all",
    onLimitBreakFilterChange: vi.fn<(value: LimitBreakFilter) => void>(),
    starFilters: [],
    setStarFilters: vi.fn(),
    ue1Filters: [],
    setUe1Filters: vi.fn(),
    ue2Filters: [],
    setUe2Filters: vi.fn(),
    memorySourceFilters: [],
    setMemorySourceFilters: vi.fn(),
    ...overrides,
  };
}

// ラベル付きコンボボックスを開いて指定項目を選択する。
function selectComboboxOption(label: string, optionLabel: string): void {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
}

// 複数選択フィルタのトリガーをタイトルから開く。
function openMultiSelect(title: string): void {
  const trigger = screen.getByText(title).closest("div")?.querySelector("button");
  fireEvent.click(trigger as HTMLButtonElement);
}

describe("InputFilters", () => {
  it("検索入力の変更を親ハンドラへ通知できる", () => {
    const props = buildProps();
    render(<InputFilters {...props} />);

    fireEvent.change(screen.getByPlaceholderText("例: ヒヨリ"), { target: { value: "ユイ" } });

    expect(props.onSearchTextChange).toHaveBeenCalledWith("ユイ");
  });

  it("検索欄のリセットボタンで文字列を空へ戻せる", () => {
    const props = buildProps({ searchText: "ヒヨリ" });
    render(<InputFilters {...props} />);

    const resetButtons = screen.getAllByRole("button", { name: "リセット" });
    fireEvent.click(resetButtons[0] as HTMLButtonElement);

    expect(props.onSearchTextChange).toHaveBeenCalledWith("");
  });

  it("フィルタリセットで既定値へ戻すコールバックをまとめて発火する", () => {
    const props = buildProps({
      ownedFilter: "owned",
      limitedFilter: "limited",
      limitBreakFilter: "on",
      starFilters: [6],
      ue1Filters: ["sp"],
      ue2Filters: [5],
      memorySourceFilters: ["hard_quest"],
    });
    render(<InputFilters {...props} />);

    const resetButtons = screen.getAllByRole("button", { name: "リセット" });
    fireEvent.click(resetButtons[1] as HTMLButtonElement);

    expect(props.onOwnedFilterChange).toHaveBeenCalledWith("all");
    expect(props.onLimitedFilterChange).toHaveBeenCalledWith("all");
    expect(props.onLimitBreakFilterChange).toHaveBeenCalledWith("all");
    expect(props.setStarFilters).toHaveBeenCalledWith([]);
    expect(props.setUe1Filters).toHaveBeenCalledWith([]);
    expect(props.setUe2Filters).toHaveBeenCalledWith([]);
    expect(props.setMemorySourceFilters).toHaveBeenCalledWith([]);
  });

  it("☆フィルタのチェックで更新関数を呼び出せる", () => {
    const setStarFilters = vi.fn();
    const props = buildProps({ starFilters: [] as StarFilter[], setStarFilters });
    render(<InputFilters {...props} />);

    openMultiSelect("☆");
    fireEvent.click(screen.getByRole("checkbox", { name: "☆6" }));

    expect(setStarFilters).toHaveBeenCalledTimes(1);
    const updater = setStarFilters.mock.calls[0]?.[0] as ((prev: StarFilter[]) => StarFilter[]) | undefined;
    expect(updater).toBeTypeOf("function");
    expect(updater?.([])).toEqual([6]);
  });

  it("メモピ入手フィルタで情報なしを選択できる", () => {
    const setMemorySourceFilters = vi.fn();
    const props = buildProps({
      memorySourceFilters: [] as MemorySourceFilter[],
      setMemorySourceFilters,
    });
    render(<InputFilters {...props} />);

    openMultiSelect("メモピ入手");
    fireEvent.click(screen.getByRole("checkbox", { name: "情報なし" }));

    const updater = setMemorySourceFilters.mock.calls[0]?.[0] as
      | ((prev: MemorySourceFilter[]) => MemorySourceFilter[])
      | undefined;
    expect(updater?.([])).toEqual(["none"]);
  });

  it("各セレクト変更で型に沿った値を通知する", () => {
    const props = buildProps();
    render(<InputFilters {...props} />);

    selectComboboxOption("所持", "所持のみ");
    selectComboboxOption("限定", "限定のみ");
    selectComboboxOption("限界突破", "限界突破済み");

    expect(props.onOwnedFilterChange).toHaveBeenCalledWith("owned");
    expect(props.onLimitedFilterChange).toHaveBeenCalledWith("limited");
    expect(props.onLimitBreakFilterChange).toHaveBeenCalledWith("on");
  });
});
