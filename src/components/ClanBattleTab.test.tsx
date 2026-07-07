import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClanBattleMember, ClanBattleState, StoredStateV1 } from "../domain/types";
import {
  createClanBattleFormation,
  createClanBattleMember,
  createClanBattleMonthGroup,
} from "../domain/clanBattle";
import { buildInitialState } from "../domain/storage";
import { masterCharacters } from "../domain/master";
import { ClanBattleTab, moveMemberByDirection } from "./ClanBattleTab";

// テスト用のクラバトメンバーを生成する（純関数テストでは育成値は並び替えに関与しないため固定値でよい）。
function buildMember(id: string): ClanBattleMember {
  return {
    id,
    characterName: `キャラ${id}`,
    support: false,
    limitBreak: false,
    star: 3,
    connectRank: 1,
    ue1Level: 0,
    ue1SpEquipped: false,
    ue2Level: 0,
  };
}

describe("moveMemberByDirection", () => {
  it("上方向で1つ前のメンバーと入れ替える", () => {
    const members = [buildMember("a"), buildMember("b"), buildMember("c")];

    const result = moveMemberByDirection(members, "b", "up");

    expect(result.map((member) => member.id)).toEqual(["b", "a", "c"]);
    // 元配列は破壊しない。
    expect(members.map((member) => member.id)).toEqual(["a", "b", "c"]);
  });

  it("下方向で1つ後のメンバーと入れ替える", () => {
    const members = [buildMember("a"), buildMember("b"), buildMember("c")];

    const result = moveMemberByDirection(members, "b", "down");

    expect(result.map((member) => member.id)).toEqual(["a", "c", "b"]);
  });

  it("先頭の上方向・末尾の下方向は何もしない", () => {
    const members = [buildMember("a"), buildMember("b")];

    expect(moveMemberByDirection(members, "a", "up")).toBe(members);
    expect(moveMemberByDirection(members, "b", "down")).toBe(members);
  });

  it("存在しないIDは何もしない", () => {
    const members = [buildMember("a"), buildMember("b")];

    expect(moveMemberByDirection(members, "missing", "up")).toBe(members);
  });
});

// テストに使う実マスターの先頭キャラ（progressByName の初期値を利用するため実データ名を使う）。
const testCharacters = masterCharacters.slice(0, 3);

// メンバー2人入りの編成を持つテスト用stateを生成する。
function buildStateWithFormation(): StoredStateV1 {
  const baseState = buildInitialState(testCharacters);
  const members = testCharacters
    .slice(0, 2)
    .map((character) => createClanBattleMember(character.name, baseState.progressByName[character.name]!));
  const formation = { ...createClanBattleFormation("テスト編成"), members };
  // 現在年月だと差分警告の計算が絡むため、過去の年月グループを使う。
  const group = { ...createClanBattleMonthGroup(2020, 1), formations: [formation] };
  return { ...baseState, clanBattle: { groups: [group] } };
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ClanBattleTab（モバイルの並び替え）", () => {
  it("▲ボタンで並び替え済みのmembersがonChangeへ渡る", () => {
    stubMobileMatchMedia();
    const state = buildStateWithFormation();
    const onChange = vi.fn();
    render(<ClanBattleTab masterCharacters={testCharacters} state={state} onChange={onChange} />);

    const firstName = testCharacters[0]!.name;
    const secondName = testCharacters[1]!.name;

    fireEvent.click(screen.getByRole("button", { name: `${secondName}を上に移動` }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextState = onChange.mock.calls[0]![0] as ClanBattleState;
    expect(nextState.groups[0]!.formations[0]!.members.map((member) => member.characterName)).toEqual([
      secondName,
      firstName,
    ]);
  });

  it("先頭の▲と末尾の▼は無効化されクリックしてもonChangeを呼ばない", () => {
    stubMobileMatchMedia();
    const state = buildStateWithFormation();
    const onChange = vi.fn();
    render(<ClanBattleTab masterCharacters={testCharacters} state={state} onChange={onChange} />);

    const firstName = testCharacters[0]!.name;
    const secondName = testCharacters[1]!.name;

    const upButton = screen.getByRole("button", { name: `${firstName}を上に移動` });
    const downButton = screen.getByRole("button", { name: `${secondName}を下に移動` });
    expect(upButton).toBeDisabled();
    expect(downButton).toBeDisabled();

    fireEvent.click(upButton);
    fireEvent.click(downButton);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("モバイル向け案内文（▲▼で並び替え）を表示する", () => {
    stubMobileMatchMedia();
    const state = buildStateWithFormation();
    render(<ClanBattleTab masterCharacters={testCharacters} state={state} onChange={vi.fn()} />);

    expect(screen.getByText("▲▼で並び替えできます。サポートは最大1人です。")).toBeInTheDocument();
    // デスクトップ向けの従来文言もDOM上には存在する（表示はブレークポイントで出し分け）。
    expect(screen.getByText("ドラッグで並び替えできます。サポートは最大1人です。")).toBeInTheDocument();
  });
});
