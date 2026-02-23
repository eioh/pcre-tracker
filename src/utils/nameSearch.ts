import { toHiragana as wkToHiragana, toKatakana as wkToKatakana, toRomaji as wkToRomaji } from "wanakana";

// 文字列を検索比較用に正規化する。
export function normalizeForSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "").trim();
}

// 文字列をひらがなへ変換する。
export function toHiragana(value: string): string {
  return wkToHiragana(value, { passRomaji: true });
}

// 文字列をカタカナへ変換する。
export function toKatakana(value: string): string {
  return wkToKatakana(value, { passRomaji: true });
}

// 文字列をローマ字へ変換する。
export function toRomaji(value: string): string {
  return normalizeForSearch(wkToRomaji(value));
}

// 1編集以内かを判定する。
export function isEditDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const lengthDiff = Math.abs(a.length - b.length);
  if (lengthDiff > 1) {
    return false;
  }

  if (a.length === b.length) {
    let mismatchCount = 0;
    for (let i = 0; i < a.length; i += 1) {
      if ((a[i] ?? "") !== (b[i] ?? "")) {
        mismatchCount += 1;
        if (mismatchCount > 1) {
          return false;
        }
      }
    }
    return true;
  }

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let longerIndex = 0;
  let shorterIndex = 0;
  let mismatchCount = 0;

  while (longerIndex < longer.length && shorterIndex < shorter.length) {
    if ((longer[longerIndex] ?? "") === (shorter[shorterIndex] ?? "")) {
      longerIndex += 1;
      shorterIndex += 1;
      continue;
    }

    mismatchCount += 1;
    if (mismatchCount > 1) {
      return false;
    }
    longerIndex += 1;
  }

  return true;
}

// 候補内の任意部分文字列に対して距離1以内一致を判定する。
function hasFuzzySubstringMatch(candidate: string, query: string): boolean {
  const minLength = Math.max(1, query.length - 1);
  const maxLength = Math.min(candidate.length, query.length + 1);

  for (let windowLength = minLength; windowLength <= maxLength; windowLength += 1) {
    for (let start = 0; start <= candidate.length - windowLength; start += 1) {
      const segment = candidate.slice(start, start + windowLength);
      if (isEditDistanceAtMostOne(segment, query)) {
        return true;
      }
    }
  }

  return false;
}

// キャラ名検索で使用する候補トークンを作成する。
export function buildNameSearchTokens(name: string): string[] {
  const normalizedName = normalizeForSearch(name);
  const hiraganaName = normalizeForSearch(toHiragana(name));
  const katakanaName = normalizeForSearch(toKatakana(hiraganaName));
  const romajiName = toRomaji(name);

  return Array.from(new Set([normalizedName, hiraganaName, katakanaName, romajiName].filter((token) => token.length > 0)));
}

// 保存済みトークンを正規化し、未設定時は名前から生成する。
function resolveSearchTokens(nameOrTokens: string | string[]): string[] {
  if (Array.isArray(nameOrTokens)) {
    const normalizedTokens = nameOrTokens
      .map((token) => normalizeForSearch(token))
      .filter((token) => token.length > 0);
    if (normalizedTokens.length > 0) {
      return Array.from(new Set(normalizedTokens));
    }
    return [];
  }
  return buildNameSearchTokens(nameOrTokens);
}

// クエリがキャラ名に一致するかを通常一致と距離1一致で判定する。
export function isCharacterNameMatched(nameOrTokens: string | string[], query: string): boolean {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) {
    return true;
  }

  const tokens = resolveSearchTokens(nameOrTokens);
  if (tokens.some((token) => token.includes(normalizedQuery))) {
    return true;
  }

  return tokens.some((token) => hasFuzzySubstringMatch(token, normalizedQuery));
}
