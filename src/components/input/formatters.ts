// 専用装備レベルの表示文字列を統一する。
export function formatUeLevel(level: number): string {
  return level === 0 ? "未装備" : `Lv.${level}`;
}

// 入手日文字列を YYYY/MM/DD の表示形式へ変換する。
export function formatObtainedDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return value.replace(/-/g, "/");
}
