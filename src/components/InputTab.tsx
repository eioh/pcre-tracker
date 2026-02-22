import { useMemo, useState } from "react";
import { UE1_LEVEL_VALUES, UE2_LEVEL_VALUES } from "../domain/levels";
import type { CharacterProgress, MasterCharacter, MemoryPieceSource, StoredStateV1 } from "../domain/types";

type ProgressPatch = Partial<Pick<CharacterProgress, "owned" | "ue1Level" | "ue1SpEquipped" | "ue2Level">>;

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
  return level === 0 ? "未装備(0)" : `Lv${level}`;
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
              <th>キャラ</th>
              <th>区分</th>
              <th>星6</th>
              <th>所持</th>
              <th>専用1</th>
              <th>専用1SP</th>
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

                return (
                  <tr key={character.name}>
                    <td className="name-cell">{character.name}</td>
                    <td>
                      {character.limited ? <span className="badge limited">限定</span> : <span className="badge">恒常</span>}
                    </td>
                    <td>
                      <span className={character.implemented.star6 ? "status-pill yes" : "status-pill no"}>
                        {character.implemented.star6 ? "実装" : "未実装"}
                      </span>
                    </td>
                    <td>
                      <label className="table-switch">
                        <input
                          type="checkbox"
                          checked={progress.owned}
                          onChange={(event) => onUpdateProgress(character.name, { owned: event.target.checked })}
                        />
                        <span>{progress.owned ? "所持" : "未所持"}</span>
                      </label>
                    </td>
                    <td>
                      <select
                        className="select-input table-select"
                        value={character.implemented.ue1 ? ue1Value : "null"}
                        disabled={!character.implemented.ue1}
                        onChange={(event) => {
                          const nextValue = (event.target.value === "null"
                            ? null
                            : Number(event.target.value)) as CharacterProgress["ue1Level"];
                          onUpdateProgress(character.name, { ue1Level: nextValue });
                        }}
                      >
                        {!character.implemented.ue1 ? <option value="null">未実装</option> : null}
                        {character.implemented.ue1
                          ? UE1_LEVEL_VALUES.map((level) => (
                              <option key={level} value={level}>
                                {formatUeLevel(level)}
                              </option>
                            ))
                          : null}
                      </select>
                    </td>
                    <td>
                      {character.implemented.ue1Sp ? (
                        <label className="table-switch">
                          <input
                            type="checkbox"
                            checked={progress.ue1SpEquipped}
                            onChange={(event) =>
                              onUpdateProgress(character.name, {
                                ue1SpEquipped: event.target.checked,
                              })
                            }
                          />
                          <span>{progress.ue1SpEquipped ? "装備済み" : "未装備"}</span>
                        </label>
                      ) : (
                        <span className="status-pill no">未実装</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="select-input table-select"
                        value={character.implemented.ue2 ? ue2Value : "null"}
                        disabled={!character.implemented.ue2}
                        onChange={(event) => {
                          const nextValue = (event.target.value === "null"
                            ? null
                            : Number(event.target.value)) as CharacterProgress["ue2Level"];
                          onUpdateProgress(character.name, { ue2Level: nextValue });
                        }}
                      >
                        {!character.implemented.ue2 ? <option value="null">未実装</option> : null}
                        {character.implemented.ue2
                          ? UE2_LEVEL_VALUES.map((level) => (
                              <option key={level} value={level}>
                                {formatUeLevel(level)}
                              </option>
                            ))
                          : null}
                      </select>
                    </td>
                    <td>
                      <div className="table-source-list">
                        {character.memoryPieceSources.length === 0 ? (
                          <span className="source-chip empty">情報なし</span>
                        ) : (
                          character.memoryPieceSources.map((source) => (
                            <span key={source} className="source-chip">
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
