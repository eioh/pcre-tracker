import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { masterCharacters } from "../domain/master";
import { buildInitialState } from "../domain/storage";
import { getConnectRankRangeMaterialCost } from "../utils/connectRankMaterialCost";
import { ConnectRankCalcTab } from "./ConnectRankCalcTab";

// rowCosts が実マスター（masterByName）を参照するため、テストでも実マスターの先頭キャラを使う。
const testCharacters = masterCharacters.slice(0, 5);

// ConnectRankCalcTabテスト用の共通propsを生成する。
function buildProps() {
  return {
    masterCharacters: testCharacters,
    state: buildInitialState(testCharacters),
    resetToken: 0,
  };
}

// モバイル判定（max-width: 767px）へ常にマッチする matchMedia のスタブを生成する。
function stubMobileMatchMedia(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

// コンボボックスを開いて指定キャラを追加する。
function addCharacter(name: string): void {
  fireEvent.focus(screen.getByPlaceholderText("キャラ名を入力して検索"));
  fireEvent.mouseDown(screen.getByRole("option", { name }));
}

// カード内の素材チップ（ラベル+数値）から数値部分を取得する。
function getChipValue(card: HTMLElement, label: string): number {
  const chip = within(card).getByText(label).parentElement as HTMLElement;
  const valueText = within(chip).getByText(/^\d+$/).textContent ?? "";
  return Number(valueText);
}

afterEach(() => {
  vi.unstubAllGlobals();
  // タブ状態は localStorage へ永続化されるため、テスト間で持ち越さないよう毎回クリアする。
  window.localStorage.clear();
});

describe("ConnectRankCalcTab（モバイル）", () => {
  it("キャラ追加でカードに現在/目標/素材と合計が表示される", () => {
    stubMobileMatchMedia();
    const props = buildProps();
    render(<ConnectRankCalcTab {...props} />);

    const character = testCharacters[0]!;
    addCharacter(character.name);

    // キャラカード（1段目=名前 / 2段目=現在→目標）が表示される。
    const card = screen.getByText(character.name).closest("article") as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getByText("現在 0")).toBeInTheDocument();
    expect(within(card).getByText("目標")).toBeInTheDocument();
    // 目標ランクの Select が操作可能な状態で表示される。
    expect(within(card).getByRole("combobox")).toBeInTheDocument();

    // 素材チップの値がテーブルと同じ計算値（現在0→目標15）で表示される。
    const expected = getConnectRankRangeMaterialCost(character.role, 0, 15);
    expect(getChipValue(card, "アーツ")).toBe(expected.arts);
    expect(getChipValue(card, "ソウル")).toBe(expected.soul);
    expect(getChipValue(card, "ガード")).toBe(expected.guard);
    expect(getChipValue(card, "ブロンズ")).toBe(expected.bronzeRegalia);
    expect(getChipValue(card, "シルバー")).toBe(expected.silverRegalia);
    expect(getChipValue(card, "ゴールド")).toBe(expected.goldRegalia);

    // 合計素材カードが先頭に常時表示され、1件時は行と同じ合計値になる。
    const cards = screen.getAllByRole("article");
    const totalCard = cards[0] as HTMLElement;
    expect(within(totalCard).getByText("集計")).toBeInTheDocument();
    expect(getChipValue(totalCard, "アーツ")).toBe(expected.arts);
    expect(getChipValue(totalCard, "ゴールド")).toBe(expected.goldRegalia);
  });

  it("▲▼ボタンでカードの並び順を入れ替えられる", () => {
    stubMobileMatchMedia();
    const props = buildProps();
    render(<ConnectRankCalcTab {...props} />);

    const first = testCharacters[0]!.name;
    const second = testCharacters[1]!.name;
    addCharacter(first);
    addCharacter(second);

    // 追加直後は [集計, first, second] の順で並ぶ。
    let cards = screen.getAllByRole("article");
    expect(cards[1]).toHaveTextContent(first);
    expect(cards[2]).toHaveTextContent(second);
    // 先頭カードの▲と末尾カードの▼は無効化される。
    expect(screen.getByRole("button", { name: `${first}を上に移動` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${second}を下に移動` })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: `${second}を上に移動` }));

    cards = screen.getAllByRole("article");
    expect(cards[1]).toHaveTextContent(second);
    expect(cards[2]).toHaveTextContent(first);
  });

  it("削除ボタンでカードを削除できる", () => {
    stubMobileMatchMedia();
    const props = buildProps();
    render(<ConnectRankCalcTab {...props} />);

    const name = testCharacters[0]!.name;
    addCharacter(name);
    expect(screen.getByText(name).closest("article")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: `${name}を削除` }));

    // 全件削除で空状態メッセージへ戻る。
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText("キャラクターを追加して素材を計算できます")).toBeInTheDocument();
  });
});

describe("ConnectRankCalcTab（デスクトップ）", () => {
  it("デスクトップ幅では min-w-[900px] のテーブルを描画しカードは出さない", () => {
    // setup.ts の matchMedia スタブは常に非マッチ（= デスクトップ扱い）を返す。
    const props = buildProps();
    const { container } = render(<ConnectRankCalcTab {...props} />);

    addCharacter(testCharacters[0]!.name);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect((table as HTMLElement).className).toContain("min-w-[900px]");
    expect(container.querySelector("article")).toBeNull();
  });
});
