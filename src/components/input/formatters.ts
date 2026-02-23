// 専用装備レベルの表示文字列を統一する。
export function formatUeLevel(level: number): string {
  return level === 0 ? "未装備" : `Lv.${level}`;
}
