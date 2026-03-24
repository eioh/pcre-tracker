import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { masterByName } from "../domain/master";
import {
  buildDefaultConnectRankCalcState,
  loadConnectRankCalcState,
  saveConnectRankCalcState,
  type ConnectRankCalcEntry,
  type ConnectRankCalcStateV1,
} from "../domain/connectRankCalcStorage";
import type { CharacterProgress, MasterCharacter, StoredStateV1 } from "../domain/types";
import {
  createEmptyCost,
  getConnectRankRangeMaterialCost,
  sumConnectRankMaterialCost,
  type ConnectRankMaterialCost,
} from "../utils/connectRankMaterialCost";
import { isCharacterNameMatched } from "../utils/nameSearch";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./ui/table";
import { Trash2, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";

const CONNECT_RANK_MAX = 15;

type Props = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
  resetToken: number;
};

// コネクトランク計算タブのメインコンポーネント。
export function ConnectRankCalcTab({ masterCharacters, state, resetToken }: Props) {
  const [calcState, setCalcState] = useState<ConnectRankCalcStateV1>(() => loadConnectRankCalcState());

  // resetTokenの変更で状態を初期化する。
  useEffect(() => {
    if (resetToken === 0) return;
    setCalcState(buildDefaultConnectRankCalcState());
  }, [resetToken]);

  // calcState変更時にlocalStorageへ永続化する。
  useEffect(() => {
    saveConnectRankCalcState(calcState);
  }, [calcState]);

  // 追加済みキャラ名のセット。
  const addedNames = useMemo(() => new Set(calcState.entries.map((e) => e.characterName)), [calcState.entries]);

  // 追加可能なキャラ一覧。
  const availableCharacters = useMemo(() => {
    return masterCharacters.filter((mc) => {
      if (addedNames.has(mc.name)) return false;
      const progress = state.progressByName[mc.name];
      if (progress && progress.connectRank >= CONNECT_RANK_MAX) return false;
      return true;
    });
  }, [masterCharacters, state.progressByName, addedNames]);

  // キャラを追加する。
  const handleAddCharacter = useCallback(
    (name: string) => {
      const progress = state.progressByName[name];
      const currentRank = progress?.connectRank ?? 0;
      if (currentRank >= CONNECT_RANK_MAX) return;

      setCalcState((prev) => ({
        ...prev,
        entries: [...prev.entries, { characterName: name, targetRank: CONNECT_RANK_MAX }],
      }));
    },
    [state.progressByName],
  );

  // キャラを削除する。
  const handleRemove = useCallback((name: string) => {
    setCalcState((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.characterName !== name),
    }));
  }, []);

  // 行を指定方向に1つ移動する。
  const handleMove = useCallback((name: string, direction: "up" | "down") => {
    setCalcState((prev) => {
      const index = prev.entries.findIndex((e) => e.characterName === name);
      if (index < 0) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.entries.length) return prev;
      const next = [...prev.entries];
      [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
      return { ...prev, entries: next };
    });
  }, []);

  // 目標ランクを変更する。
  const handleTargetRankChange = useCallback((name: string, targetRank: number) => {
    setCalcState((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => (e.characterName === name ? { ...e, targetRank } : e)),
    }));
  }, []);

  // 各行の素材コストを計算する。
  const rowCosts = useMemo(() => {
    const costs: Record<string, ConnectRankMaterialCost> = {};
    for (const entry of calcState.entries) {
      const mc = masterByName.get(entry.characterName);
      const progress = state.progressByName[entry.characterName];
      if (!mc || !progress) {
        costs[entry.characterName] = createEmptyCost();
        continue;
      }
      costs[entry.characterName] = getConnectRankRangeMaterialCost(
        mc.role,
        progress.connectRank,
        entry.targetRank as CharacterProgress["connectRank"],
      );
    }
    return costs;
  }, [calcState.entries, state.progressByName]);

  // 集計行の合計を計算する。
  const totalCost = useMemo(() => {
    let total = createEmptyCost();
    for (const cost of Object.values(rowCosts)) {
      total = sumConnectRankMaterialCost(total, cost);
    }
    return total;
  }, [rowCosts]);

  return (
    <section className="rounded-[20px] border border-white/30 bg-linear-to-br from-section-from to-section-to p-6">
      {/* キャラ追加エリア */}
      <CharacterCombobox candidates={availableCharacters} onSelect={handleAddCharacter} resetToken={resetToken} />

      {/* テーブル or 空状態 */}
      {calcState.entries.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <p className="text-sm text-muted">キャラクターを追加して素材を計算できます</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">キャラ名</TableHead>
                <TableHead className="text-center">現在ランク</TableHead>
                <TableHead className="text-center">目標ランク</TableHead>
                <TableHead className="text-right">アーツ</TableHead>
                <TableHead className="text-right">ソウル</TableHead>
                <TableHead className="text-right">ガード</TableHead>
                <TableHead className="text-right">ブロンズ</TableHead>
                <TableHead className="text-right">シルバー</TableHead>
                <TableHead className="text-right">ゴールド</TableHead>
                <TableHead className="w-[70px]" />
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {calcState.entries.map((entry, index) => (
                <CalcRow
                  key={entry.characterName}
                  entry={entry}
                  index={index}
                  entryCount={calcState.entries.length}
                  progress={state.progressByName[entry.characterName]}
                  cost={rowCosts[entry.characterName] ?? createEmptyCost()}
                  onTargetRankChange={handleTargetRankChange}
                  onMove={handleMove}
                  onRemove={handleRemove}
                />
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">集計</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-semibold">{totalCost.arts}</TableCell>
                <TableCell className="text-right font-semibold">{totalCost.soul}</TableCell>
                <TableCell className="text-right font-semibold">{totalCost.guard}</TableCell>
                <TableCell className="text-right font-semibold">{totalCost.bronzeRegalia}</TableCell>
                <TableCell className="text-right font-semibold">{totalCost.silverRegalia}</TableCell>
                <TableCell className="text-right font-semibold">{totalCost.goldRegalia}</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </section>
  );
}

const MAX_SUGGESTIONS = 20;

// キャラ名をテキスト入力で検索・選択するコンボボックス。
function CharacterCombobox({
  candidates,
  onSelect,
  resetToken,
}: {
  candidates: MasterCharacter[];
  onSelect: (name: string) => void;
  resetToken: number;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // resetTokenの変更で入力をクリアする。
  useEffect(() => {
    if (resetToken === 0) return;
    setQuery("");
    setIsOpen(false);
  }, [resetToken]);

  // 入力テキストで候補をフィルタリングする。
  const suggestions = useMemo(() => {
    if (!query.trim()) return candidates.slice(0, MAX_SUGGESTIONS);
    return candidates
      .filter((mc) => isCharacterNameMatched(mc.searchTokens ?? mc.name, query))
      .slice(0, MAX_SUGGESTIONS);
  }, [candidates, query]);

  // コンテナ外クリックで候補リストを閉じる。
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ハイライト中の候補をスクロールで見える位置に維持する。
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  // 候補を選択して入力をクリアする。
  const selectItem = useCallback(
    (name: string) => {
      onSelect(name);
      setQuery("");
      setIsOpen(false);
      setHighlightIndex(-1);
      inputRef.current?.focus();
    },
    [onSelect],
  );

  // キーボード操作を処理する。
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen && event.key !== "Escape") {
        if (event.key === "ArrowDown" || event.key === "Enter") {
          setIsOpen(true);
          setHighlightIndex(0);
          event.preventDefault();
          return;
        }
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          event.preventDefault();
          setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case "Enter":
          event.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
            selectItem(suggestions[highlightIndex]!.name);
          } else if (suggestions.length === 1) {
            selectItem(suggestions[0]!.name);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightIndex(-1);
          break;
      }
    },
    [isOpen, highlightIndex, suggestions, selectItem],
  );

  return (
    <div ref={containerRef} className="relative mb-5 w-[320px]">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="キャラ名を入力して検索"
            className="h-10 w-full rounded-[12px] border border-white/20 bg-input-bg px-3 py-2 text-sm text-main outline-none transition placeholder:text-muted focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="character-suggestions"
          />
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id="character-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 max-h-[240px] w-full overflow-y-auto rounded-[12px] border border-white/20 bg-popover-bg p-1 shadow-panel"
        >
          {suggestions.map((mc, index) => (
            <li
              key={mc.name}
              role="option"
              aria-selected={index === highlightIndex}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-sm text-main",
                index === highlightIndex ? "bg-selected" : "hover:bg-white/10",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                selectItem(mc.name);
              }}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              {mc.name}
            </li>
          ))}
        </ul>
      )}

      {isOpen && query.trim() && suggestions.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-[12px] border border-white/20 bg-popover-bg p-3 shadow-panel">
          <p className="text-sm text-muted">該当するキャラクターが見つかりません</p>
        </div>
      )}
    </div>
  );
}

// 計算テーブルの各行を描画する。
function CalcRow({
  entry,
  index,
  entryCount,
  progress,
  cost,
  onTargetRankChange,
  onMove,
  onRemove,
}: {
  entry: ConnectRankCalcEntry;
  index: number;
  entryCount: number;
  progress: CharacterProgress | undefined;
  cost: ConnectRankMaterialCost;
  onTargetRankChange: (name: string, targetRank: number) => void;
  onMove: (name: string, direction: "up" | "down") => void;
  onRemove: (name: string) => void;
}) {
  const currentRank = progress?.connectRank ?? 0;
  const isOverTarget = currentRank >= entry.targetRank;

  // 目標ランクの選択肢を生成する。
  const targetRankOptions = useMemo(() => {
    const options: number[] = [];
    for (let rank = currentRank + 1; rank <= CONNECT_RANK_MAX; rank++) {
      options.push(rank);
    }
    return options;
  }, [currentRank]);

  return (
    <TableRow>
      <TableCell className="text-left">
        <div className="flex items-center gap-1.5">
          {entry.characterName}
          {isOverTarget && <AlertTriangle className="size-4 text-yellow-400" aria-label="現在ランクが目標以上です" />}
        </div>
      </TableCell>
      <TableCell className="text-center">{currentRank}</TableCell>
      <TableCell className="text-center">
        {currentRank >= CONNECT_RANK_MAX ? (
          <span className="text-muted">{CONNECT_RANK_MAX}</span>
        ) : (
          <Select
            value={String(entry.targetRank)}
            onValueChange={(value) => onTargetRankChange(entry.characterName, Number(value))}
          >
            <SelectTrigger className="mx-auto w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targetRankOptions.map((rank) => (
                <SelectItem key={rank} value={String(rank)}>
                  {rank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-right">{cost.arts}</TableCell>
      <TableCell className="text-right">{cost.soul}</TableCell>
      <TableCell className="text-right">{cost.guard}</TableCell>
      <TableCell className="text-right">{cost.bronzeRegalia}</TableCell>
      <TableCell className="text-right">{cost.silverRegalia}</TableCell>
      <TableCell className="text-right">{cost.goldRegalia}</TableCell>
      <TableCell>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={index === 0}
            onClick={() => onMove(entry.characterName, "up")}
            aria-label={`${entry.characterName}を上に移動`}
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={index === entryCount - 1}
            onClick={() => onMove(entry.characterName, "down")}
            aria-label={`${entry.characterName}を下に移動`}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={() => onRemove(entry.characterName)} aria-label={`${entry.characterName}を削除`}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
