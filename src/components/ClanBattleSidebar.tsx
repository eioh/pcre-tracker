import { useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ClanBattleFormation, ClanBattleMonthGroup } from "../domain/types";
import { panelClass } from "./input/uiStyles";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type ClanBattleSidebarProps = {
  groups: ClanBattleMonthGroup[];
  selectedFormationId: string | null;
  onSelectFormation: (formationId: string | null) => void;
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

// クラバト編成タブの左サイドバー。年月グループと編成の一覧・追加・削除・並び替えを担当する。
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
  const [yearInput, setYearInput] = useState(getDefaultYear());
  const [monthInput, setMonthInput] = useState(getDefaultMonth());
  const [formationNameInput, setFormationNameInput] = useState("");
  const sortedGroups = useMemo(() => sortMonthGroups(groups), [groups]);
  const yearOptions = useMemo(() => buildYearOptions(getDefaultYear()), []);
  // 編成の並び替えは250ms長押しで起動する（PC・タッチとも統一）。PointerSensorはtouchmoveを止められずスクロールに奪われうるため、
  // touch-manipulationと両立するMouseSensor + TouchSensorの併用とする。
  const formationDragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  // 入力中の年月を許容範囲へ丸めてから追加を依頼する。
  const handleAddMonthGroup = (): void => {
    const normalizedYear = Math.min(2100, Math.max(2000, Math.floor(yearInput)));
    const normalizedMonth = Math.min(12, Math.max(1, Math.floor(monthInput)));
    onAddMonthGroup(normalizedYear, normalizedMonth);
  };

  // 入力中の編成名で編成を追加し、入力欄を空に戻す。
  const handleAddFormation = (groupId: string): void => {
    onAddFormation(groupId, formationNameInput);
    setFormationNameInput("");
  };

  // ドラッグ終了時に同一グループ内の並び替えを依頼する。
  const handleDragEnd = (groupId: string, event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over) {
      return;
    }
    onReorderFormations(groupId, String(active.id), String(over.id));
  };

  return (
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

      <div className="min-w-0 grid gap-3">
        {sortedGroups.length === 0 ? <p className="m-0 text-sm text-muted">年月グループを追加してください。</p> : null}
        {sortedGroups.map((group) => (
          <section key={group.id} className="min-w-0 rounded-[8px] border border-white/15 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-left text-sm font-semibold text-main hover:text-accent"
                onClick={() => onSelectFormation(group.formations[0]?.id ?? null)}
              >
                {formatMonthGroupTitle(group.year, group.month)}
              </button>
              {/* max-md:min-h-11/min-w-11 はモバイル（768px未満）のみタップ領域を44pxへ広げるスタイル調整（スタイルのみの差は max-md: バリアントを使う規約）。 */}
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger-strong max-md:min-h-11 max-md:min-w-11"
                aria-label={`${formatMonthGroupTitle(group.year, group.month)}を削除`}
                onClick={() => onDeleteMonthGroup(group.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {/* 月グループごとにDndContextを独立させ、グループをまたぐ並び替えを構造的に不可能にする。 */}
            <DndContext
              sensors={formationDragSensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(group.id, event)}
            >
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
  );
}
