// 段階3（AI レビューの材料作りと review.json の機械的な検証）のテスト。
import { describe, expect, it } from "vitest";
import { normalizeForQuote, pageToReviewText, quoteKeys, verifyReview } from "./review.mjs";

const IMPL_URL = "https://wikiwiki.jp/yabaidesune/impl";
const EVENT_URL = "https://wikiwiki.jp/yabaidesune/event";

// wiki のページと同じく #content の中に本文を置いた HTML を作る。
function page(body) {
  return `<!DOCTYPE html><html><body><div id="content">${body}<script>ignored()</script></div></body></html>`;
}

describe("pageToReviewText", () => {
  it("表を 1 行 1 行のテキストにし、画像を [alt] に、折り畳みを印で囲む", () => {
    const text = pageToReviewText(
      page(`<h3>中衛</h3><div>←後方　前方→</div>
        <table><tr><td><a title="キャラクター/ネア"><img alt="ネア"></a><a><img alt="アユミ"></a></td></tr></table>
        <div class="fold-container"><div class="fold-content"><table><tr><th rowspan="2">旧</th><td>A</td></tr><tr><td>B</td></tr></table></div></div>`),
    );
    expect(text.split("\n")).toEqual(["中衛", "←後方　前方→", "| [ネア] [アユミ] |", "〔折り畳み開始〕", "| 旧 | A |", "| 旧 | B |", "〔折り畳み終了〕"]);
  });
});

describe("quoteKeys", () => {
  it("キャラ名は全角・半角カッコと実装日一覧の列の表記、HARD はステージとキャラ名、イベントは名前の先頭を使う", () => {
    expect(quoteKeys({ area: "", kind: "新キャラ追加", target: "アメス（ガンナー）", detail: "", sources: [] })).toEqual([
      "アメス（ガンナー）",
      "アメス(ガンナー)",
      "アメス | ガンナー",
    ]);
    expect(quoteKeys({ area: "", kind: "HARD ステージを追加", target: "82-1", after: "グレア", detail: "", sources: [] })).toEqual(["H82-1", "グレア", "グレア"]);
    expect(quoteKeys({ area: "", kind: "サイドストーリーを追加", target: "Dears　おかえりとただいまの約束", detail: "", sources: [] })).toEqual(["Dears"]);
  });
});

// 検証用のパケット（変更 2 件）を作る。
function packet() {
  return {
    candidateHash: "abc123def456",
    proposals: [
      { id: "p1", kind: "専用1を実装済みにする", target: "サツキ", sources: [IMPL_URL], quoteMustContainOneOf: ["サツキ"] },
      { id: "p2", kind: "サイドストーリーを追加", target: "Dears　おかえり", sources: [EVENT_URL], quoteMustContainOneOf: ["Dears"] },
    ],
  };
}

const PAGE_TEXTS = {
  [IMPL_URL]: "| [サツキ] | サツキ | － | ☆☆☆ | 前衛 | 2025/10/10 | 2026/10/09 |\n| [ユキノ] | ユキノ | － |",
  [EVENT_URL]: "| Dearsおかえり | [ハツネ] | [シオリ] | 2025/03/17 |",
};

// 合格する review.json を作る。
function goodReview() {
  return {
    schemaVersion: 1,
    candidateHash: "abc123def456",
    verdict: "approve",
    items: [
      { proposalId: "p1", verdict: "ok", reason: "専用1追加日が今日より前", evidence: [{ sourceUrl: IMPL_URL, quote: "| [サツキ] | サツキ | － | ☆☆☆ | 前衛 | 2025/10/10 | 2026/10/09 |" }] },
      { proposalId: "p2", verdict: "ok", reason: "サイドストーリー追加日が今日より前", evidence: [{ sourceUrl: EVENT_URL, quote: "Dearsおかえり |  [ハツネ]" }] },
    ],
    missing: [],
  };
}

describe("verifyReview", () => {
  it("引用が保存したページに文字どおりあり、全件 ok なら合格する（空白の違いは許す）", () => {
    const result = verifyReview({ packet: packet(), review: goodReview(), pageTexts: PAGE_TEXTS });
    expect(result).toEqual({ ok: true, failures: [], warnings: [] });
  });

  it("捏造・言い換えた引用、短すぎる引用、対象に触れない根拠、出典外の URL を不合格にする", () => {
    const review = goodReview();
    review.items[0].evidence = [
      { sourceUrl: IMPL_URL, quote: "| [サツキ] | サツキ | － | ☆☆☆ | 前衛 | 2025/10/10 | 2026/10/01 |" },
      { sourceUrl: IMPL_URL, quote: "サツキ" },
    ];
    review.items[1].evidence = [
      { sourceUrl: EVENT_URL, quote: "[ハツネ] | [シオリ] | 2025/03/17" },
      { sourceUrl: "https://example.com/", quote: "Dearsおかえり" },
    ];
    const { ok, failures } = verifyReview({ packet: packet(), review, pageTexts: PAGE_TEXTS });
    expect(ok).toBe(false);
    expect(failures).toEqual([
      expect.stringContaining("p1（専用1を実装済みにする: サツキ） 根拠1: 引用が保存したページに見つからない"),
      "p1（専用1を実装済みにする: サツキ） 根拠2: 引用が短すぎる（「サツキ」）",
      "p1（専用1を実装済みにする: サツキ）: 変更の対象（サツキ）を含む根拠がない",
      "p2（サイドストーリーを追加: Dears　おかえり） 根拠2: sourceUrl がこの変更の出典に含まれない（https://example.com/）",
      "p2（サイドストーリーを追加: Dears　おかえり）: 変更の対象（Dears）を含む根拠がない",
    ]);
  });

  it("候補ハッシュの不一致・判定の抜けや重複・存在しない変更への判定・ok 以外の判定を不合格にする", () => {
    const review = goodReview();
    review.candidateHash = "000000000000";
    review.items = [{ ...review.items[0], verdict: "unsure" }, review.items[0], { ...review.items[1], proposalId: "p9" }];
    review.verdict = "reject";
    const { failures } = verifyReview({ packet: packet(), review, pageTexts: PAGE_TEXTS });
    expect(failures).toEqual([
      "候補ハッシュが一致しない（review: 000000000000 / 候補: abc123def456）",
      "p1（専用1を実装済みにする: サツキ）への判定が 2 件（1 件であるべき）",
      "p2（サイドストーリーを追加: Dears　おかえり）への判定が 0 件（1 件であるべき）",
      "存在しない変更への判定がある（p9）",
      "全体の判定が approve でない（reject）",
    ]);
  });

  it("不足の指摘は合否に影響させないが、根拠の引用が実在しなければ不合格にする", () => {
    const review = goodReview();
    review.missing = [{ description: "ユキノの専用1も実装済み", evidence: [{ sourceUrl: IMPL_URL, quote: "| [ユキノ] | ユキノ | － |" }] }];
    expect(verifyReview({ packet: packet(), review, pageTexts: PAGE_TEXTS })).toEqual({
      ok: true,
      failures: [],
      warnings: ["不足の指摘: ユキノの専用1も実装済み"],
    });
    review.missing[0].evidence[0].quote = "| [ユキノ] | ユキノ | 2026/10/09 |";
    expect(verifyReview({ packet: packet(), review, pageTexts: PAGE_TEXTS }).ok).toBe(false);
  });

  it("JSON オブジェクトでない review は不合格にする", () => {
    expect(verifyReview({ packet: packet(), review: null, pageTexts: PAGE_TEXTS }).failures).toEqual(["review.json が JSON オブジェクトでない"]);
  });

  it("引用の照合では空白（全角を含む）の違いだけを許す", () => {
    expect(normalizeForQuote(" a　 b\n c ")).toBe("a b c");
  });
});
