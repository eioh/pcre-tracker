import { useState, type ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClanBattleState, StoredStateV1 } from "../domain/types";
import {
  createClanBattleFormation,
  createClanBattleMember,
  createClanBattleMonthGroup,
} from "../domain/clanBattle";
import { buildInitialState } from "../domain/storage";
import { masterCharacters } from "../domain/master";
import { ClanBattleTab } from "./ClanBattleTab";

type HarnessProps = Omit<ComponentProps<typeof ClanBattleTab>, "selectedFormationId" | "onSelectFormation"> & {
  initialSelectedFormationId?: string | null;
  onSelectFormation?: (formationId: string | null) => void;
};

// 実アプリの親（App）と同様に選択編成IDを親側stateで保持し、ClanBattleTabへ渡すテスト用ラッパー。
function ClanBattleTabHarness({ initialSelectedFormationId = null, onSelectFormation, ...props }: HarnessProps) {
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(initialSelectedFormationId);
  return (
    <ClanBattleTab
      {...props}
      selectedFormationId={selectedFormationId}
      onSelectFormation={(formationId) => {
        setSelectedFormationId(formationId);
        onSelectFormation?.(formationId);
      }}
    />
  );
}

// テストに使う実マスターの先頭3キャラ（progressByName の初期値を利用するため実データ名を使う）。
// formationOrder 昇順に並べ直し、[0]=order最小・[1]=中間・[2]=最大の前提をマスターの並び順の偶然に依存せず保証する。
const testCharacters = [...masterCharacters.slice(0, 3)].sort((a, b) => a.formationOrder - b.formationOrder);

// order最小・最大の2体入り編成を持つテスト用stateを生成する（中間の testCharacters[1] は追加テスト用に空けておく）。
function buildStateWithFormation(): StoredStateV1 {
  const baseState = buildInitialState(testCharacters);
  const members = [testCharacters[0]!, testCharacters[2]!]
    .map((character) => createClanBattleMember(character.name, baseState.progressByName[character.name]!));
  const formation = { ...createClanBattleFormation("テスト編成"), members };
  // 現在年月だと差分警告の計算が絡むため、過去の年月グループを使う。
  const group = { ...createClanBattleMonthGroup(2020, 1), formations: [formation] };
  return { ...baseState, clanBattle: { groups: [group] } };
}

describe("ClanBattleTab（キャラ追加時のformationOrder自動ソート）", () => {
  // 選択値の変更と親からの再描画を再現し、今月だけ育成入力との差分警告を表示する既存条件を確認する。
  it.each([true, false])("編成の値を変更した際の差分警告は今月かどうかに従う（今月: %s）", (isCurrentMonth) => {
    const state = buildStateWithFormation();
    const today = new Date();
    const group = state.clanBattle.groups[0]!;
    group.year = isCurrentMonth ? today.getFullYear() : today.getFullYear() - 1;
    group.month = today.getMonth() + 1;
    const onChange = vi.fn();
    const { rerender } = render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={onChange} />);
    const firstRow = screen.getAllByRole("article")[0]!;
    expect(within(firstRow).queryByLabelText("☆に差分があります")).toBeNull();
    const nextStar = group.formations[0]!.members[0]!.star === 1 ? 2 : 1;
    fireEvent.click(within(firstRow).getAllByRole("combobox")[0]!);
    fireEvent.click(screen.getByRole("option", { name: String(nextStar) }));
    const next = onChange.mock.calls[0]![0] as ClanBattleState;
    rerender(<ClanBattleTabHarness masterCharacters={testCharacters} state={{ ...state, clanBattle: next }} onChange={onChange} />);
    const warning = within(screen.getAllByRole("article")[0]!).queryByLabelText("☆に差分があります");
    if (isCurrentMonth) {
      expect(warning).toBeInTheDocument();
    } else {
      expect(warning).toBeNull();
    }
  });

  // 最大値の表示と実際の変更通知を同時に検証し、見た目の変更で編集機能が失われないことを確認する。
  it("最大育成はゴールドで表示し、フラットな選択欄から編成の値を更新できる", () => {
    const state = buildStateWithFormation();
    const member = state.clanBattle.groups[0]!.formations[0]!.members[0]!;
    const character = { ...testCharacters[0]!, implemented: { star6: true, ue1: true, ue1Sp: true, ue2: true } };
    Object.assign(member, { star: 6, connectRank: 15, ue1Level: 370, ue1SpEquipped: false, ue2Level: 5 });
    const onChange = vi.fn();
    const { rerender } = render(<ClanBattleTabHarness masterCharacters={[character, testCharacters[2]!]} state={state} onChange={onChange} />);
    const fields = within(screen.getAllByRole("article")[0]!).getAllByRole("combobox");
    expect(fields[0]).toHaveClass("text-maxed-value");
    expect(fields[1]).toHaveClass("text-maxed-value");
    expect(fields[2]).not.toHaveClass("text-maxed-value");
    expect(fields[3]).toHaveClass("text-maxed-value");

    fireEvent.click(fields[2]!);
    fireEvent.click(screen.getByRole("option", { name: "SP" }));
    const next = onChange.mock.calls[0]![0] as ClanBattleState;
    expect(next.groups[0]!.formations[0]!.members[0]).toMatchObject({ ue1Level: 370, ue1SpEquipped: true });
    rerender(<ClanBattleTabHarness masterCharacters={[character, testCharacters[2]!]} state={{ ...state, clanBattle: next }} onChange={onChange} />);
    expect(within(screen.getAllByRole("article")[0]!).getAllByRole("combobox")[2]).toHaveClass("text-maxed-value");
  });

  it("order最小・最大の2体入り編成に中間キャラを追加すると、昇順3体でonChangeへ渡る", () => {
    // テストの前提（3キャラの formationOrder が相異なる=中間が一意に決まる）をマスター再生成後も検知できるよう明示する。
    expect(testCharacters[0]!.formationOrder).toBeLessThan(testCharacters[1]!.formationOrder);
    expect(testCharacters[1]!.formationOrder).toBeLessThan(testCharacters[2]!.formationOrder);

    // buildStateWithFormation は testCharacters[0](order最小)・[2](order最大) の2体を編成済みにする。
    const state = buildStateWithFormation();
    const onChange = vi.fn();
    render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={onChange} />);

    const minName = testCharacters[0]!.name;
    const middleName = testCharacters[1]!.name;
    const maxName = testCharacters[2]!.name;

    fireEvent.change(screen.getByPlaceholderText("キャラ検索"), { target: { value: middleName } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(middleName) }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextState = onChange.mock.calls[0]![0] as ClanBattleState;
    expect(nextState.groups[0]!.formations[0]!.members.map((member) => member.characterName)).toEqual([
      minName,
      middleName,
      maxName,
    ]);
  });

  it("新しい案内文（編成順で自動的に並ぶ旨）を表示し、旧案内文は表示しない", () => {
    const state = buildStateWithFormation();
    render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={vi.fn()} />);

    expect(screen.getByText("編成順（隊列の並び）で自動的に並びます。サポートは最大1人です。")).toBeInTheDocument();
    expect(screen.queryByText("▲▼で並び替えできます。サポートは最大1人です。")).not.toBeInTheDocument();
    expect(screen.queryByText("ドラッグで並び替えできます。サポートは最大1人です。")).not.toBeInTheDocument();
  });
});

describe("ClanBattleTab（編成コピー）", () => {
  it("コピーボタンをクリックすると同じ年月グループの末尾に複製編成が追加される", () => {
    const state = buildStateWithFormation();
    const onChange = vi.fn();
    render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={onChange} />);

    const originalFormation = state.clanBattle.groups[0]!.formations[0]!;

    fireEvent.click(screen.getByRole("button", { name: `${originalFormation.name}をコピー` }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextState = onChange.mock.calls[0]![0] as ClanBattleState;
    const nextFormations = nextState.groups[0]!.formations;

    // 元の編成はそのまま残り、末尾に複製（名前に「 (コピー)」付加、内容は一致、IDは新規採番）が追加される。
    expect(nextFormations).toHaveLength(2);
    expect(nextFormations[0]).toEqual(originalFormation);
    const duplicated = nextFormations[1]!;
    expect(duplicated.id).not.toBe(originalFormation.id);
    expect(duplicated.name).toBe(`${originalFormation.name} (コピー)`);
    expect(duplicated.timeline).toBe(originalFormation.timeline);
    expect(duplicated.damage).toBe(originalFormation.damage);
    expect(duplicated.members.map((member) => member.characterName)).toEqual(
      originalFormation.members.map((member) => member.characterName),
    );
  });

  it("コピー後は複製先の編成が選択状態になり、元編成の選択に化けない", () => {
    const state = buildStateWithFormation();
    const originalFormation = state.clanBattle.groups[0]!.formations[0]!;
    const onChange = vi.fn();
    const { rerender } = render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: `${originalFormation.name}をコピー` }));

    // 実アプリと同様、onChangeで受け取ったclanBattleを親から再度propsとして渡す（選択IDは親stateとして既にクリック時点で複製先へ更新済み）。
    const nextState = onChange.mock.calls[0]![0] as ClanBattleState;
    rerender(<ClanBattleTabHarness masterCharacters={testCharacters} state={{ ...state, clanBattle: nextState }} onChange={onChange} />);

    const duplicated = nextState.groups[0]!.formations[1]!;
    expect(screen.getByDisplayValue(duplicated.name)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(originalFormation.name)).not.toBeInTheDocument();
  });

  it("月グループが2つあるとき、2つ目のグループの編成をコピーしても複製はそのグループの末尾に入り、1つ目のグループは変化しない", () => {
    const baseState = buildInitialState(testCharacters);
    const formationA = createClanBattleFormation("編成A");
    const formationB = createClanBattleFormation("編成B");
    const groupA = { ...createClanBattleMonthGroup(2020, 1), formations: [formationA] };
    const groupB = { ...createClanBattleMonthGroup(2020, 2), formations: [formationB] };
    const state: StoredStateV1 = { ...baseState, clanBattle: { groups: [groupA, groupB] } };
    const onChange = vi.fn();
    render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={onChange} />);

    // 既定では最新月（2つ目のグループ=2020年2月）の編成が選択・展開されているため、そのままコピーできる。
    expect(screen.getByRole("button", { name: /2020年1月/, expanded: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "編成Bをコピー" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextState = onChange.mock.calls[0]![0] as ClanBattleState;
    const nextGroupA = nextState.groups.find((group) => group.id === groupA.id)!;
    const nextGroupB = nextState.groups.find((group) => group.id === groupB.id)!;

    // 1つ目のグループ（編成A）は無関係なのでそのまま。
    expect(nextGroupA.formations).toEqual([formationA]);
    // 2つ目のグループ（編成B）の末尾に複製が追加される。
    expect(nextGroupB.formations).toHaveLength(2);
    expect(nextGroupB.formations[0]).toEqual(formationB);
    expect(nextGroupB.formations[1]!.name).toBe("編成B (コピー)");
  });
});

describe("ClanBattleTab（編成行の表示順）", () => {
  it("編成行はformations配列の並び順（並び替え結果）でレンダリングされる", () => {
    // jsdomはPointerEvent未実装でD&D操作そのものはテストできないため、
    // 配列順が表示順に正しく反映される（＝並び替え結果を表示できる）ことだけを検証する。
    const baseState = buildInitialState(testCharacters);
    const formations = ["Zebra編成", "Apple編成", "Mango編成"].map((name) => createClanBattleFormation(name));
    const group = { ...createClanBattleMonthGroup(2020, 1), formations };
    const state: StoredStateV1 = { ...baseState, clanBattle: { groups: [group] } };
    render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={vi.fn()} />);

    const copyButtons = screen.getAllByRole("button", { name: /をコピー$/ });
    expect(copyButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Zebra編成をコピー",
      "Apple編成をコピー",
      "Mango編成をコピー",
    ]);
  });
});

describe("ClanBattleTab（選択編成の既定値と復元）", () => {
  // 保存順が古い月→新しい月でも、表示順（新しい順）で最新月の先頭編成を既定選択する。
  function buildStateWithMonths(): { state: StoredStateV1; older: string; newer: string } {
    const baseState = buildInitialState(testCharacters);
    const older = createClanBattleFormation("古い月の編成");
    const newer = createClanBattleFormation("新しい月の編成");
    const newerSecond = createClanBattleFormation("新しい月の編成2");
    const groups = [
      { ...createClanBattleMonthGroup(2020, 1), formations: [older] },
      { ...createClanBattleMonthGroup(2020, 3), formations: [newer, newerSecond] },
      // 最新だが編成のない月は飛ばされる。
      { ...createClanBattleMonthGroup(2020, 5), formations: [] },
    ];
    return { state: { ...baseState, clanBattle: { groups } }, older: older.id, newer: newer.id };
  }

  it("保存値がないときは編成を持つ最新月の先頭編成を選択し、そのIDを親へ通知する", () => {
    const { state, newer } = buildStateWithMonths();
    const onSelectFormation = vi.fn();
    render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={vi.fn()} onSelectFormation={onSelectFormation} />);

    expect(screen.getByDisplayValue("新しい月の編成")).toBeInTheDocument();
    expect(onSelectFormation).toHaveBeenCalledWith(newer);
  });

  it("保存値の編成が存在すればそれを選択する", () => {
    const { state, older } = buildStateWithMonths();
    render(<ClanBattleTabHarness masterCharacters={testCharacters} state={state} onChange={vi.fn()} initialSelectedFormationId={older} />);

    expect(screen.getByDisplayValue("古い月の編成")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2020年1月/, expanded: true })).toBeInTheDocument();
  });

  it("保存値の編成が存在しなければ最新月の先頭編成へフォールバックする", () => {
    const { state, newer } = buildStateWithMonths();
    const onSelectFormation = vi.fn();
    render(
      <ClanBattleTabHarness
        masterCharacters={testCharacters}
        state={state}
        onChange={vi.fn()}
        initialSelectedFormationId="deleted-id"
        onSelectFormation={onSelectFormation}
      />,
    );

    expect(screen.getByDisplayValue("新しい月の編成")).toBeInTheDocument();
    expect(onSelectFormation).toHaveBeenCalledWith(newer);
  });

  it("選択中の編成を削除すると、削除後の状態で最新月の先頭編成を選び直す", () => {
    const { state, older, newer } = buildStateWithMonths();
    const onSelectFormation = vi.fn();
    const onChange = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <ClanBattleTabHarness
        masterCharacters={testCharacters}
        state={state}
        onChange={onChange}
        initialSelectedFormationId={newer}
        onSelectFormation={onSelectFormation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "編成削除" }));
    confirmSpy.mockRestore();

    const nextState = onChange.mock.calls[0]![0] as ClanBattleState;
    const nextSelectedId = onSelectFormation.mock.calls.at(-1)![0] as string;
    // 同じ月に残った「新しい月の編成2」が最新月の先頭となり、古い月には戻らない。
    expect(nextSelectedId).not.toBe(older);
    expect(nextState.groups[1]!.formations[0]!.id).toBe(nextSelectedId);
  });
});
