import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import { describe, expect, it, vi } from "vitest";
import { InputProgressList } from "./InputProgressList";
import type { VisibleRow } from "./types";

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

// InputProgressListの初期propsを生成する。
function buildProps(overrides?: Partial<ComponentProps<typeof InputProgressList>>): ComponentProps<typeof InputProgressList> {
  const defaultRow: VisibleRow = {
    character: buildCharacter(),
    progress: buildProgress(),
  };

  return {
    visibleRows: [defaultRow],
    purePieceByCharacterName: { ヒヨリ: 0 },
    purePieceByBaseNameFromCharacters: { ヒヨリ: 0 },
    onUpdateProgress: vi.fn(),
    onUpdatePurePiece: vi.fn<(name: string, value: number) => void>(),
    includeSameBasePurePieceForUe2: false,
    starMemoryCalcMode: "implemented_max",
    ue1MemoryCalcMode: "implemented_max",
    ...overrides,
  };
}

// 行タップで編集シートを開き、シート本体（dialog）を返す。
function openEditSheet(characterName: string): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: `${characterName}の編集シートを開く` }));
  return screen.getByRole("dialog");
}

describe("InputProgressList", () => {
  it("行が0件のとき空表示メッセージを出す", () => {
    const props = buildProps({ visibleRows: [] });
    render(<InputProgressList {...props} />);

    expect(screen.getByText("条件に一致するキャラがいません")).toBeInTheDocument();
  });

  it("一覧行にキャラ名・タグ・サマリーを表示する", () => {
    const props = buildProps();
    render(<InputProgressList {...props} />);

    expect(screen.getByText("ヒヨリ")).toBeInTheDocument();
    expect(screen.getByText("恒常")).toBeInTheDocument();
    expect(screen.getByText("火")).toBeInTheDocument();
    expect(screen.getByText("アタッカー")).toBeInTheDocument();
    expect(screen.getByText("☆3")).toBeInTheDocument();
    expect(screen.getByText("RANK 1")).toBeInTheDocument();
    expect(screen.getByText(/^必要 \d+$/)).toBeInTheDocument();
  });

  it("所持チェックのタップは編集シートを開かず所持状態を直接トグルする", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressList {...props} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "ヒヨリの所持状態" }));

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { owned: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("行タップで編集シートが開きキャラ名を表示する", () => {
    const props = buildProps();
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    expect(within(dialog).getByText("ヒヨリ")).toBeInTheDocument();
    expect(within(dialog).getByText("変更は即時保存されます")).toBeInTheDocument();
  });

  it("シート内のステッパーでRANK・専用2を1段ずつ歩進できる", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    // connectRank: 1 / ue2Level: 0 を起点に前後1段ずつ歩進する。
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリのコネクトRANKを上げる" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { connectRank: 2 });
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリのコネクトRANKを下げる" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { connectRank: 0 });
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの専用2を上げる" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue2Level: 1 });
  });

  it("RANKステッパーは下限0で−を、上限15で+を無効化する", () => {
    const props = buildProps({
      visibleRows: [{ character: buildCharacter(), progress: buildProgress({ connectRank: 0 }) }],
    });
    const { rerender } = render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");
    expect(within(dialog).getByRole("button", { name: "ヒヨリのコネクトRANKを下げる" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ヒヨリのコネクトRANKを上げる" })).toBeEnabled();

    rerender(
      <InputProgressList {...props} visibleRows={[{ character: buildCharacter(), progress: buildProgress({ connectRank: 15 }) }]} />,
    );
    expect(within(dialog).getByRole("button", { name: "ヒヨリのコネクトRANKを上げる" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ヒヨリのコネクトRANKを下げる" })).toBeEnabled();
  });

  it("専用1ステッパーは非連続なレベル区間を1段ずつ歩進する", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({
      onUpdateProgress,
      visibleRows: [{ character: buildCharacter(), progress: buildProgress({ ue1Level: 130 }) }],
    });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    // Lv.130 の次は +10 の Lv.140（+1 ではなく値リストの次段）へ進む。
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの専用1を上げる" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue1Level: 140, ue1SpEquipped: false });
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの専用1を下げる" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue1Level: 110, ue1SpEquipped: false });
  });

  it("専用1ステッパーはLv.370の+でSP装備になり、SPの−でSP解除する", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({
      onUpdateProgress,
      visibleRows: [{ character: buildCharacter(), progress: buildProgress({ ue1Level: 370 }) }],
    });
    const { rerender } = render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    // SP実装キャラは Lv.370 の次のステップが SP 装備になる。
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの専用1を上げる" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue1Level: 370, ue1SpEquipped: true });

    rerender(
      <InputProgressList
        {...props}
        visibleRows={[{ character: buildCharacter(), progress: buildProgress({ ue1Level: 370, ue1SpEquipped: true }) }]}
      />,
    );

    // SP装備中は最上段のため + は無効、− で SP を解除して Lv.370 へ戻る。
    expect(within(dialog).getByRole("button", { name: "ヒヨリの専用1を上げる" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの専用1を下げる" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ue1Level: 370, ue1SpEquipped: false });
  });

  it("SP未実装キャラはLv.370で専用1の+を無効化する", () => {
    const row: VisibleRow = {
      character: buildCharacter({
        implemented: {
          star6: true,
          ue1: true,
          ue1Sp: false,
          ue2: true,
        },
      }),
      progress: buildProgress({ ue1Level: 370 }),
    };
    const props = buildProps({ visibleRows: [row] });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    expect(within(dialog).getByRole("button", { name: "ヒヨリの専用1を上げる" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ヒヨリの専用1を下げる" })).toBeEnabled();
  });

  it("専用装備未実装キャラはステッパーを無効表示する", () => {
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
      progress: buildProgress({ ue1Level: null, ue2Level: null }),
    };
    const props = buildProps({
      visibleRows: [row],
      purePieceByCharacterName: { ユイ: 0 },
      purePieceByBaseNameFromCharacters: { ユイ: 0 },
    });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ユイ");

    expect(within(dialog).getByRole("button", { name: "ユイの専用1を上げる" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ユイの専用1を下げる" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ユイの専用2を上げる" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ユイの専用2を下げる" })).toBeDisabled();
  });

  it("シート内の☆セグメントのタップで星を更新できる", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");
    fireEvent.click(within(dialog).getByRole("button", { name: "6" }));

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { star: 6 });
  });

  it("☆6未実装キャラは☆セグメントの「6」を無効化する", () => {
    const row: VisibleRow = {
      character: buildCharacter({
        implemented: {
          star6: false,
          ue1: true,
          ue1Sp: false,
          ue2: false,
        },
      }),
      progress: buildProgress({ ue2Level: null }),
    };
    const props = buildProps({ visibleRows: [row] });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    expect(within(dialog).getByRole("button", { name: "6" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "5" })).toBeEnabled();
  });

  it("シート内の所持チェックと限界突破チェックで進捗更新を通知する", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    fireEvent.click(within(dialog).getByRole("checkbox", { name: "ヒヨリの所持状態" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "ヒヨリの限界突破状態" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "ヒヨリのアドベンチャーメモピ枠" }));

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { owned: false });
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { limitBreak: true });
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { adventureMemoryPieceTarget: true });
  });

  it("シート内の所持メモピ入力はフォーカス外れ時に進捗更新として通知する", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");
    const input = within(dialog).getByRole("spinbutton", { name: "ヒヨリの所持メモピ数" });
    fireEvent.change(input, { target: { value: "42" } });
    expect(onUpdateProgress).not.toHaveBeenCalled();
    fireEvent.blur(input);

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ownedMemoryPiece: 42 });
  });

  it("シート内の所持ピュアピ入力はフォーカス外れ時にキャラ個別更新として通知する", () => {
    const onUpdatePurePiece = vi.fn();
    const props = buildProps({ onUpdatePurePiece });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");
    const input = within(dialog).getByRole("spinbutton", { name: "ヒヨリの所持ピュアピ数" });
    fireEvent.change(input, { target: { value: "77.9" } });
    fireEvent.blur(input);

    expect(onUpdatePurePiece).toHaveBeenCalledWith("ヒヨリ", 77);
  });

  it("シート内の数値ステッパーの+は即コミットする", () => {
    const onUpdateProgress = vi.fn();
    const onUpdatePurePiece = vi.fn();
    const props = buildProps({ onUpdateProgress, onUpdatePurePiece });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    // blur を挟まず、タップの時点で確定値が通知される。
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの所持メモピ数を増やす" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ownedMemoryPiece: 1 });
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの所持ピュアピ数を増やす" }));
    expect(onUpdatePurePiece).toHaveBeenCalledWith("ヒヨリ", 1);
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリのガチャ回数を増やす" }));
    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { gachaPullCount: 1 });
  });

  it("シート内の数値ステッパーの−は即コミットする", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({
      onUpdateProgress,
      visibleRows: [{ character: buildCharacter(), progress: buildProgress({ ownedMemoryPiece: 5 }) }],
    });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの所持メモピ数を減らす" }));

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ownedMemoryPiece: 4 });
  });

  it("入力途中（未blur）に+を押すとdraft文字列を基準に歩進してコミットする", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({
      onUpdateProgress,
      visibleRows: [{ character: buildCharacter(), progress: buildProgress({ ownedMemoryPiece: 5 }) }],
    });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");
    const input = within(dialog).getByRole("spinbutton", { name: "ヒヨリの所持メモピ数" });

    // "12" と打ち込んだだけ（未 blur）の状態で + を押すと、保存値5でなく draft の12を基準に歩進する。
    fireEvent.change(input, { target: { value: "12" } });
    expect(onUpdateProgress).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "ヒヨリの所持メモピ数を増やす" }));

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { ownedMemoryPiece: 13 });
    expect(input).toHaveValue(13);
  });

  it("数値ステッパーは下限0で−を、ガチャ回数の上限300で+を無効化する", () => {
    const props = buildProps({
      visibleRows: [{ character: buildCharacter(), progress: buildProgress({ gachaPullCount: 300 }) }],
    });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    expect(within(dialog).getByRole("button", { name: "ヒヨリの所持メモピ数を減らす" })).toBeDisabled();
    // 所持メモピは上限なしのため + は常に押せる。
    expect(within(dialog).getByRole("button", { name: "ヒヨリの所持メモピ数を増やす" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "ヒヨリのガチャ回数を増やす" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ヒヨリのガチャ回数を減らす" })).toBeEnabled();
  });

  it("シート内の入手日入力で進捗更新を通知する", () => {
    const onUpdateProgress = vi.fn();
    const props = buildProps({ onUpdateProgress });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");
    fireEvent.change(within(dialog).getByLabelText("ヒヨリの入手日"), { target: { value: "2026-02-28" } });

    expect(onUpdateProgress).toHaveBeenCalledWith("ヒヨリ", { obtainedDate: "2026-02-28" });
  });

  it("シートに必要メモピ合計の内訳をインライン表示する", () => {
    const row: VisibleRow = {
      character: buildCharacter(),
      progress: buildProgress({ star: 1 }),
    };
    const props = buildProps({ visibleRows: [row] });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    // テーブルの Tooltip と同じ内訳（☆+450 / RANK+620 / 専用1+120 / 限凸+20 / 所持-0 / 合計1210）を常時表示する。
    expect(within(dialog).getByText("+450")).toBeInTheDocument();
    expect(within(dialog).getByText("+620")).toBeInTheDocument();
    expect(within(dialog).getByText("+120")).toBeInTheDocument();
    expect(within(dialog).getByText("+20")).toBeInTheDocument();
    expect(within(dialog).getByText("1210")).toBeInTheDocument();
  });

  it("シートに必要ピュアピ合計の内訳と同名別衣装の充当分を表示する", () => {
    const props = buildProps({
      purePieceByCharacterName: { ヒヨリ: 10 },
      purePieceByBaseNameFromCharacters: { ヒヨリ: 40 },
      includeSameBasePurePieceForUe2: true,
    });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    expect(within(dialog).getByText("・同名別衣装")).toBeInTheDocument();
    expect(within(dialog).getByText("-30")).toBeInTheDocument();
    expect(within(dialog).getByText("+110")).toBeInTheDocument();
    // +150 は専用2の必要数と合計の2箇所に表示される。
    expect(within(dialog).getAllByText("+150").length).toBe(2);
  });

  it("シートにメモピ入手ソースのバッジを表示する", () => {
    const props = buildProps();
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");

    expect(within(dialog).getByText("ハード")).toBeInTheDocument();
  });

  it("シートは常に一覧の最新進捗を表示する", () => {
    const props = buildProps();
    const { rerender } = render(<InputProgressList {...props} />);

    openEditSheet("ヒヨリ");

    // 編集で progress オブジェクトが再生成されても、name 経由で最新 row を引き直して表示する。
    const updatedRow: VisibleRow = {
      character: buildCharacter(),
      progress: buildProgress({ ownedMemoryPiece: 55 }),
    };
    rerender(<InputProgressList {...props} visibleRows={[updatedRow]} />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("spinbutton", { name: "ヒヨリの所持メモピ数" })).toHaveValue(55);
  });

  it("選択キャラが一覧から消えたらシートを閉じる", () => {
    const props = buildProps();
    const { rerender } = render(<InputProgressList {...props} />);

    openEditSheet("ヒヨリ");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<InputProgressList {...props} visibleRows={[]} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("シートの閉じるボタンでシートを閉じる", () => {
    const props = buildProps();
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ヒヨリ");
    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ピュアピ未実装キャラはシート内の所持ピュアピ入力を無効表示する", () => {
    const row: VisibleRow = {
      character: buildCharacter({
        name: "ユイ",
        implemented: {
          star6: false,
          ue1: false,
          ue1Sp: false,
          ue2: false,
        },
      }),
      progress: buildProgress({ ue1Level: null, ue2Level: null }),
    };
    const props = buildProps({
      visibleRows: [row],
      purePieceByCharacterName: { ユイ: 0 },
      purePieceByBaseNameFromCharacters: { ユイ: 0 },
    });
    render(<InputProgressList {...props} />);

    const dialog = openEditSheet("ユイ");

    expect(within(dialog).getByRole("textbox", { name: "ユイの所持ピュアピ数（未実装）" })).toBeDisabled();
    expect(within(dialog).queryByRole("spinbutton", { name: "ユイの所持ピュアピ数" })).toBeNull();
    // ステッパーの +/− も操作不能にする。
    expect(within(dialog).getByRole("button", { name: "ユイの所持ピュアピ数を増やす" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "ユイの所持ピュアピ数を減らす" })).toBeDisabled();
  });
});
