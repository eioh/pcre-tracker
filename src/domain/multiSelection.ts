/**
 * 複数選択フィルタの選択状態。
 * - null: 絞り込みなし（全項目を選んでいる扱い。選択肢が将来増えても自動で含まれる）
 * - []: 何も選んでいない（一致する行はない）
 * - それ以外: 選んだ項目だけに絞り込む
 */
export type MultiSelection<T> = T[] | null;

// 値が選択中かを返す（絞り込みなしなら常に選択中）。
export function isMultiSelected<T>(selection: MultiSelection<T>, value: T): boolean {
  return selection === null || selection.includes(value);
}

// 1 項目のチェックを切り替えた次の選択状態を返す。
// 並びは選択肢の順にそろえ、全項目がそろったら絞り込みなし（null）へ正規化する。
export function toggleMultiSelection<T>(selection: MultiSelection<T>, value: T, allValues: readonly T[]): MultiSelection<T> {
  const current = new Set(selection ?? allValues);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  const next = allValues.filter((candidate) => current.has(candidate));
  return next.length === allValues.length ? null : next;
}
