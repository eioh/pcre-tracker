import { memo } from "react";
import type { Ue1MemoryCalcMode } from "../../utils/ue1MemoryCost";
import type { StarMemoryCalcMode } from "../../utils/starMemoryCost";
import { controlClass, fieldGroupClass, memoryCalcGridClass, memoryCalcSectionClass } from "./uiStyles";

type InputMemoryCalcSettingsProps = {
  starMemoryCalcMode: StarMemoryCalcMode;
  onStarMemoryCalcModeChange: (value: StarMemoryCalcMode) => void;
  ue1MemoryCalcMode: Ue1MemoryCalcMode;
  onUe1MemoryCalcModeChange: (value: Ue1MemoryCalcMode) => void;
};

// 必要メモピ計算の対象モードを切り替える UI を表示する。
export const InputMemoryCalcSettings = memo(function InputMemoryCalcSettings({
  starMemoryCalcMode,
  onStarMemoryCalcModeChange,
  ue1MemoryCalcMode,
  onUe1MemoryCalcModeChange,
}: InputMemoryCalcSettingsProps) {
  return (
    <div className={memoryCalcSectionClass}>
      <p className="mb-2.5 mt-0 text-sm font-semibold text-[#c8d8f6]">必要メモピ計算</p>
      <div className={memoryCalcGridClass}>
        <label className={fieldGroupClass}>
          <span>☆</span>
          <select
            className={controlClass}
            value={starMemoryCalcMode}
            onChange={(event) => onStarMemoryCalcModeChange(event.target.value as StarMemoryCalcMode)}
          >
            <option value="implemented_max">実装段階の最大まで</option>
            <option value="star6_max">☆6最大まで（仮定）</option>
          </select>
        </label>

        <label className={fieldGroupClass}>
          <span>専用1</span>
          <select
            className={controlClass}
            value={ue1MemoryCalcMode}
            onChange={(event) => onUe1MemoryCalcModeChange(event.target.value as Ue1MemoryCalcMode)}
          >
            <option value="implemented_max">実装段階の最大まで</option>
            <option value="sp_max">SP最大まで（仮定）</option>
          </select>
        </label>
      </div>
    </div>
  );
});
