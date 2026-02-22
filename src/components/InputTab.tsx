import { useMemo, useState } from "react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../domain/levels";
import type { CharacterProgress, MasterCharacter, MemoryPieceSource, StoredStateV1 } from "../domain/types";

type ProgressPatch = Partial<
  Pick<CharacterProgress, "owned" | "limitBreak" | "star" | "ue1Level" | "ue1SpEquipped" | "ue2Level">
>;

type InputTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
  onUpdateProgress: (name: string, patch: ProgressPatch) => void;
};

type OwnedFilter = "all" | "owned" | "unowned";
type LimitedFilter = "all" | "limited" | "normal";

const memorySourceLabelMap: Record<MemoryPieceSource, string> = {
  dungeon_coin: "ダンジョン",
  arena_coin: "アリーナ",
  p_arena_coin: "プリーナ",
  clan_coin: "クラン",
  master_coin: "マスター",
  hard_quest: "ハード",
  side_story: "サイド",
};

function formatUeLevel(level: number): string {
  return level === 0 ? "未装備" : `Lv.${level}`;
}

export function InputTab({ masterCharacters, state, onUpdateProgress }: InputTabProps) {
  const [searchText, setSearchText] = useState("");
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [limitedFilter, setLimitedFilter] = useState<LimitedFilter>("all");

  const filteredCharacters = useMemo(() => {
    const trimmedSearchText = searchText.trim();
    return masterCharacters.filter((character) => {
      const progress = state.progressByName[character.name];
      if (trimmedSearchText && !character.name.includes(trimmedSearchText)) {
        return false;
      }
      if (ownedFilter === "owned" && !progress?.owned) {
        return false;
      }
      if (ownedFilter === "unowned" && progress?.owned) {
        return false;
      }
      if (limitedFilter === "limited" && !character.limited) {
        return false;
      }
      if (limitedFilter === "normal" && character.limited) {
        return false;
      }
      return true;
    });
  }, [limitedFilter, masterCharacters, ownedFilter, searchText, state.progressByName]);

  return (
    <section className="panel">
      <div className="input-toolbar">
        <label className="field-group">
          <span>キャラ検索</span>
          <input
            className="text-input"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="例: ヒヨリ"
          />
        </label>

        <label className="field-group">
          <span>所持フィルタ</span>
          <select
            className="select-input"
            value={ownedFilter}
            onChange={(event) => setOwnedFilter(event.target.value as OwnedFilter)}
          >
            <option value="all">すべて</option>
            <option value="owned">所持のみ</option>
            <option value="unowned">未所持のみ</option>
          </select>
        </label>

        <label className="field-group">
          <span>限定フィルタ</span>
          <select
            className="select-input"
            value={limitedFilter}
            onChange={(event) => setLimitedFilter(event.target.value as LimitedFilter)}
          >
            <option value="all">すべて</option>
            <option value="limited">限定のみ</option>
            <option value="normal">恒常のみ</option>
          </select>
        </label>
      </div>

      <p className="result-count">表示件数: {filteredCharacters.length}</p>

      <div className="table-wrap">
        <table className="character-table">
          <thead>
            <tr>
              <th>所持</th>
              <th>キャラ</th>
              <th>区分</th>
              <th>限界突破</th>
              <th>☆</th>
              <th>専用1</th>
              <th>専用2</th>
              <th>メモピ入手</th>
            </tr>
          </thead>
          <tbody>
            {filteredCharacters.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-row">
                  条件に一致するキャラがいません
                </td>
              </tr>
            ) : (
              filteredCharacters.map((character) => {
                const progress = state.progressByName[character.name];
                if (!progress) {
                  return null;
                }

                const ue1Value = character.implemented.ue1 ? String(progress.ue1Level ?? 0) : "null";
                const ue2Value = character.implemented.ue2 ? String(progress.ue2Level ?? 0) : "null";
                const starMax = character.implemented.star6 ? 6 : 5;
                const ue1CompositeValue =
                  character.implemented.ue1 && character.implemented.ue1Sp && progress.ue1SpEquipped ? "sp" : ue1Value;

                return (
                  <tr key={character.name}>
                    <td>
                      <label className="table-switch">
                        <input
                          type="checkbox"
                          checked={progress.owned}
                          aria-label={`${character.name}の所持状態`}
                          onChange={(event) => onUpdateProgress(character.name, { owned: event.target.checked })}
                        />
                      </label>
                    </td>
                    <td className="name-cell">{character.name}</td>
                    <td>
                      {character.limited ? <span className="badge limited">限定</span> : <span className="badge">恒常</span>}
                    </td>
                    <td>
                      <label className="table-switch">
                        <input
                          type="checkbox"
                          checked={progress.limitBreak}
                          aria-label={`${character.name}の限界突破状態`}
                          onChange={(event) => onUpdateProgress(character.name, { limitBreak: event.target.checked })}
                        />
                      </label>
                    </td>
                    <td>
                      <select
                        className="select-input table-select"
                        value={progress.star}
                        onChange={(event) =>
                          onUpdateProgress(character.name, { star: Number(event.target.value) as CharacterProgress["star"] })
                        }
                      >
                        {Array.from({ length: starMax }, (_, index) => index + 1).map((star) => (
                          <option key={star} value={star}>
                            {star}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {character.implemented.ue1 ? (
                        <select
                          className="select-input table-select"
                          value={ue1CompositeValue}
                          onChange={(event) => {
                            if (event.target.value === "sp") {
                              onUpdateProgress(character.name, { ue1Level: 370, ue1SpEquipped: true });
                              return;
                            }
                            const nextValue = (event.target.value === "null"
                              ? null
                              : Number(event.target.value)) as CharacterProgress["ue1Level"];
                            onUpdateProgress(character.name, { ue1Level: nextValue, ue1SpEquipped: false });
                          }}
                        >
                          {UE1_LEVEL_VALUES.map((level) => (
                            <option key={level} value={level}>
                              {formatUeLevel(level)}
                            </option>
                          ))}
                          {character.implemented.ue1Sp ? <option value="sp">SP</option> : null}
                        </select>
                      ) : (
                        <select className="select-input table-select table-select-disabled" value="null" disabled>
                          <option value="null">-</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {character.implemented.ue2 ? (
                        <select
                          className="select-input table-select"
                          value={ue2Value}
                          onChange={(event) => {
                            const nextValue = (event.target.value === "null"
                              ? null
                              : Number(event.target.value)) as CharacterProgress["ue2Level"];
                            onUpdateProgress(character.name, { ue2Level: nextValue });
                          }}
                        >
                          {UE2_LEVEL_VALUES.map((level) => (
                            <option key={level} value={level}>
                              {formatUeLevel(level)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select className="select-input table-select table-select-disabled" value="null" disabled>
                          <option value="null">-</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <div className="table-source-list">
                        {character.memoryPieceSources.length === 0 ? (
                          <span className="source-chip empty">情報なし</span>
                        ) : (
                          character.memoryPieceSources.map((source) => (
                            <span key={source} className={`source-chip source-chip-${source}`}>
                              {memorySourceLabelMap[source]}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
