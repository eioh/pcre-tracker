import { describe, expect, it } from "vitest";
import { interpretRobotsResponse, isPathAllowed, parseRobotsTxt, selectRules } from "./robots.mjs";

// 2026-10 時点の wikiwiki.jp の robots.txt と同じ内容。
const WIKIWIKI_ROBOTS = `User-Agent: *
Disallow: /*?
Disallow: /*/::*
Allow: /common/

Sitemap: https://wikiwiki.jp/sitemap-index.xml
`;

describe("robots.txt の判定", () => {
  const rules = selectRules(parseRobotsTxt(WIKIWIKI_ROBOTS), "pcre-tracker-master-sync");

  it("クエリなしの wiki ページは許可される", () => {
    expect(isPathAllowed(rules, "/yabaidesune/%E9%9A%8A%E5%88%97")).toBe(true);
  });

  it("クエリ付きの URL（編集・ソース表示など）は不許可になる", () => {
    expect(isPathAllowed(rules, "/yabaidesune/?cmd=source&page=foo")).toBe(false);
    expect(isPathAllowed(rules, "/yabaidesune/%E9%9A%8A%E5%88%97?cmd=edit")).toBe(false);
  });

  it("/::* 形式の特殊パスは不許可になる", () => {
    expect(isPathAllowed(rules, "/yabaidesune/::cmd/edit")).toBe(false);
  });

  it("製品名に一致するグループがあればそちらを優先し、最長一致・同長なら Allow を採る", () => {
    const groups = parseRobotsTxt("User-agent: *\nDisallow: /\n\nUser-agent: pcre-tracker-master-sync\nDisallow: /private\nAllow: /private/ok\n");
    const own = selectRules(groups, "pcre-tracker-master-sync");
    expect(isPathAllowed(own, "/public")).toBe(true);
    expect(isPathAllowed(own, "/private/x")).toBe(false);
    expect(isPathAllowed(own, "/private/ok/1")).toBe(true);
    expect(isPathAllowed(selectRules(groups, "other-bot"), "/public")).toBe(false);
  });

  it("$ で終端を固定したパターンを扱える", () => {
    const own = selectRules(parseRobotsTxt("User-agent: *\nDisallow: /*.json$\n"), "x");
    expect(isPathAllowed(own, "/a.json")).toBe(false);
    expect(isPathAllowed(own, "/a.json.html")).toBe(true);
  });
});

describe("robots.txt の取得結果の解釈", () => {
  it("HTML が返った場合は robots.txt なしとして扱う（SPA が全パスに同じ HTML を返すサイト）", () => {
    const result = interpretRobotsResponse({ status: 200, contentType: "text/html", body: "<!doctype html><html></html>" }, "x");
    expect(result).toEqual({ state: "absent", rules: [], disallowAll: false });
  });

  it("4xx は制限なし、5xx・通信失敗はすべて不許可とする", () => {
    expect(interpretRobotsResponse({ status: 404, contentType: null, body: "" }, "x").disallowAll).toBe(false);
    expect(interpretRobotsResponse({ status: 503, contentType: null, body: "" }, "x").disallowAll).toBe(true);
    expect(interpretRobotsResponse({ status: null, contentType: null, body: "" }, "x").disallowAll).toBe(true);
  });
});
