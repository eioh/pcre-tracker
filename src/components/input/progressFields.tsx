import * as Popover from "@radix-ui/react-popover";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../../domain/levels";
import { toGachaPullCount, toPurePieceCount } from "../../domain/storage";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import { formatObtainedDate, formatUeLevel } from "./formatters";
import type { ProgressPatch } from "./types";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { SelectItem } from "../ui/select";
import { TableNumberInput } from "../ui/table-number-input";
import { TableSelect } from "../ui/table-select";
import { useClampedNumberInput } from "./useClampedNumberInput";

// 進捗更新コールバックの共通型。App 側の handleUpdateProgress をそのまま受け取る。
type UpdateProgressHandler = (name: string, patch: ProgressPatch) => void;

// 所持メモピのクランプ: 0 以上の整数（上限なし）。
const clampOwnedMemoryPiece = (v: number) => Math.max(0, Math.floor(v));
// toPurePieceCount は unknown を受け取るが、hook では number のみ渡すためラップする。
const clampPurePiece = (v: number) => toPurePieceCount(v);

// 保存用の日付文字列をDateへ変換し、不正値なら undefined を返す。
function parseStoredDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

// Date型を保存用の YYYY-MM-DD 文字列へ変換する。
function toStoredDateString(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

type StarSelectProps = {
  character: MasterCharacter;
  star: CharacterProgress["star"];
  isAtMax: boolean;
  onUpdateProgress: UpdateProgressHandler;
};

// ☆セレクト。テーブル行とモバイル編集シートで共用する。
export function StarSelect({ character, star, isAtMax, onUpdateProgress }: StarSelectProps) {
  // ☆6未実装キャラは選択肢を☆5までに制限する。
  const starMax = character.implemented.star6 ? 6 : 5;
  const handleChange = useCallback(
    (value: string) => onUpdateProgress(character.name, { star: Number(value) as CharacterProgress["star"] }),
    [onUpdateProgress, character.name],
  );
  return (
    <TableSelect value={String(star)} appearance={isAtMax ? "maxed" : "default"} onValueChange={handleChange}>
      {Array.from({ length: starMax }, (_, index) => index + 1).map((starOption) => (
        <SelectItem key={starOption} value={String(starOption)}>
          {starOption}
        </SelectItem>
      ))}
    </TableSelect>
  );
}

type ConnectRankSelectProps = {
  character: MasterCharacter;
  connectRank: CharacterProgress["connectRank"];
  isAtMax: boolean;
  onUpdateProgress: UpdateProgressHandler;
};

// コネクトRANKセレクト。0 は「未開放」として表示する。
export function ConnectRankSelect({ character, connectRank, isAtMax, onUpdateProgress }: ConnectRankSelectProps) {
  const handleChange = useCallback(
    (value: string) => onUpdateProgress(character.name, { connectRank: Number(value) as CharacterProgress["connectRank"] }),
    [onUpdateProgress, character.name],
  );
  return (
    <TableSelect value={String(connectRank)} appearance={isAtMax ? "maxed" : "default"} onValueChange={handleChange}>
      <SelectItem value="0">未開放</SelectItem>
      {Array.from({ length: 15 }, (_, index) => index + 1).map((rank) => (
        <SelectItem key={rank} value={String(rank)}>
          {rank}
        </SelectItem>
      ))}
    </TableSelect>
  );
}

type Ue1SelectProps = {
  character: MasterCharacter;
  /** rowDerived の ue1CompositeValue（SP装備中は "sp"） */
  value: string;
  isAtMax: boolean;
  onUpdateProgress: UpdateProgressHandler;
};

// 専用1セレクト。SP実装キャラは "sp" 選択で SP 装備状態へ切り替える。未実装キャラは無効表示。
export function Ue1Select({ character, value, isAtMax, onUpdateProgress }: Ue1SelectProps) {
  const handleChange = useCallback(
    (nextRaw: string) => {
      // SP選択時はレベル最大＋SP装備、それ以外はレベル指定＋SP解除として更新する。
      if (nextRaw === "sp") {
        onUpdateProgress(character.name, { ue1Level: 370, ue1SpEquipped: true });
        return;
      }
      const nextValue = (nextRaw === "null" ? null : Number(nextRaw)) as CharacterProgress["ue1Level"];
      onUpdateProgress(character.name, { ue1Level: nextValue, ue1SpEquipped: false });
    },
    [onUpdateProgress, character.name],
  );
  if (!character.implemented.ue1) {
    return (
      <TableSelect value="null" appearance="disabled" disabled>
        <SelectItem value="null">-</SelectItem>
      </TableSelect>
    );
  }
  return (
    <TableSelect value={value} appearance={isAtMax ? "maxed" : "default"} onValueChange={handleChange}>
      {UE1_LEVEL_VALUES.map((level) => (
        <SelectItem key={level} value={String(level)}>
          {formatUeLevel(level)}
        </SelectItem>
      ))}
      {character.implemented.ue1Sp ? <SelectItem value="sp">SP</SelectItem> : null}
    </TableSelect>
  );
}

type Ue2SelectProps = {
  character: MasterCharacter;
  /** rowDerived の ue2Value */
  value: string;
  isAtMax: boolean;
  onUpdateProgress: UpdateProgressHandler;
};

// 専用2セレクト。未実装キャラは無効表示。
export function Ue2Select({ character, value, isAtMax, onUpdateProgress }: Ue2SelectProps) {
  const handleChange = useCallback(
    (nextRaw: string) => {
      const nextValue = (nextRaw === "null" ? null : Number(nextRaw)) as CharacterProgress["ue2Level"];
      onUpdateProgress(character.name, { ue2Level: nextValue });
    },
    [onUpdateProgress, character.name],
  );
  if (!character.implemented.ue2) {
    return (
      <TableSelect value="null" appearance="disabled" disabled>
        <SelectItem value="null">-</SelectItem>
      </TableSelect>
    );
  }
  return (
    <TableSelect value={value} appearance={isAtMax ? "maxed" : "default"} onValueChange={handleChange}>
      {UE2_LEVEL_VALUES.map((level) => (
        <SelectItem key={level} value={String(level)}>
          {formatUeLevel(level)}
        </SelectItem>
      ))}
    </TableSelect>
  );
}

type ObtainedDatePickerProps = {
  character: MasterCharacter;
  obtainedDate: CharacterProgress["obtainedDate"];
  onUpdateProgress: UpdateProgressHandler;
};

// 入手日ピッカー。Popover+Calendar での選択と、テスト・支援技術向けの sr-only な date input を併設する。
export function ObtainedDatePicker({ character, obtainedDate, onUpdateProgress }: ObtainedDatePickerProps) {
  const selectedObtainedDate = useMemo(() => parseStoredDate(obtainedDate), [obtainedDate]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  // sr-only な date input の直接変更を保存形式（YYYY-MM-DD / null）へ反映する。
  const handleObtainedDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value.trim();
      onUpdateProgress(character.name, { obtainedDate: nextValue ? nextValue : null });
    },
    [onUpdateProgress, character.name],
  );
  // カレンダーで日付を選んだら保存してポップオーバーを閉じる。
  const handleObtainedDateSelect = useCallback(
    (value: Date | undefined) => {
      if (!value) {
        return;
      }
      onUpdateProgress(character.name, { obtainedDate: toStoredDateString(value) });
      setIsDatePickerOpen(false);
    },
    [onUpdateProgress, character.name],
  );
  // 入手日を未設定（null）へ戻す。
  const handleObtainedDateClear = useCallback(() => {
    onUpdateProgress(character.name, { obtainedDate: null });
  }, [onUpdateProgress, character.name]);
  return (
    <>
      <Popover.Root open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`${character.name}の入手日セル`}
            className="inline-flex w-full items-center justify-between rounded-[10px] border border-white/20 bg-input-bg px-2.5 py-2 text-sm font-bold hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <span className="tabular-nums">{formatObtainedDate(obtainedDate)}</span>
            <span className="inline-flex items-center text-muted">
              <CalendarIcon className="size-4" />
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="center"
            className="z-50 rounded-[12px] border border-white/20 bg-popover-bg p-2 shadow-panel"
          >
            <Calendar mode="single" selected={selectedObtainedDate} onSelect={handleObtainedDateSelect} />
            <div className="mt-1.5 flex justify-end">
              <Button variant="ghost" size="sm" aria-label={`${character.name}の入手日クリア`} onClick={handleObtainedDateClear}>
                クリア
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <input
        type="date"
        value={obtainedDate ?? ""}
        aria-label={`${character.name}の入手日`}
        className="sr-only"
        onChange={handleObtainedDateChange}
      />
    </>
  );
}

type OwnedMemoryPieceInputProps = {
  character: MasterCharacter;
  ownedMemoryPiece: number;
  onUpdateProgress: UpdateProgressHandler;
};

// 所持メモピ数入力。確定時に 0 以上の整数へクランプして通知する。
export function OwnedMemoryPieceInput({ character, ownedMemoryPiece, onUpdateProgress }: OwnedMemoryPieceInputProps) {
  const commit = useCallback(
    (v: number) => onUpdateProgress(character.name, { ownedMemoryPiece: v }),
    [onUpdateProgress, character.name],
  );
  const field = useClampedNumberInput(ownedMemoryPiece, clampOwnedMemoryPiece, commit);
  return (
    <TableNumberInput
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={field.value}
      aria-label={`${character.name}の所持メモピ数`}
      onChange={field.onChange}
      onBlur={field.onBlur}
      onKeyDown={field.onKeyDown}
    />
  );
}

type OwnedPurePieceInputProps = {
  character: MasterCharacter;
  ownedPurePiece: number;
  /** rowDerived の isPurePieceImplemented。false なら無効表示にする */
  isImplemented: boolean;
  onUpdatePurePiece: (name: string, value: number) => void;
};

// 所持ピュアピ数入力。ピュアピ未実装キャラは無効表示にする。
export function OwnedPurePieceInput({ character, ownedPurePiece, isImplemented, onUpdatePurePiece }: OwnedPurePieceInputProps) {
  const commit = useCallback(
    (v: number) => onUpdatePurePiece(character.name, v),
    [onUpdatePurePiece, character.name],
  );
  const field = useClampedNumberInput(ownedPurePiece, clampPurePiece, commit);
  if (!isImplemented) {
    return (
      <TableNumberInput
        type="text"
        value="-"
        disabled
        aria-label={`${character.name}の所持ピュアピ数（未実装）`}
        className="text-left text-muted"
      />
    );
  }
  return (
    <TableNumberInput
      type="number"
      inputMode="numeric"
      min={0}
      max={99999}
      step={1}
      value={field.value}
      aria-label={`${character.name}の所持ピュアピ数`}
      onChange={field.onChange}
      onBlur={field.onBlur}
      onKeyDown={field.onKeyDown}
    />
  );
}

type GachaPullCountInputProps = {
  character: MasterCharacter;
  gachaPullCount: number;
  onUpdateProgress: UpdateProgressHandler;
};

// ガチャ回数入力。確定時に 0〜300 の範囲へクランプして通知する。
export function GachaPullCountInput({ character, gachaPullCount, onUpdateProgress }: GachaPullCountInputProps) {
  const commit = useCallback(
    (v: number) => onUpdateProgress(character.name, { gachaPullCount: v }),
    [onUpdateProgress, character.name],
  );
  const field = useClampedNumberInput(gachaPullCount, toGachaPullCount, commit);
  return (
    <TableNumberInput
      type="number"
      inputMode="numeric"
      min={0}
      max={300}
      step={1}
      value={field.value}
      aria-label={`${character.name}のガチャ回数`}
      onChange={field.onChange}
      onBlur={field.onBlur}
      onKeyDown={field.onKeyDown}
    />
  );
}
