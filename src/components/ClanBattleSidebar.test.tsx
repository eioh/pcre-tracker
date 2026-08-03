import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Active, Over } from "@dnd-kit/core";
import type { ClanBattleMonthGroup } from "../domain/types";
import { ClanBattleSidebar, resolveDropTarget } from "./ClanBattleSidebar";

// jsdom には ResizeObserver が無く、Radix Popover の位置計算が失敗するためスタブを補完する。
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
});

// ID以外の内容を問わないテスト用の月グループを生成する。
function buildGroup(id: string, year: number, month: number, formationNames: string[]): ClanBattleMonthGroup {
  return {
    id,
    year,
    month,
    formations: formationNames.map((name) => ({ id: `${id}_${name}`, name, damage: 0, timeline: "", members: [] })),
  };
}

// サイドバーの既定propsを生成する（2026年8月に2編成、2026年7月に1編成）。
function buildProps() {
  return {
    groups: [buildGroup("g1", 2026, 8, ["編成A", "編成B"]), buildGroup("g2", 2026, 7, ["編成C"])],
    selectedFormationId: "g1_編成A",
    onSelectFormation: vi.fn<(formationId: string) => void>(),
    onAddMonthGroup: vi.fn<(year: number, month: number) => void>(),
    onDeleteMonthGroup: vi.fn<(groupId: string) => void>(),
    onAddFormation: vi.fn<(groupId: string, name: string) => void>(),
    onCopyFormation: vi.fn<(groupId: string, formationId: string) => void>(),
    onMoveFormation: vi.fn<(formationId: string, toGroupId: string, toIndex: number) => void>(),
  };
}

// 矩形（ClientRect）をtop/heightから組み立てる。
function buildRect(top: number, height: number) {
  return { top, left: 0, width: 200, height, bottom: top + height, right: 200 };
}

// ドラッグ中の編成行（active）を、translated矩形付きで組み立てる。
function buildActive(id: string, top: number, height = 40): Active {
  return {
    id,
    data: { current: undefined },
    rect: { current: { initial: null, translated: buildRect(top, height) } },
  } as unknown as Active;
}

// ドロップ先の編成行（over）を、所属月と行indexを持たせて組み立てる。
function buildOverRow(id: string, containerId: string, index: number, top: number, height = 40): Over {
  return {
    id,
    data: { current: { sortable: { containerId, index, items: [] } } },
    rect: buildRect(top, height),
    disabled: false,
  } as unknown as Over;
}

// ドロップ先の月コンテナ（空の月・折りたたみ見出し）を組み立てる。
function buildOverMonth(groupId: string, formationCount: number): Over {
  return {
    id: `droppable-${groupId}`,
    data: { current: { groupId, formationCount } },
    rect: buildRect(0, 40),
    disabled: false,
  } as unknown as Over;
}

describe("resolveDropTarget", () => {
  it("over行の中心より下にいるときはその行の後ろへ挿入する", () => {
    // over行は top=100/height=40（中心120）、ドラッグ行の中心は130。
    expect(resolveDropTarget(buildActive("drag", 110), buildOverRow("row", "g1", 2, 100))).toEqual({
      groupId: "g1",
      index: 3,
    });
  });

  it("over行の中心より上にいるときはその行の前へ挿入する", () => {
    // ドラッグ行の中心は110でover行の中心120より上。
    expect(resolveDropTarget(buildActive("drag", 90), buildOverRow("row", "g1", 2, 100))).toEqual({
      groupId: "g1",
      index: 2,
    });
  });

  it("月コンテナ（空の月・折りたたみ見出し）へのドロップはその月の末尾になる", () => {
    expect(resolveDropTarget(buildActive("drag", 0), buildOverMonth("g2", 3))).toEqual({ groupId: "g2", index: 3 });
  });

  it("overが無い・自分自身の上・sortable情報が無い場合はnullを返す", () => {
    expect(resolveDropTarget(buildActive("drag", 0), null)).toBeNull();
    expect(resolveDropTarget(buildActive("drag", 0), buildOverRow("drag", "g1", 1, 100))).toBeNull();
    expect(resolveDropTarget(buildActive("drag", 0), { id: "x", data: { current: {} }, rect: buildRect(0, 40) } as unknown as Over)).toBeNull();
  });

  it("ドラッグ中の矩形が未計測のときはover行の位置をそのまま使う", () => {
    const active = { id: "drag", data: { current: undefined }, rect: { current: { initial: null, translated: null } } } as unknown as Active;

    expect(resolveDropTarget(active, buildOverRow("row", "g1", 2, 100))).toEqual({ groupId: "g1", index: 2 });
  });
});

describe("ClanBattleSidebar（月フォルダの折りたたみ）", () => {
  it("選択中編成のある月だけ展開し、畳んだ月は編成数バッジを出して中身を描画しない", () => {
    render(<ClanBattleSidebar {...buildProps()} />);

    expect(screen.getByRole("button", { name: /2026年8月/, expanded: true })).toBeInTheDocument();
    const collapsedToggle = screen.getByRole("button", { name: /2026年7月/, expanded: false });
    expect(collapsedToggle).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "編成Aをコピー" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "編成Cをコピー" })).not.toBeInTheDocument();
  });

  it("月見出しを押すたびに展開と折りたたみが切り替わる", () => {
    render(<ClanBattleSidebar {...buildProps()} />);

    fireEvent.click(screen.getByRole("button", { name: /2026年8月/, expanded: true }));
    expect(screen.getByRole("button", { name: /2026年8月/, expanded: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "編成Aをコピー" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /2026年8月/, expanded: false }));
    expect(screen.getByRole("button", { name: "編成Aをコピー" })).toBeInTheDocument();
  });

  it("選択中編成のある月は手動で畳んでも見出しを選択色でハイライトする", () => {
    render(<ClanBattleSidebar {...buildProps()} />);

    fireEvent.click(screen.getByRole("button", { name: /2026年8月/, expanded: true }));

    expect(screen.getByRole("button", { name: /2026年8月/, expanded: false }).className).toContain("bg-selected");
    expect(screen.getByRole("button", { name: /2026年7月/, expanded: false }).className).not.toContain("bg-selected");
  });
});

describe("ClanBattleSidebar（インライン編成追加）", () => {
  it("畳んだ月の＋を押すと展開してインライン入力欄を表示し、Enterで編成を追加する", () => {
    const props = buildProps();
    render(<ClanBattleSidebar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "2026年7月に編成を追加" }));

    expect(screen.getByRole("button", { name: /2026年7月/, expanded: true })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "編成名" });
    fireEvent.change(input, { target: { value: "新編成" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onAddFormation).toHaveBeenCalledWith("g2", "新編成");
    expect(screen.queryByRole("textbox", { name: "編成名" })).not.toBeInTheDocument();
  });

  it("Escapeでインライン入力欄をキャンセルし、編成は追加しない", () => {
    const props = buildProps();
    render(<ClanBattleSidebar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "2026年8月に編成を追加" }));
    const input = screen.getByRole("textbox", { name: "編成名" });
    fireEvent.change(input, { target: { value: "捨てる編成" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(props.onAddFormation).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "編成名" })).not.toBeInTheDocument();
  });

  it("blurでインライン入力欄をキャンセルし、編成は追加しない", () => {
    const props = buildProps();
    render(<ClanBattleSidebar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "2026年8月に編成を追加" }));
    const input = screen.getByRole("textbox", { name: "編成名" });
    fireEvent.change(input, { target: { value: "捨てる編成" } });
    fireEvent.blur(input);

    expect(props.onAddFormation).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "編成名" })).not.toBeInTheDocument();
  });

  it("インライン入力欄は同時に1つだけで、別の月の＋を押すと入力内容を引き継がない", () => {
    const props = buildProps();
    render(<ClanBattleSidebar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "2026年8月に編成を追加" }));
    fireEvent.change(screen.getByRole("textbox", { name: "編成名" }), { target: { value: "8月の編成" } });
    fireEvent.click(screen.getByRole("button", { name: "2026年7月に編成を追加" }));

    const inputs = screen.getAllByRole("textbox", { name: "編成名" });
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveValue("");
  });
});

describe("ClanBattleSidebar（月追加ポップオーバー）", () => {
  it("＋月を追加から現在年月でonAddMonthGroupを呼ぶ", () => {
    const props = buildProps();
    render(<ClanBattleSidebar {...props} />);
    const now = new Date();

    fireEvent.click(screen.getByRole("button", { name: "月を追加" }));
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(props.onAddMonthGroup).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1);
  });

  it("常設の年月セレクト行と月ごとの編成追加フォームは表示しない", () => {
    render(<ClanBattleSidebar {...buildProps()} />);

    expect(screen.queryByRole("button", { name: "編成を追加" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
