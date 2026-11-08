import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import type {
  LimitBreakFilter,
  LimitedFilter,
  MemorySourceFilter,
  OwnedFilter,
  PurePieceAvailabilityFilter,
  SortDirection,
  SortKey,
  StarFilter,
  Ue1Filter,
  Ue1SpImplementedFilter,
  Ue2Filter,
  AdventureMemoryPieceFilter,
} from "../../domain/uiStorage";
import { describe, expect, it, vi } from "vitest";
import { InputFilters } from "./InputFilters";

// InputFiltersの初期propsを生成して、各テストで必要な値だけ上書きできるようにする。
function buildProps(overrides?: Partial<ComponentProps<typeof InputFilters>>): ComponentProps<typeof InputFilters> {
  return {
    ownedFilter: "all",
    onOwnedFilterChange: vi.fn<(value: OwnedFilter) => void>(),
    limitedFilter: "all",
    onLimitedFilterChange: vi.fn<(value: LimitedFilter) => void>(),
    ue1SpImplementedFilter: "all",
    onUe1SpImplementedFilterChange: vi.fn<(value: Ue1SpImplementedFilter) => void>(),
    limitBreakFilter: "all",
    onLimitBreakFilterChange: vi.fn<(value: LimitBreakFilter) => void>(),
    adventureMemoryPieceFilter: "all",
    onAdventureMemoryPieceFilterChange: vi.fn<(value: AdventureMemoryPieceFilter) => void>(),
    purePieceAvailabilityFilter: "all",
    onPurePieceAvailabilityFilterChange: vi.fn<(value: PurePieceAvailabilityFilter) => void>(),
    starFilters: null,
    setStarFilters: vi.fn(),
    ue1Filters: null,
    setUe1Filters: vi.fn(),
    ue2Filters: null,
    setUe2Filters: vi.fn(),
    memorySourceFilters: null,
    setMemorySourceFilters: vi.fn(),
    sortKey: "name",
    onSortKeyChange: vi.fn<(value: SortKey) => void>(),
    sortDirection: null,
    onSortDirectionChange: vi.fn<(value: SortDirection) => void>(),
    ...overrides,
  };
}

// ラベル付きコンボボックスを開いて指定項目を選択する。
function selectComboboxOption(label: string, optionLabel: string): void {
  const field = screen.getByText(label).closest("div");
  expect(field).not.toBeNull();
  fireEvent.click(within(field as HTMLElement).getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
}

// 複数選択フィルタのトリガーをタイトルから開く。
function openMultiSelect(title: string): void {
  const trigger = screen.getByText(title).closest("div")?.querySelector("button");
  fireEvent.click(trigger as HTMLButtonElement);
}

const singleSelectFilterLabels = ["所持", "限定", "限界突破", "アドベンチャー", "ピュアピ", "専用1SP"];
const multiSelectFilterTitles = ["☆", "専用1", "専用2", "メモピ入手"];

// ラベルから単一選択セレクトのトリガーを取得する。
function getSelectTrigger(label: string): HTMLElement {
  const field = screen.getByText(label).closest("div");
  expect(field).not.toBeNull();
  return within(field as HTMLElement).getByRole("combobox");
}

// タイトルから複数選択フィルタのトリガーを取得する。
function getMultiSelectTrigger(title: string): HTMLElement {
  return screen.getByRole("button", { name: `${title}フィルタを開く` });
}

// リセットボタンの配置変更に影響されないよう、アクセシブル名で取得する。
function getFilterResetButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "リセット" }) as HTMLButtonElement;
}

describe("InputFilters", () => {
  it("フィルタリセットで既定値へ戻すコールバックをまとめて発火する", () => {
    const props = buildProps({
      ownedFilter: "owned",
      limitedFilter: "limited",
      ue1SpImplementedFilter: "implemented",
      limitBreakFilter: "on",
      adventureMemoryPieceFilter: "on",
      starFilters: [6],
      ue1Filters: ["sp"],
      ue2Filters: [5],
      memorySourceFilters: ["hard_quest"],
    });
    render(<InputFilters {...props} />);

    fireEvent.click(getFilterResetButton());

    expect(props.onOwnedFilterChange).toHaveBeenCalledWith("all");
    expect(props.onLimitedFilterChange).toHaveBeenCalledWith("all");
    expect(props.onUe1SpImplementedFilterChange).toHaveBeenCalledWith("all");
    expect(props.onLimitBreakFilterChange).toHaveBeenCalledWith("all");
    expect(props.onAdventureMemoryPieceFilterChange).toHaveBeenCalledWith("all");
    expect(props.onPurePieceAvailabilityFilterChange).toHaveBeenCalledWith("all");
    expect(props.setStarFilters).toHaveBeenCalledWith(null);
    expect(props.setUe1Filters).toHaveBeenCalledWith(null);
    expect(props.setUe2Filters).toHaveBeenCalledWith(null);
    expect(props.setMemorySourceFilters).toHaveBeenCalledWith(null);
  });

  it("☆フィルタは絞り込みなしなら全項目にチェックが付き、外すと残りの項目を通知する", () => {
    const setStarFilters = vi.fn();
    render(<InputFilters {...buildProps({ starFilters: null, setStarFilters })} />);

    openMultiSelect("☆");
    for (const star of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByRole("checkbox", { name: `☆${star}` })).toBeChecked();
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "☆6" }));

    expect(setStarFilters).toHaveBeenCalledTimes(1);
    expect(setStarFilters).toHaveBeenCalledWith([1, 2, 3, 4, 5]);
  });

  it("全て選択で絞り込みなし、全て解除で何も選んでいない状態を通知する", () => {
    const setUe2Filters = vi.fn();
    render(<InputFilters {...buildProps({ ue2Filters: [5], setUe2Filters })} />);

    openMultiSelect("専用2");
    fireEvent.click(screen.getByRole("button", { name: "全て選択" }));
    fireEvent.click(screen.getByRole("button", { name: "全て解除" }));

    expect(setUe2Filters).toHaveBeenNthCalledWith(1, null);
    expect(setUe2Filters).toHaveBeenNthCalledWith(2, []);
  });

  it("絞り込みなしでは全て選択、何も選んでいないときは全て解除を押せない", () => {
    const { unmount } = render(<InputFilters {...buildProps({ starFilters: null })} />);
    openMultiSelect("☆");
    expect(screen.getByRole("button", { name: "全て選択" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "全て解除" })).toBeEnabled();
    unmount();

    render(<InputFilters {...buildProps({ starFilters: [] as StarFilter[] })} />);
    openMultiSelect("☆");
    expect(screen.getByRole("button", { name: "全て選択" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "全て解除" })).toBeDisabled();
    for (const star of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByRole("checkbox", { name: `☆${star}` })).not.toBeChecked();
    }
  });

  it("トリガーには選択状態に応じた要約を選択肢の順で表示する", () => {
    render(
      <InputFilters
        {...buildProps({ starFilters: null, ue1Filters: [] as Ue1Filter[], memorySourceFilters: ["hard_quest", "none"] })}
      />,
    );

    expect(getMultiSelectTrigger("☆")).toHaveTextContent("すべて");
    expect(getMultiSelectTrigger("専用1")).toHaveTextContent("選択なし");
    expect(getMultiSelectTrigger("メモピ入手")).toHaveTextContent("情報なし / ハード");
  });

  it("何も選んでいない複数選択フィルタは絞り込み中として強調する", () => {
    render(<InputFilters {...buildProps({ starFilters: [] as StarFilter[] })} />);

    expect(getMultiSelectTrigger("☆")).toHaveAttribute("data-active", "true");
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

    expect(setMemorySourceFilters).toHaveBeenCalledTimes(1);
    expect(setMemorySourceFilters).toHaveBeenCalledWith(["none"]);
  });

  it("各セレクト変更で型に沿った値を通知する", () => {
    const props = buildProps();
    render(<InputFilters {...props} />);

    selectComboboxOption("所持", "所持のみ");
    selectComboboxOption("限定", "限定のみ");
    selectComboboxOption("専用1SP", "実装済みのみ");
    selectComboboxOption("限界突破", "限界突破済み");
    selectComboboxOption("アドベンチャー", "メモピ枠のみ");
    selectComboboxOption("ピュアピ", "入手可能のみ");

    expect(props.onOwnedFilterChange).toHaveBeenCalledWith("owned");
    expect(props.onLimitedFilterChange).toHaveBeenCalledWith("limited");
    expect(props.onUe1SpImplementedFilterChange).toHaveBeenCalledWith("implemented");
    expect(props.onLimitBreakFilterChange).toHaveBeenCalledWith("on");
    expect(props.onAdventureMemoryPieceFilterChange).toHaveBeenCalledWith("on");
    expect(props.onPurePieceAvailabilityFilterChange).toHaveBeenCalledWith("available");
  });

  it("専用1SPフィルタは現在値を表示し未実装のみへの変更も通知する", () => {
    const props = buildProps({ ue1SpImplementedFilter: "implemented" });
    render(<InputFilters {...props} />);

    const field = screen.getByText("専用1SP").closest("div");
    expect(field).not.toBeNull();
    expect(within(field as HTMLElement).getByText("実装済みのみ")).toBeInTheDocument();

    selectComboboxOption("専用1SP", "未実装のみ");

    expect(props.onUe1SpImplementedFilterChange).toHaveBeenCalledWith("unimplemented");
  });

  it("ソート列とソート順の変更を通知する", () => {
    const props = buildProps();
    render(<InputFilters {...props} />);

    selectComboboxOption("ソート列", "必要メモピ合計");
    selectComboboxOption("ソート順", "降順");

    expect(props.onSortKeyChange).toHaveBeenCalledWith("totalMemoryNeeded");
    expect(props.onSortDirectionChange).toHaveBeenCalledWith("desc");
  });

  it("既定値のフィルタはトリガーを強調しない", () => {
    render(<InputFilters {...buildProps()} />);

    for (const label of singleSelectFilterLabels) {
      expect(getSelectTrigger(label)).toHaveAttribute("data-active", "false");
    }
    for (const title of multiSelectFilterTitles) {
      expect(getMultiSelectTrigger(title)).toHaveAttribute("data-active", "false");
    }
  });

  it("既定値から変更したフィルタだけトリガーを強調する", () => {
    render(
      <InputFilters
        {...buildProps({
          ownedFilter: "owned",
          limitBreakFilter: "off",
          starFilters: [5, 6],
          memorySourceFilters: ["hard_quest"],
        })}
      />,
    );

    expect(getSelectTrigger("所持")).toHaveAttribute("data-active", "true");
    expect(getSelectTrigger("限界突破")).toHaveAttribute("data-active", "true");
    expect(getMultiSelectTrigger("☆")).toHaveAttribute("data-active", "true");
    expect(getMultiSelectTrigger("メモピ入手")).toHaveAttribute("data-active", "true");
    expect(getSelectTrigger("限定")).toHaveAttribute("data-active", "false");
    expect(getMultiSelectTrigger("専用1")).toHaveAttribute("data-active", "false");
  });

  it("全フィルタを変更するとすべてのトリガーを強調する", () => {
    render(
      <InputFilters
        {...buildProps({
          ownedFilter: "unowned",
          limitedFilter: "normal",
          ue1SpImplementedFilter: "unimplemented",
          limitBreakFilter: "on",
          adventureMemoryPieceFilter: "off",
          purePieceAvailabilityFilter: "unavailable",
          starFilters: [1],
          ue1Filters: ["unimplemented"],
          ue2Filters: ["unimplemented"],
          memorySourceFilters: ["none"],
        })}
      />,
    );

    for (const label of singleSelectFilterLabels) {
      expect(getSelectTrigger(label)).toHaveAttribute("data-active", "true");
    }
    for (const title of multiSelectFilterTitles) {
      expect(getMultiSelectTrigger(title)).toHaveAttribute("data-active", "true");
    }
  });

  it("ソートのセレクトは強調の対象にしない", () => {
    render(<InputFilters {...buildProps({ sortKey: "star", sortDirection: "desc" })} />);

    expect(getSelectTrigger("ソート列")).not.toHaveAttribute("data-active");
    expect(getSelectTrigger("ソート順")).not.toHaveAttribute("data-active");
  });

  it("フィルタ設定内には一覧の更新操作を表示しない", () => {
    const props = buildProps();
    render(<InputFilters {...props} />);

    expect(screen.queryByRole("button", { name: "表示に適用" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "一覧を更新" })).not.toBeInTheDocument();
  });
});
