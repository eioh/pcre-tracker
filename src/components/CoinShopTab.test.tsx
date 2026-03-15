import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoinShopTab } from "./CoinShopTab";
import coinShopData from "../data/coinShopMemoryPiece.json";

describe("CoinShopTab", () => {
  it("初期表示でダンジョンコインのキャラ一覧を表示する", () => {
    render(<CoinShopTab />);

    for (const name of coinShopData.dungeon_coin) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("全コインタブのトリガーを表示する", () => {
    render(<CoinShopTab />);

    expect(screen.getByRole("tab", { name: "ダンジョン" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "アリーナ" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "プリーナ" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "クラン" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "マスター" })).toBeInTheDocument();
  });

  it("ダンジョンタブが初期選択されている", () => {
    render(<CoinShopTab />);

    const dungeonTab = screen.getByRole("tab", { name: "ダンジョン" });
    expect(dungeonTab).toHaveAttribute("data-state", "active");
  });

  it("キャラ名が4列グリッドで配置される", () => {
    render(<CoinShopTab />);

    const firstCharCell = screen.getByText(coinShopData.dungeon_coin[0]);
    const grid = firstCharCell.parentElement;
    expect(grid).not.toBeNull();
    expect((grid as HTMLElement).className).toContain("grid-cols-4");
  });

  it("表示中のタブパネル内にキャラ名セルが正しい数だけ存在する", () => {
    render(<CoinShopTab />);

    const activePanel = screen.getByRole("tabpanel");
    const cells = within(activePanel).getAllByText(/.+/);
    expect(cells).toHaveLength(coinShopData.dungeon_coin.length);
  });
});
