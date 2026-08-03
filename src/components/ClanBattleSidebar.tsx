import { useEffect, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ClanBattleFormation, ClanBattleMonthGroup } from "../domain/types";
import { panelClass } from "./input/uiStyles";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type ClanBattleSidebarProps = {
  groups: ClanBattleMonthGroup[];
  selectedFormationId: string | null;
  onSelectFormation: (formationId: string) => void;
  onAddMonthGroup: (year: number, month: number) => void;
  onDeleteMonthGroup: (groupId: string) => void;
  onAddFormation: (groupId: string, name: string) => void;
  onCopyFormation: (groupId: string, formationId: string) => void;
  onReorderFormations: (groupId: string, activeId: string, overId: string) => void;
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

// 月グループを新しい順で表示するための並び順を作る。
function sortMonthGroups(groups: ClanBattleMonthGroup[]): ClanBattleMonthGroup[] {
  return [...groups].sort((a, b) => b.year - a.year || b.month - a.month);
}

// 指定編成を含む月グループのIDを返す。
function findGroupIdByFormationId(groups: ClanBattleMonthGroup[], formationId: string | null): string | null {
  if (!formationId) {
    return null;
  }
  return groups.find((group) => group.formations.some((formation) => formation.id === formationId))?.id ?? null;
}

// ドラッグ可能な編成行。長押し起動のセンサーと組み合わせ、行全体をドラッグ対象にしつつ選択ボタン・コピーボタンのクリックは従来どおり動かす。
function SortableFormationRow({
  formation,
  isSelected,
  onSelect,
  onCopy,
}: {
  formation: ClanBattleFormation;
  isSelected: boolean;
  onSelect: () => void;
  onCopy: () => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: formation.id });

  return (
    // dnd-kitのattributes（role="button"/tabIndex/aria-roledescription等）は展開しない。キーボード並び替えはスコープ外でKeyboardSensor未登録のため、
    // attributesを付けると子の選択・コピーボタンがARIAのPresentational Children規則で読み上げ不能になり、かつ動作しないEnter/Spaceの案内だけが残る。
    // マウス・タッチのドラッグはlistenersのみで完結する。
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
      className={`group flex min-w-0 touch-manipulation select-none items-center rounded-[8px] border transition ${
        isDragging ? "z-10 opacity-60" : ""
      } ${
        isSelected
          ? "border-accent bg-selected text-main"
          : "border-white/10 bg-black/20 text-muted hover:border-accent/60 hover:text-main"
      }`}
    >
      <button type="button" className="min-w-0 flex-1 px-3 py-2 text-left text-sm" onClick={onSelect}>
        <span className="block truncate font-semibold">{formation.name}</span>
      </button>
      {/* ホバー時のみ表示（タッチ端末は常時表示）。Tailwind v4ではgroup-hover自体が@media(hover:hover)でラップされるため、
          非表示化のみ明示的に[@media(hover:hover)]:opacity-0で指定する。フォーカス時も表示してキーボード操作に対応する。 */}
      <Button
        variant="ghost"
        size="sm"
        className="mr-1 shrink-0 max-md:min-h-11 max-md:min-w-11 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`${formation.name}をコピー`}
        onClick={onCopy}
      >
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

// 月フォルダ末尾に出す編成名のインライン入力欄。Enterで確定、Escape・blurでキャンセルする。
function InlineFormationInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <Input
      autoFocus
      value={value}
      aria-label="編成名"
      placeholder="編成名"
      className="h-9"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onBlur={onCancel}
    />
  );
}

// サイドバー上部の「＋月を追加」ポップオーバー。年月の選択状態はポップオーバー内に閉じる。
function AddMonthPopover({ onAddMonthGroup }: { onAddMonthGroup: (year: number, month: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [yearInput, setYearInput] = useState(getDefaultYear);
  const [monthInput, setMonthInput] = useState(getDefaultMonth);
  const yearOptions = useMemo(() => buildYearOptions(getDefaultYear()), []);

  // 入力中の年月を許容範囲へ丸めて追加を依頼し、ポップオーバーを閉じる。
  const handleAdd = (): void => {
    const normalizedYear = Math.min(2100, Math.max(2000, Math.floor(yearInput)));
    const normalizedMonth = Math.min(12, Math.max(1, Math.floor(monthInput)));
    onAddMonthGroup(normalizedYear, normalizedMonth);
    setIsOpen(false);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm" className="h-9 shrink-0 max-md:min-h-11">
          <Plus className="size-4" aria-hidden="true" />
          月を追加
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 grid w-56 gap-2 rounded-[12px] border border-white/20 bg-popover-bg p-3 shadow-panel"
        >
          <div className="grid grid-cols-2 gap-2">
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
          </div>
          <Button size="sm" className="h-9 bg-none bg-accent" onClick={handleAdd}>
            追加
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ツリーの月フォルダ1つ分。見出しの折りたたみ操作と、展開時の編成リストを描画する。
function MonthFolder({
  group,
  isCollapsed,
  hasSelectedFormation,
  selectedFormationId,
  isAddingFormation,
  addingName,
  dragSensors,
  onToggleCollapsed,
  onSelectFormation,
  onStartAddFormation,
  onChangeAddingName,
  onCommitAddFormation,
  onCancelAddFormation,
  onCopyFormation,
  onDeleteMonthGroup,
  onReorderFormations,
}: {
  group: ClanBattleMonthGroup;
  isCollapsed: boolean;
  hasSelectedFormation: boolean;
  selectedFormationId: string | null;
  isAddingFormation: boolean;
  addingName: string;
  dragSensors: ReturnType<typeof useSensors>;
  onToggleCollapsed: (groupId: string) => void;
  onSelectFormation: (formationId: string) => void;
  onStartAddFormation: (groupId: string) => void;
  onChangeAddingName: (value: string) => void;
  onCommitAddFormation: (groupId: string) => void;
  onCancelAddFormation: () => void;
  onCopyFormation: (groupId: string, formationId: string) => void;
  onDeleteMonthGroup: (groupId: string) => void;
  onReorderFormations: (groupId: string, activeId: string, overId: string) => void;
}) {
  const title = formatMonthGroupTitle(group.year, group.month);
  const bodyId = `clan-battle-month-${group.id}`;

  // ドラッグ終了時に同一グループ内の並び替えを依頼する。
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over) {
      return;
    }
    onReorderFormations(group.id, String(active.id), String(over.id));
  };

  return (
    <section className="min-w-0">
      <div className="group flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          // 畳んだ月に選択中編成がある場合は見出しを選択色にして、選択が迷子に見えないようにする。
          className={`inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-[8px] px-1.5 py-1.5 text-left text-sm font-semibold transition max-md:min-h-11 ${
            isCollapsed && hasSelectedFormation ? "bg-selected text-main" : "text-main hover:text-accent"
          }`}
          onClick={() => onToggleCollapsed(group.id)}
        >
          <ChevronDown className={`size-4 shrink-0 transition-transform ${isCollapsed ? "" : "rotate-180"}`} aria-hidden="true" />
          <span className="truncate">{title}</span>
          {isCollapsed ? <Badge variant="muted">{group.formations.length}</Badge> : null}
        </button>
        {/* ホバー時のみ表示（タッチ端末は常時表示）。max-md:min-h-11/min-w-11 はモバイル（768px未満）のみタップ領域を44pxへ広げるスタイル調整。 */}
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 max-md:min-h-11 max-md:min-w-11 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`${title}に編成を追加`}
          onClick={() => onStartAddFormation(group.id)}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-danger hover:text-danger-strong max-md:min-h-11 max-md:min-w-11 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`${title}を削除`}
          onClick={() => onDeleteMonthGroup(group.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* 折りたたみ時は本文を描画しない（max-hトランジションで隠すだけだと、隠れたsortable/droppableがdnd-kitの測定対象に残り誤ドロップの温床になるため）。 */}
      {isCollapsed ? null : (
        <div id={bodyId} className="mt-1 grid gap-1.5 pl-4">
          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={group.formations.map((formation) => formation.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-1.5">
                {group.formations.map((formation) => (
                  <SortableFormationRow
                    key={formation.id}
                    formation={formation}
                    isSelected={selectedFormationId === formation.id}
                    onSelect={() => onSelectFormation(formation.id)}
                    onCopy={() => onCopyFormation(group.id, formation.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {isAddingFormation ? (
            <InlineFormationInput
              value={addingName}
              onChange={onChangeAddingName}
              onCommit={() => onCommitAddFormation(group.id)}
              onCancel={onCancelAddFormation}
            />
          ) : null}
          {group.formations.length === 0 && !isAddingFormation ? (
            <p className="m-0 px-1.5 py-1 text-xs text-muted">編成がありません。</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

// クラバト編成タブの左サイドバー。月フォルダのツリーとして年月グループと編成の一覧・追加・削除・並び替えを担当する。
export function ClanBattleSidebar({
  groups,
  selectedFormationId,
  onSelectFormation,
  onAddMonthGroup,
  onDeleteMonthGroup,
  onAddFormation,
  onCopyFormation,
  onReorderFormations,
}: ClanBattleSidebarProps) {
  const sortedGroups = useMemo(() => sortMonthGroups(groups), [groups]);
  const selectedGroupId = useMemo(() => findGroupIdByFormationId(groups, selectedFormationId), [groups, selectedFormationId]);
  // 折りたたみ側を記録する（新規追加した月は自動的に展開状態になる）。初期値は選択中編成を含む月以外すべて折りたたみ。
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set(groups.filter((group) => group.id !== selectedGroupId).map((group) => group.id)),
  );
  const [addingInGroupId, setAddingInGroupId] = useState<string | null>(null);
  const [addingName, setAddingName] = useState("");
  // 編成の並び替えは250ms長押しで起動する（PC・タッチとも統一）。PointerSensorはtouchmoveを止められずスクロールに奪われうるため、
  // touch-manipulationと両立するMouseSensor + TouchSensorの併用とする。
  const formationDragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  // 選択中編成を含む月を自動展開する（VS Codeのファイルツリーと同じreveal方式）。
  // 依存を選択月IDのみにして、選択が変わらない限り手動で畳んだ状態を勝手に開き直さない。
  useEffect(() => {
    if (!selectedGroupId) {
      return;
    }
    setCollapsedGroupIds((previous) => {
      if (!previous.has(selectedGroupId)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(selectedGroupId);
      return next;
    });
  }, [selectedGroupId]);

  // 月フォルダの開閉を切り替える。
  const handleToggleCollapsed = (groupId: string): void => {
    setCollapsedGroupIds((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // ＋押下で対象月を強制展開し、その月の末尾にインライン入力欄を出す。
  const handleStartAddFormation = (groupId: string): void => {
    setCollapsedGroupIds((previous) => {
      if (!previous.has(groupId)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(groupId);
      return next;
    });
    setAddingName("");
    setAddingInGroupId(groupId);
  };

  // インライン入力の内容で編成を追加し、入力欄を閉じる。
  const handleCommitAddFormation = (groupId: string): void => {
    onAddFormation(groupId, addingName);
    setAddingName("");
    setAddingInGroupId(null);
  };

  // インライン入力を破棄して閉じる。
  const handleCancelAddFormation = (): void => {
    setAddingName("");
    setAddingInGroupId(null);
  };

  return (
    <aside className={`${panelClass} grid content-start gap-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold tracking-[0.08em] text-sub">クラバト編成</h2>
        <AddMonthPopover onAddMonthGroup={onAddMonthGroup} />
      </div>

      <div className="min-w-0 grid gap-1.5">
        {sortedGroups.length === 0 ? <p className="m-0 text-sm text-muted">年月グループを追加してください。</p> : null}
        {sortedGroups.map((group) => (
          <MonthFolder
            key={group.id}
            group={group}
            isCollapsed={collapsedGroupIds.has(group.id)}
            hasSelectedFormation={selectedGroupId === group.id}
            selectedFormationId={selectedFormationId}
            isAddingFormation={addingInGroupId === group.id}
            addingName={addingName}
            dragSensors={formationDragSensors}
            onToggleCollapsed={handleToggleCollapsed}
            onSelectFormation={onSelectFormation}
            onStartAddFormation={handleStartAddFormation}
            onChangeAddingName={setAddingName}
            onCommitAddFormation={handleCommitAddFormation}
            onCancelAddFormation={handleCancelAddFormation}
            onCopyFormation={onCopyFormation}
            onDeleteMonthGroup={onDeleteMonthGroup}
            onReorderFormations={onReorderFormations}
          />
        ))}
      </div>
    </aside>
  );
}
