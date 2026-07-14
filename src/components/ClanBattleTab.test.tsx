import { fireEvent, render, screen } from "@testing-library/react";
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
  it("order最小・最大の2体入り編成に中間キャラを追加すると、昇順3体でonChangeへ渡る", () => {
    // テストの前提（3キャラの formationOrder が相異なる=中間が一意に決まる）をマスター再生成後も検知できるよう明示する。
    expect(testCharacters[0]!.formationOrder).toBeLessThan(testCharacters[1]!.formationOrder);
    expect(testCharacters[1]!.formationOrder).toBeLessThan(testCharacters[2]!.formationOrder);

    // buildStateWithFormation は testCharacters[0](order最小)・[2](order最大) の2体を編成済みにする。
    const state = buildStateWithFormation();
    const onChange = vi.fn();
    render(<ClanBattleTab masterCharacters={testCharacters} state={state} onChange={onChange} />);

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
    render(<ClanBattleTab masterCharacters={testCharacters} state={state} onChange={vi.fn()} />);

    expect(screen.getByText("編成順（隊列の並び）で自動的に並びます。サポートは最大1人です。")).toBeInTheDocument();
    expect(screen.queryByText("▲▼で並び替えできます。サポートは最大1人です。")).not.toBeInTheDocument();
    expect(screen.queryByText("ドラッグで並び替えできます。サポートは最大1人です。")).not.toBeInTheDocument();
  });
});
