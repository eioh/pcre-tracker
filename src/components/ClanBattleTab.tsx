import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, GripVertical, Maximize2, Plus, Trash2 } from "lucide-react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../domain/levels";
import type {
  CharacterProgress,
  ClanBattleFormation,
  ClanBattleMember,
  ClanBattleState,
  MasterCharacter,
  StoredStateV1,
} from "../domain/types";
import {
  CLAN_BATTLE_MAX_MEMBERS,
  createClanBattleFormation,
  createClanBattleMember,
  createClanBattleMonthGroup,
  formatClanBattleDamage,
  getClanBattleMemberDiffs,
  isCurrentClanBattleMonth,
  toClanBattleDamage,
} from "../domain/clanBattle";
import { isCharacterNameMatched } from "../utils/nameSearch";
import { panelClass } from "./input/uiStyles";
import { formatUeLevel } from "./input/formatters";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type ClanBattleTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
  onChange: (nextClanBattle: ClanBattleState) => void;
};

type SelectedFormation = {
  group: ClanBattleState["groups"][number];
  formation: ClanBattleFormation;
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

// クラバト編成画面の初期年を現在年から作る。
function getDefaultYear(): number {
  return new Date().getFullYear();
}

// クラバト編成画面の初期月を現在月から作る。
function getDefaultMonth(): number {
  return new Date().getMonth() + 1;
}

// クラバト記録で選択できる年の候補を作る。
function buildYearOptions(currentYear: number): number[] {
  return Array.from({ length: currentYear - 2018 + 2 }, (_, index) => 2018 + index);
}

// 年月グループの表示名を「YYYY年M月」形式で返す。
function formatMonthGroupTitle(year: number, month: number): string {
  return `${year}年${month}月`;
}

// 編成リストの選択状態を保存データから復元できるよう、先頭候補を返す。
function findFirstFormation(state: ClanBattleState): SelectedFormation | null {
  for (const group of state.groups) {
    const formation = group.formations[0];
    if (formation) {
      return { group, formation };
    }
  }
  return null;
}

// 選択中IDから現在の年月グループと編成を解決する。
function findSelectedFormation(state: ClanBattleState, selectedFormationId: string | null): SelectedFormation | null {
  if (!selectedFormationId) {
    return findFirstFormation(state);
  }
  for (const group of state.groups) {
    const formation = group.formations.find((item) => item.id === selectedFormationId);
    if (formation) {
      return { group, formation };
    }
  }
  return findFirstFormation(state);
}

// 月グループを新しい順で表示するための並び順を作る。
function sortMonthGroups(groups: ClanBattleState["groups"]): ClanBattleState["groups"] {
  return [...groups].sort((a, b) => b.year - a.year || b.month - a.month);
}

// キャラ名検索の入力値から追加候補を絞り込む。
function filterCharacterCandidates(masterCharacters: MasterCharacter[], query: string): MasterCharacter[] {
  return masterCharacters.filter((character) =>
    isCharacterNameMatched(character.searchTokens && character.searchTokens.length > 0 ? character.searchTokens : character.name, query),
  );
}

// ドラッグ元とドロップ先のIDからメンバー配列を並び替える。
function reorderMembers(members: ClanBattleMember[], sourceId: string, targetId: string): ClanBattleMember[] {
  const sourceIndex = members.findIndex((member) => member.id === sourceId);
  const targetIndex = members.findIndex((member) => member.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return members;
  }
  const nextMembers = [...members];
  const [moved] = nextMembers.splice(sourceIndex, 1);
  if (!moved) {
    return members;
  }
  nextMembers.splice(targetIndex, 0, moved);
  return nextMembers;
}

// 指定メンバーを上下方向へ1つ移動したメンバー配列を返す（モバイルの▲▼ボタン用）。端で動かせない場合は元の配列をそのまま返す。
export function moveMemberByDirection(
  members: ClanBattleMember[],
  memberId: string,
  direction: "up" | "down",
): ClanBattleMember[] {
  const index = members.findIndex((member) => member.id === memberId);
  if (index < 0) {
    return members;
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= members.length) {
    return members;
  }
  const nextMembers = [...members];
  [nextMembers[index], nextMembers[targetIndex]] = [nextMembers[targetIndex]!, nextMembers[index]!];
  return nextMembers;
}

// 専用1の保存値をSelect用の文字列に変換する。
function toUe1SelectValue(member: ClanBattleMember): string {
  return member.ue1SpEquipped ? "sp" : String(member.ue1Level ?? "null");
}

// 専用2の保存値をSelect用の文字列に変換する。
function toUe2SelectValue(member: ClanBattleMember): string {
  return String(member.ue2Level ?? "null");
}

// 差分がある入力欄の右側に表示する警告アイコン。
function FieldDiffIcon({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-chip-master-text" aria-label={`${label}に差分があります`}>
      <AlertTriangle className="size-4" aria-hidden="true" />
    </span>
  );
}

// TLを画面最前面で編集するためのモーダルを表示する。
function TimelineModal({
  formationName,
  value,
  onChange,
  onClose,
}: {
  formationName: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    // TL拡大表示中だけEscキーで閉じられるよう、モーダル側で一時的にキーイベントを購読する。
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true">
      <section className="grid h-[86vh] w-full max-w-[980px] grid-rows-[auto_1fr_auto] gap-3 rounded-[8px] border border-panel-border bg-popover-bg p-5 shadow-panel">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="m-0 text-base font-semibold text-main">TL拡大表示</h3>
            <p className="m-0 text-sm text-muted">{formationName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </header>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-0 w-full resize-none rounded-[8px] border border-white/20 bg-input-bg p-4 font-mono text-sm leading-7 text-main outline-none focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40"
          placeholder="1:30　○×○×○　オートON"
        />
        <p className="m-0 text-xs text-muted">Escキーまたは閉じるボタンで戻れます。入力内容は編成のTLへ反映されます。</p>
      </section>
    </div>
  );
}

// クラバト編成の年月、編成、キャラ、TLを1画面で管理する。
export function ClanBattleTab({ masterCharacters, state, onChange }: ClanBattleTabProps) {
  const [yearInput, setYearInput] = useState(getDefaultYear());
  const [monthInput, setMonthInput] = useState(getDefaultMonth());
  const [formationNameInput, setFormationNameInput] = useState("");
  const [characterSearchText, setCharacterSearchText] = useState("");
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(() => findFirstFormation(state.clanBattle)?.formation.id ?? null);
  const [draggingMemberId, setDraggingMemberId] = useState<string | null>(null);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const sortedGroups = useMemo(() => sortMonthGroups(state.clanBattle.groups), [state.clanBattle.groups]);
  const selected = findSelectedFormation(state.clanBattle, selectedFormationId);
  const selectedGroup = selected?.group ?? null;
  const selectedFormation = selected?.formation ?? null;
  const characterByName = useMemo(() => new Map(masterCharacters.map((character) => [character.name, character])), [masterCharacters]);
  const characterCandidates = useMemo(
    () => filterCharacterCandidates(masterCharacters, characterSearchText).slice(0, 80),
    [characterSearchText, masterCharacters],
  );
  const yearOptions = useMemo(() => buildYearOptions(getDefaultYear()), []);

  // clanBattle全体を受け取る更新関数で、親の保存状態と選択IDを同期する。
  const updateClanBattle = (updater: (previous: ClanBattleState) => ClanBattleState, nextSelectedFormationId?: string | null): void => {
    const nextState = updater(state.clanBattle);
    onChange(nextState);
    if (nextSelectedFormationId !== undefined) {
      setSelectedFormationId(nextSelectedFormationId);
    }
  };

  // 年月グループを追加し、同じ年月が既にある場合は既存グループを使う。
  const handleAddMonthGroup = (): void => {
    const normalizedYear = Math.min(2100, Math.max(2000, Math.floor(yearInput)));
    const normalizedMonth = Math.min(12, Math.max(1, Math.floor(monthInput)));
    updateClanBattle((previous) => {
      if (previous.groups.some((group) => group.year === normalizedYear && group.month === normalizedMonth)) {
        return previous;
      }
      return {
        groups: [...previous.groups, createClanBattleMonthGroup(normalizedYear, normalizedMonth)],
      };
    });
  };

  // 年月グループ削除前に確認し、中の編成ごと削除する。
  const handleDeleteMonthGroup = (groupId: string): void => {
    if (!window.confirm("この年月グループと中の編成を削除しますか？")) {
      return;
    }
    updateClanBattle(
      (previous) => ({
        groups: previous.groups.filter((group) => group.id !== groupId),
      }),
      selectedGroup?.id === groupId ? null : selectedFormationId,
    );
  };

  // 選択中の年月グループへ編成を追加する。
  const handleAddFormation = (groupId: string): void => {
    const formation = createClanBattleFormation(formationNameInput);
    updateClanBattle(
      (previous) => ({
        groups: previous.groups.map((group) =>
          group.id === groupId ? { ...group, formations: [...group.formations, formation] } : group,
        ),
      }),
      formation.id,
    );
    setFormationNameInput("");
  };

  // 編成削除前に確認し、選択中なら次の候補へ選択を移す。
  const handleDeleteFormation = (groupId: string, formationId: string): void => {
    if (!window.confirm("この編成を削除しますか？")) {
      return;
    }
    updateClanBattle(
      (previous) => ({
        groups: previous.groups.map((group) =>
          group.id === groupId
            ? { ...group, formations: group.formations.filter((formation) => formation.id !== formationId) }
            : group,
        ),
      }),
      selectedFormationId === formationId ? null : selectedFormationId,
    );
  };

  // 選択中編成の一部を更新する。
  const updateSelectedFormation = (patch: Partial<ClanBattleFormation>): void => {
    if (!selectedGroup || !selectedFormation) {
      return;
    }
    updateClanBattle((previous) => ({
      groups: previous.groups.map((group) =>
        group.id === selectedGroup.id
          ? {
              ...group,
              formations: group.formations.map((formation) =>
                formation.id === selectedFormation.id ? { ...formation, ...patch } : formation,
              ),
            }
          : group,
      ),
    }));
  };

  // 編成内キャラの一部を更新し、サポートは最大1人に制限する。
  const updateMember = (memberId: string, patch: Partial<ClanBattleMember>): void => {
    if (!selectedFormation) {
      return;
    }
    const nextMembers = selectedFormation.members.map((member) => {
      if (patch.support === true && member.id !== memberId) {
        return { ...member, support: false };
      }
      return member.id === memberId ? { ...member, ...patch } : member;
    });
    updateSelectedFormation({ members: nextMembers });
  };

  // 候補から選んだキャラ名を入力として、育成入力の現在値をコピーして編成へ追加する。
  const handleAddMember = (characterName: string): void => {
    if (!selectedFormation || selectedFormation.members.length >= CLAN_BATTLE_MAX_MEMBERS) {
      return;
    }
    const progress = state.progressByName[characterName];
    if (!progress) {
      return;
    }
    updateSelectedFormation({ members: [...selectedFormation.members, createClanBattleMember(characterName, progress)] });
    setCharacterSearchText("");
  };

  // キャラ削除前に確認し、編成から対象行を外す。
  const handleDeleteMember = (memberId: string): void => {
    if (!selectedFormation || !window.confirm("このキャラを編成から削除しますか？")) {
      return;
    }
    updateSelectedFormation({ members: selectedFormation.members.filter((member) => member.id !== memberId) });
  };

  // ドロップ先のキャラIDへドラッグ中キャラを移動する。
  const handleDropMember = (targetMemberId: string): void => {
    if (!selectedFormation || !draggingMemberId) {
      return;
    }
    updateSelectedFormation({ members: reorderMembers(selectedFormation.members, draggingMemberId, targetMemberId) });
    setDraggingMemberId(null);
  };

  // モバイルの▲▼ボタンで指定メンバーを上下へ1つ移動する。
  const handleMoveMember = (memberId: string, direction: "up" | "down"): void => {
    if (!selectedFormation) {
      return;
    }
    updateSelectedFormation({ members: moveMemberByDirection(selectedFormation.members, memberId, direction) });
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={`${panelClass} grid content-start gap-4`}>
        <div className="grid gap-3">
          <h2 className="m-0 text-sm font-semibold tracking-[0.08em] text-sub">クラバト編成</h2>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="grid gap-1 text-xs text-muted">
              年
              <Select value={String(yearInput)} onValueChange={(value) => setYearInput(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-muted">
              月
              <Select value={String(monthInput)} onValueChange={(value) => setMonthInput(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button size="sm" className="h-10 bg-none bg-accent" onClick={handleAddMonthGroup}>
              <Plus className="size-4" />
              追加
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          {sortedGroups.length === 0 ? <p className="m-0 text-sm text-muted">年月グループを追加してください。</p> : null}
          {sortedGroups.map((group) => (
            <section key={group.id} className="rounded-[8px] border border-white/15 bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-sm font-semibold text-main hover:text-accent"
                  onClick={() => setSelectedFormationId(group.formations[0]?.id ?? null)}
                >
                  {formatMonthGroupTitle(group.year, group.month)}
                </button>
                {/* max-md:min-h-11/min-w-11 はモバイル（768px未満）のみタップ領域を44pxへ広げるスタイル調整（スタイルのみの差は max-md: バリアントを使う規約）。 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger-strong max-md:min-h-11 max-md:min-w-11"
                  aria-label={`${formatMonthGroupTitle(group.year, group.month)}を削除`}
                  onClick={() => handleDeleteMonthGroup(group.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-1.5">
                {group.formations.map((formation) => (
                  <button
                    key={formation.id}
                    type="button"
                    className={`rounded-[8px] border px-3 py-2 text-left text-sm transition ${
                      selectedFormation?.id === formation.id
                        ? "border-accent bg-selected text-main"
                        : "border-white/10 bg-black/20 text-muted hover:border-accent/60 hover:text-main"
                    }`}
                    onClick={() => setSelectedFormationId(formation.id)}
                  >
                    <span className="block truncate font-semibold">{formation.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Input
                  value={formationNameInput}
                  placeholder="編成名"
                  onChange={(event) => setFormationNameInput(event.target.value)}
                />
                <Button size="sm" className="h-10 bg-none bg-accent" onClick={() => handleAddFormation(group.id)}>
                  編成を追加
                </Button>
              </div>
            </section>
          ))}
        </div>
      </aside>

      <section className={`${panelClass} min-w-0`}>
        {!selectedGroup || !selectedFormation ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-[8px] border border-dashed border-white/20 text-sm text-muted">
            年月グループと編成を追加すると詳細を編集できます。
          </div>
        ) : (
          <div className="grid gap-5">
            <header className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-start">
              <label className="grid gap-1.5 text-sm text-muted">
                編成名
                <Input
                  value={selectedFormation.name}
                  onChange={(event) => updateSelectedFormation({ name: event.target.value })}
                />
                <span className="text-xs text-muted opacity-0" aria-hidden="true">
                  -
                </span>
              </label>
              <label className="grid gap-1.5 text-sm text-muted">
                与ダメージ
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={selectedFormation.damage}
                  onChange={(event) => updateSelectedFormation({ damage: toClanBattleDamage(event.target.value) })}
                />
                <span className="text-xs text-muted">{formatClanBattleDamage(selectedFormation.damage)}</span>
              </label>
              <Button
                variant="outline"
                size="sm"
                className="h-10 border-danger/60 bg-danger-bg/40 text-danger hover:border-danger-strong hover:text-danger-strong lg:self-end lg:mb-[22px]"
                onClick={() => handleDeleteFormation(selectedGroup.id, selectedFormation.id)}
              >
                <Trash2 className="size-4" />
                編成削除
              </Button>
            </header>

            <section className="grid gap-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="m-0 text-sm font-semibold text-sub">編成キャラ</h3>
                  <p className="m-0 mt-1 text-xs text-muted">
                    {/* モバイルはD&Dが使えないため▲▼ボタンを案内し、デスクトップは従来のドラッグ案内を表示する（md:hidden / max-md:hidden で出し分け）。 */}
                    <span className="md:hidden">▲▼で並び替えできます。サポートは最大1人です。</span>
                    <span className="max-md:hidden">ドラッグで並び替えできます。サポートは最大1人です。</span>
                  </p>
                </div>
                <div className="grid gap-2 sm:min-w-[320px]">
                  <div className="relative">
                    <Input
                      value={characterSearchText}
                      placeholder="キャラ検索"
                      onChange={(event) => {
                        setCharacterSearchText(event.target.value);
                      }}
                    />
                    {characterSearchText.trim() ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-20 max-h-56 overflow-auto rounded-[8px] border border-white/20 bg-popover-bg p-1 shadow-panel">
                        {characterCandidates.length === 0 ? (
                          <p className="m-0 px-3 py-2 text-sm text-muted">候補がありません</p>
                        ) : (
                          characterCandidates.map((character) => (
                            <button
                              key={character.name}
                              type="button"
                              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-muted transition hover:bg-white/10 hover:text-main"
                              onClick={() => {
                                handleAddMember(character.name);
                              }}
                            >
                              <span className="truncate font-semibold">{character.name}</span>
                              <span className="ml-2 shrink-0 text-xs text-muted">{character.limited ? "限定" : "恒常"}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                {selectedFormation.members.length === 0 ? (
                  <p className="rounded-[8px] border border-dashed border-white/20 p-4 text-center text-sm text-muted">
                    キャラを追加してください。
                  </p>
                ) : null}
                {selectedFormation.members.map((member, memberIndex) => {
                  const character = characterByName.get(member.characterName);
                  const isCurrentMonth = isCurrentClanBattleMonth(selectedGroup);
                  const diffs = isCurrentMonth ? getClanBattleMemberDiffs(member, state.progressByName[member.characterName]) : [];
                  const hasDiff = diffs.length > 0;
                  // max-md:grid-cols-2 はモバイル（768px未満）のみSelect5個を2列に配置して縦の冗長さを抑えるスタイル調整（スタイルのみの差は max-md: バリアント、構造分岐は useIsMobile を使う規約）。
                  return (
                    <article
                      key={member.id}
                      draggable
                      onDragStart={() => setDraggingMemberId(member.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDropMember(member.id)}
                      className={`grid gap-3 rounded-[8px] border p-3 transition max-md:grid-cols-2 lg:grid-cols-[minmax(160px,1.2fr)_repeat(5,minmax(88px,1fr))_auto] lg:items-center ${
                        hasDiff ? "border-accent/70 bg-black/20" : "border-white/15 bg-black/20"
                      }`}
                    >
                      {/* 名前ブロックはモバイルでは2列分を使い、キャラ名の折返しを防ぐ。 */}
                      <div className="flex min-w-0 items-center gap-2 max-md:col-span-2">
                        {/* ドラッグ操作はモバイルでは使えないため、つまみアイコンはモバイルで非表示にする。 */}
                        <GripVertical className="size-4 shrink-0 cursor-grab text-muted max-md:hidden" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="m-0 truncate text-sm font-semibold">{member.characterName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
                              <Checkbox checked={member.support} onCheckedChange={(checked) => updateMember(member.id, { support: checked === true })} />
                              サポート
                            </label>
                          </div>
                        </div>
                        {/* モバイル用の並び替え▲▼ボタン（min-h-11/min-w-11 で44pxのタップ領域を確保）。デスクトップはD&Dで並び替えるため md 以上では非表示。 */}
                        <div className="ml-auto flex shrink-0 items-center md:hidden">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-11 min-w-11"
                            disabled={memberIndex === 0}
                            aria-label={`${member.characterName}を上に移動`}
                            onClick={() => handleMoveMember(member.id, "up")}
                          >
                            <ChevronUp className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-11 min-w-11"
                            disabled={memberIndex === selectedFormation.members.length - 1}
                            aria-label={`${member.characterName}を下に移動`}
                            onClick={() => handleMoveMember(member.id, "down")}
                          >
                            <ChevronDown className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      <label className="grid gap-1 text-xs text-muted">
                        限界突破
                        <span
                          className={`relative inline-flex h-10 items-center gap-2 rounded-[8px] border bg-input-bg px-3 ${
                            hasDiff && diffs.includes("限界突破") ? "border-accent pr-9" : "border-white/20"
                          }`}
                        >
                          <Checkbox checked={member.limitBreak} onCheckedChange={(checked) => updateMember(member.id, { limitBreak: checked === true })} />
                          <span>{member.limitBreak ? "済" : "未"}</span>
                          {hasDiff && diffs.includes("限界突破") ? <FieldDiffIcon label="限界突破" /> : null}
                        </span>
                      </label>

                      <label className="grid gap-1 text-xs text-muted">
                        ☆
                        <Select value={String(member.star)} onValueChange={(value) => updateMember(member.id, { star: Number(value) as CharacterProgress["star"] })}>
                          <div className="relative">
                            <SelectTrigger className={hasDiff && diffs.includes("☆") ? "border-accent" : undefined}>
                              <SelectValue />
                            </SelectTrigger>
                            {hasDiff && diffs.includes("☆") ? <FieldDiffIcon label="☆" /> : null}
                          </div>
                          <SelectContent>
                            {Array.from({ length: character?.implemented.star6 ? 6 : 5 }, (_, index) => index + 1).map((star) => (
                              <SelectItem key={star} value={String(star)}>
                                {star}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs text-muted">
                        コネクトRANK
                        <Select
                          value={String(member.connectRank)}
                          onValueChange={(value) => updateMember(member.id, { connectRank: Number(value) as CharacterProgress["connectRank"] })}
                        >
                          <div className="relative">
                            <SelectTrigger className={hasDiff && diffs.includes("コネクトRANK") ? "border-accent" : undefined}>
                              <SelectValue />
                            </SelectTrigger>
                            {hasDiff && diffs.includes("コネクトRANK") ? <FieldDiffIcon label="コネクトRANK" /> : null}
                          </div>
                          <SelectContent>
                            <SelectItem value="0">未開放</SelectItem>
                            {Array.from({ length: 15 }, (_, index) => index + 1).map((rank) => (
                              <SelectItem key={rank} value={String(rank)}>
                                {rank}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs text-muted">
                        専用1
                        <Select
                          value={toUe1SelectValue(member)}
                          disabled={!character?.implemented.ue1}
                          onValueChange={(value) =>
                            updateMember(member.id, {
                              ue1Level: value === "sp" ? 370 : (Number(value) as CharacterProgress["ue1Level"]),
                              ue1SpEquipped: value === "sp",
                            })
                          }
                        >
                          <div className="relative">
                            <SelectTrigger className={hasDiff && diffs.includes("専用1") ? "border-accent" : undefined}>
                              <SelectValue />
                            </SelectTrigger>
                            {hasDiff && diffs.includes("専用1") ? <FieldDiffIcon label="専用1" /> : null}
                          </div>
                          <SelectContent>
                            {UE1_LEVEL_VALUES.map((level) => (
                              <SelectItem key={level} value={String(level)}>
                                {formatUeLevel(level)}
                              </SelectItem>
                            ))}
                            {character?.implemented.ue1Sp ? <SelectItem value="sp">SP</SelectItem> : null}
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs text-muted">
                        専用2
                        <Select
                          value={toUe2SelectValue(member)}
                          disabled={!character?.implemented.ue2}
                          onValueChange={(value) => updateMember(member.id, { ue2Level: Number(value) as CharacterProgress["ue2Level"] })}
                        >
                          <div className="relative">
                            <SelectTrigger className={hasDiff && diffs.includes("専用2") ? "border-accent" : undefined}>
                              <SelectValue />
                            </SelectTrigger>
                            {hasDiff && diffs.includes("専用2") ? <FieldDiffIcon label="専用2" /> : null}
                          </div>
                          <SelectContent>
                            {UE2_LEVEL_VALUES.map((level) => (
                              <SelectItem key={level} value={String(level)}>
                                {formatUeLevel(level)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>

                      {/* 削除ボタンはモバイルでは2列分の幅を使い、min-h-11/min-w-11 でタップ領域を44pxへ広げる。 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:text-danger-strong max-md:col-span-2 max-md:min-h-11 max-md:min-w-11"
                        aria-label={`${member.characterName}を削除`}
                        onClick={() => handleDeleteMember(member.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="grid min-h-[360px] gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>TL</Label>
                <Button variant="outline" size="sm" onClick={() => setIsTimelineModalOpen(true)}>
                  <Maximize2 className="size-4" />
                  拡大表示
                </Button>
              </div>
              <textarea
                value={selectedFormation.timeline}
                onChange={(event) => updateSelectedFormation({ timeline: event.target.value })}
                className="min-h-[320px] w-full resize-y rounded-[8px] border border-white/20 bg-input-bg p-4 font-mono text-sm leading-7 text-main outline-none focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40"
                placeholder="1:30　○×○×○　オートON"
              />
            </section>
          </div>
        )}
      </section>

      {isTimelineModalOpen && selectedFormation ? (
        <TimelineModal
          formationName={selectedFormation.name}
          value={selectedFormation.timeline}
          onChange={(timeline) => updateSelectedFormation({ timeline })}
          onClose={() => setIsTimelineModalOpen(false)}
        />
      ) : null}
    </section>
  );
}
