import { memo } from "react";
import type { Ue1HeartFragmentCalcMode } from "../../utils/ue1HeartFragmentCost";
import type { Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import type { StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { memoryCalcGridClass, memoryCalcSectionClass } from "./uiStyles";

type InputMemoryCalcSettingsProps = {
  starMemoryCalcMode: StarMemoryCalcMode;
  onStarMemoryCalcModeChange: (value: StarMemoryCalcMode) => void;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  onUe1MemoryCalcModeChange: (value: Ue1MemoryCalcMode) => void;
  ue1HeartFragmentCalcMode: Ue1HeartFragmentCalcMode;
  onUe1HeartFragmentCalcModeChange: (value: Ue1HeartFragmentCalcMode) => void;
};

// 必要メモピ/ハートの欠片計算の対象モードを切り替える UI を表示する。
export const InputMemoryCalcSettings = memo(function InputMemoryCalcSettings({
  starMemoryCalcMode,
  onStarMemoryCalcModeChange,
  ue1MemoryCalcMode,
  onUe1MemoryCalcModeChange,
  ue1HeartFragmentCalcMode,
  onUe1HeartFragmentCalcModeChange,
}: InputMemoryCalcSettingsProps) {
  return (
    <div className={memoryCalcSectionClass}>
      <p className="mb-2.5 mt-0 text-sm font-semibold text-[#c8d8f6]">必要メモピ/ハートの欠片計算</p>
      <div className={memoryCalcGridClass}>
        <div className="grid gap-1.5 text-sm text-muted">
          <Label>☆</Label>
          <Select value={starMemoryCalcMode} onValueChange={(value) => onStarMemoryCalcModeChange(value as StarMemoryCalcMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="implemented_max">実装段階の最大まで</SelectItem>
              <SelectItem value="star6_max">☆6最大まで(☆6未実装含む)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 text-sm text-muted">
          <Label>専用1(メモピ)</Label>
          <Select value={ue1MemoryCalcMode} onValueChange={(value) => onUe1MemoryCalcModeChange(value as Ue1MemoryCalcMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="implemented_max">実装段階の最大まで</SelectItem>
              <SelectItem value="sp_max">SP最大まで(SP未実装含む)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 text-sm text-muted">
          <Label>専用1(ハート)</Label>
          <Select
            value={ue1HeartFragmentCalcMode}
            onValueChange={(value) => onUe1HeartFragmentCalcModeChange(value as Ue1HeartFragmentCalcMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="implemented_max">実装段階の最大まで</SelectItem>
              <SelectItem value="all_max">専用1最大まで(専用1未実装含む)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
});
