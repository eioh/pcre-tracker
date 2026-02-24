import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import type { SortKey } from "../../domain/uiStorage";
import { describe, expect, it, vi } from "vitest";
import { InputProgressTable } from "./InputProgressTable";
import type { VisibleRow } from "./types";

// テスト用のマスターキャラデータを生成する。
function buildCharacter(overrides?: Partial<MasterCharacter>): MasterCharacter {
  return {
    name: "ヒヨリ",
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
    ownedMemoryPiece: 0,
    updatedAt: "2026-02-23T00:00:00.000Z",
    ...overrides,
  };
}

// InputProgressTableの初期propsを生成する。
function buildProps(overrides?: Partial<ComponentProps<typeof InputProgressTable>>): ComponentProps<typeof InputProgressTable> {
  const defaultRow: VisibleRow = {
    character: buildCharacter(),
    progress: buildProgress(),
  };

  return {
    visibleRows: [defaultRow],
    sortKey: "name",
    sortDirection: null,
    onSort: vi.fn<(sortKey: SortKey) => void>(),
    onUpdateProgress: vi.fn(),
    starMemoryCalcMode: "implemented_max",
    ue1MemoryCalcMode: "implemented_max",
    ue1HeartFragmentCalcMode: "implemented_max",
    ...overrides,
  };
}

describe("InputProgressTable", () => {
  it("行が0件のとき空表示メッセージを出す", () => {
    const props = buildProps({ visibleRows: [] });
    render(<InputProgressTable {...props} />);

    expect(screen.getByText("条件に一致するキャラがいません")).toBeInTheDocument();
  });

  it("ヘッダー押下でソートキーを親へ通知できる", () => {
    const props = buildProps();
    render(<InputProgressTable {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /必要メモピ合計/ }));

    expect(props.onSort).toHaveBeenCalledWith("totalMemoryNeeded");
  });

  it("所持メモピ列ヘッダー押下でソートキーを親へ通知できる", () => {
    const props = buildProps();
    render(<InputProgressTable {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /所持メモピ/ }));

    expect(props.onSort).toHaveBeenCalledWith("ownedMemoryPiece");
  });

  it("専用1必要ハートの欠片列ヘッダー押下でソートキーを親へ通知できる", () => {
    const props = buildProps();
    render(<InputProgressTable {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /専用1必要ハートの欠片/ }));

    expect(props.onSort).toHaveBeenCalledWith("ue1HeartFragmentNeeded");
  });

  it("所持チェック変更で進捗更新を通知する", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressTable {...props} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "ヒヨリの所持状態" }));

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { owned: false });
  });

  it("テーブル内セレクト変更で星・専用1・専用2を更新できる", () => {
    const onUpdateProgress = vi.fn();
    const row: VisibleRow = {
      character: buildCharacter(),
      progress: buildProgress(),
    };
    const props = buildProps({ onUpdateProgress, visibleRows: [row] });
    render(<InputProgressTable {...props} />);

    const tableRows = screen.getAllByRole("row");
    const bodyRow = tableRows[1] as HTMLTableRowElement;
    const combos = within(bodyRow).getAllByRole("combobox");

    fireEvent.change(combos[0] as HTMLSelectElement, { target: { value: "6" } });
    fireEvent.change(combos[1] as HTMLSelectElement, { target: { value: "10" } });
    fireEvent.change(combos[2] as HTMLSelectElement, { target: { value: "sp" } });
    fireEvent.change(combos[3] as HTMLSelectElement, { target: { value: "5" } });

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { star: 6 });
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { connectRank: 10 });
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue1Level: 370, ue1SpEquipped: true });
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue2Level: 5 });
  });

  it("所持メモピ入力の変更を進捗更新として通知する", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressTable {...props} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "ヒヨリの所持メモピ数" }), { target: { value: "42" } });

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ownedMemoryPiece: 42 });
  });

  it("必要メモピ合計は所持メモピ数を引いた下限0の値を表示する", () => {
    const row: VisibleRow = {
      character: buildCharacter(),
      progress: buildProgress({ ownedMemoryPiece: 999999 }),
    };
    const props = buildProps({ visibleRows: [row] });
    render(<InputProgressTable {...props} />);

    const tableRows = screen.getAllByRole("row");
    const bodyRow = tableRows[1] as HTMLTableRowElement;
    const cells = within(bodyRow).getAllByRole("cell");

    expect(cells[12]).toHaveTextContent("0");
  });

  it("専用1必要ハートの欠片を表示する", () => {
    const props = buildProps();
    render(<InputProgressTable {...props} />);

    const tableRows = screen.getAllByRole("row");
    const bodyRow = tableRows[1] as HTMLTableRowElement;
    const cells = within(bodyRow).getAllByRole("cell");

    expect(cells[14]).toHaveTextContent("318");
  });

  it("専用1必要ハートの欠片はモード切り替えで未実装キャラも表示できる", () => {
    const row: VisibleRow = {
      character: buildCharacter({
        name: "ユイ",
        implemented: {
          star6: true,
          ue1: false,
          ue1Sp: false,
          ue2: false,
        },
      }),
      progress: buildProgress({ ue1Level: null }),
    };

    const implementedOnlyProps = buildProps({
      visibleRows: [row],
      ue1HeartFragmentCalcMode: "implemented_max",
    });
    const allMaxProps = buildProps({
      visibleRows: [row],
      ue1HeartFragmentCalcMode: "all_max",
    });

    const { rerender } = render(<InputProgressTable {...implementedOnlyProps} />);
    let tableRows = screen.getAllByRole("row");
    let bodyRow = tableRows[1] as HTMLTableRowElement;
    let cells = within(bodyRow).getAllByRole("cell");
    expect(cells[14]).toHaveTextContent("0");

    rerender(<InputProgressTable {...allMaxProps} />);
    tableRows = screen.getAllByRole("row");
    bodyRow = tableRows[1] as HTMLTableRowElement;
    cells = within(bodyRow).getAllByRole("cell");
    expect(cells[14]).toHaveTextContent("318");
  });

  it("メモピ入手列にソース名を表示する", () => {
    const row: VisibleRow = {
      character: buildCharacter({ memoryPieceSources: ["hard_quest"] }),
      progress: buildProgress(),
    };
    const props = buildProps({ visibleRows: [row] });
    render(<InputProgressTable {...props} />);

    expect(screen.getByText("ハード")).toBeInTheDocument();
  });

  it("キャラ名列に属性とロールのチップを表示する", () => {
    const props = buildProps();
    render(<InputProgressTable {...props} />);

    expect(screen.getAllByText("恒常").length).toBeGreaterThan(0);
    expect(screen.getByText("火")).toBeInTheDocument();
    expect(screen.getAllByText("/").length).toBeGreaterThan(0);
    expect(screen.getByText("アタッカー")).toBeInTheDocument();
    expect(screen.getByText("ヒヨリ")).toBeInTheDocument();
  });

  it("未実装キャラは専用装備セレクトを無効表示する", () => {
    const row: VisibleRow = {
      character: buildCharacter({
        name: "ユイ",
        implemented: {
          star6: true,
          ue1: false,
          ue1Sp: false,
          ue2: false,
        },
      }),
      progress: buildProgress(),
    };
    const props = buildProps({ visibleRows: [row], sortDirection: "asc" });
    render(<InputProgressTable {...props} />);

    const tableRows = screen.getAllByRole("row");
    const bodyRow = tableRows[1] as HTMLTableRowElement;
    const combos = within(bodyRow).getAllByRole("combobox");

    expect(combos[2]).toBeDisabled();
    expect(combos[3]).toBeDisabled();
  });

  it("コネクトRANK必要メモピ列ヘッダー押下でソートキーを親へ通知できる", () => {
    const props = buildProps();
    render(<InputProgressTable {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /コネクトRANK必要メモピ/ }));

    expect(props.onSort).toHaveBeenCalledWith("connectRankMemoryNeeded");
  });

  it("専用1のSP選択後に通常レベルへ戻せる", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressTable {...props} />);

    const tableRows = screen.getAllByRole("row");
    const bodyRow = tableRows[1] as HTMLTableRowElement;
    const combos = within(bodyRow).getAllByRole("combobox");

    fireEvent.change(combos[2] as HTMLSelectElement, { target: { value: "sp" } });
    fireEvent.change(combos[2] as HTMLSelectElement, { target: { value: "130" } });

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue1Level: 370, ue1SpEquipped: true });
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue1Level: 130, ue1SpEquipped: false });
  });

  it("所持メモピ入力は負値と小数を補正して通知する", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressTable {...props} />);

    const input = screen.getByRole("spinbutton", { name: "ヒヨリの所持メモピ数" });
    fireEvent.change(input, { target: { value: "-3.8" } });
    fireEvent.change(input, { target: { value: "12.9" } });

    expect(onUpdateProgress).toHaveBeenNthCalledWith(1, "ヒヨリ", { ownedMemoryPiece: 0 });
    expect(onUpdateProgress).toHaveBeenNthCalledWith(2, "ヒヨリ", { ownedMemoryPiece: 12 });
  });
});
