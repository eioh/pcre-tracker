// robots.txt を解析し、取得しようとしているパスが許可されているかを判定する（RFC 9309 準拠の最小実装）。

/**
 * @typedef {{ allow: boolean, pattern: string }} RobotsRule
 * @typedef {{ agents: string[], rules: RobotsRule[] }} RobotsGroup
 */

// robots.txt の本文を User-agent ごとのグループに分ける。
/** @returns {RobotsGroup[]} */
export function parseRobotsTxt(text) {
  /** @type {RobotsGroup[]} */
  const groups = [];
  /** @type {RobotsGroup | null} */
  let current = null;
  // 直前の行が User-agent だったか（連続する User-agent は同じグループにまとめる）。
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current || (key !== "allow" && key !== "disallow")) {
      continue;
    }
    // 空の Disallow は「すべて許可」を意味するので規則として扱わない。
    if (value === "") {
      continue;
    }
    current.rules.push({ allow: key === "allow", pattern: value });
  }
  return groups;
}

// User-Agent の製品名トークンに一致するグループの規則を返す。一致がなければ「*」のグループを使う。
/** @returns {RobotsRule[]} */
export function selectRules(groups, productToken) {
  const token = productToken.toLowerCase();
  const matched = groups.filter((group) => group.agents.includes(token));
  const selected = matched.length > 0 ? matched : groups.filter((group) => group.agents.includes("*"));
  return selected.flatMap((group) => group.rules);
}

// robots.txt のパターン（* と末尾の $ に対応）を正規表現に変換する。
function patternToRegExp(pattern) {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

// パスとクエリ（例: "/a/b?x=1"）が規則上許可されているかを返す。最長一致の規則を優先し、同じ長さなら Allow を優先する。
export function isPathAllowed(rules, pathWithQuery) {
  /** @type {RobotsRule | null} */
  let best = null;
  for (const rule of rules) {
    if (!patternToRegExp(rule.pattern).test(pathWithQuery)) {
      continue;
    }
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

// robots.txt の取得結果から、判定に使う規則と状態を決める。
// 2xx のテキストは解析し、4xx は「制限なし」、5xx や通信失敗は「すべて不許可」とする（RFC 9309）。
// 2xx でも HTML が返った場合（SPA が全パスに同じ HTML を返すなど）は robots.txt が存在しないものとみなす。
/** @returns {{ state: "parsed" | "absent" | "unreachable", rules: RobotsRule[], disallowAll: boolean }} */
export function interpretRobotsResponse({ status, contentType, body }, productToken) {
  if (status === null || status >= 500) {
    return { state: "unreachable", rules: [], disallowAll: true };
  }
  if (status >= 400) {
    return { state: "absent", rules: [], disallowAll: false };
  }
  const looksLikeHtml = /text\/html/i.test(contentType ?? "") || /^\s*</.test(body);
  if (looksLikeHtml) {
    return { state: "absent", rules: [], disallowAll: false };
  }
  return { state: "parsed", rules: selectRules(parseRobotsTxt(body), productToken), disallowAll: false };
}
