// 解析器のテスト。公開リポジトリに wiki 本文を載せないため、実ページと同じ構造の最小限の HTML を使う。
// 実ページでの確認は snapshot.test.mjs（MASTER_SYNC_SNAPSHOT_DIR を指定したときだけ実行）で行う。
import { describe, expect, it } from "vitest";
import { expandTable, normalizeCharacterName, parseHtml } from "./html.mjs";
import { ATTRIBUTES, parseCategoryPage, parseEventPieces, parseFormation, parseImplementationDates, parseQuestPage } from "./parsers.mjs";

// wiki のページと同じく #content の中に本文を置いた HTML を作る。
function page(body, title = "テスト - wiki") {
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body><div id="content">${body}</div>
<div id="lastmodified">Last-modified: 2026-10-19 (月) 10:37:42</div></body></html>`;
}

// キャラ個別ページへのリンク付きアイコンを作る。
function icon(name) {
  return `<a href="/x" title="キャラクター/${name}" class="rel-wiki-page"><img alt="${name}" title="${name}"></a>`;
}

// 折り畳み（旧版の表）を作る。
function fold(summary, inner) {
  return `<div class="fold-container clearfix"><div class="fold-summary">${summary}</div><div class="fold-content visible-on-open">${inner}</div></div>`;
}

describe("expandTable（結合セルの展開）", () => {
  it("rowspan と colspan が覆う位置すべてに同じセルを置く", () => {
    const document = parseHtml(
      page(`<table>
        <tr><th rowspan="2" colspan="2">イベント名</th><th colspan="2">メモリーピース</th></tr>
        <tr><th>【1】</th><th>【2】</th></tr>
        <tr><td rowspan="2">A</td><td>前編</td><td>x</td><td rowspan="2">y</td></tr>
        <tr><td>後編</td><td>z</td></tr>
      </table>`),
    );
    const grid = expandTable(/** @type {Element} */ (document.querySelector("table")));
    const texts = grid.map((row) => row.map(({ cell }) => cell.textContent));
    expect(texts).toEqual([
      ["イベント名", "イベント名", "メモリーピース", "メモリーピース"],
      ["イベント名", "イベント名", "【1】", "【2】"],
      ["A", "前編", "x", "y"],
      ["A", "後編", "z", "y"],
    ]);
    expect(grid[3][0].origin).toBe(false);
    expect(grid[2][0].origin).toBe(true);
  });
});

describe("normalizeCharacterName", () => {
  it("半角カッコを全角にし、空白を除く", () => {
    expect(normalizeCharacterName("アメス(ガンナー)")).toBe("アメス（ガンナー）");
    expect(normalizeCharacterName(" ペコリーヌ ")).toBe("ペコリーヌ");
  });
});

const IMPLEMENTATION_HEADER =
  "<tr><th>画像(リンク)</th><th>キャラ名</th><th>バージョン</th><th>初期★</th><th>配置</th><th>タイプ</th><th>属性</th><th>ロール</th><th>入手手段</th><th>備考</th><th>キャラ実装</th><th>専用1追加</th><th>専用1SP追加</th><th>専用2追加</th><th>★6追加</th></tr>";

// 実装日一覧の 1 行を作る。link を省くと未実装キャラ（個別ページなし）の形になる。
function implementationRow({ name, version = "－", link = true, attribute = "火", role = "アタッカー", acquisition = "ガチャ(恒常)", dates = ["", "", "", "", ""] }) {
  const linkName = version === "－" ? name : `${name}(${version})`;
  const image = link ? icon(linkName) : `<span class="noexists"><img alt="${linkName}"></span>`;
  return `<tr><th>${image}</th><td>${name}</td><td>${version}</td><td>☆☆☆</td><td>中衛</td><td>物理</td><td>${attribute}</td><td>${role}</td><td>${acquisition}</td><td></td>${dates.map((date) => `<td>${date}</td>`).join("")}</tr>`;
}

describe("parseImplementationDates", () => {
  it("列見出しで値を引き、別衣装はバージョン列から、名前はリンクのページ名からも取る", () => {
    const html = page(
      `<table>${IMPLEMENTATION_HEADER}${implementationRow({ name: "アグライア", link: false, dates: ["2026/10/23", "", "", "", ""] })}${implementationRow({ name: "アメス", version: "ガンナー", dates: ["2026/10/09", "", "", "", ""] })}</table>`,
    );
    const { rows, lastModified } = parseImplementationDates(html);
    expect(lastModified).toBe("2026-10-19 (月) 10:37:42");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ baseName: "アグライア", version: null, linkName: null });
    expect(rows[1]).toMatchObject({ baseName: "アメス", version: "ガンナー", linkName: "アメス(ガンナー)", attribute: "火" });
    expect(rows[1].dates.character).toBe("2026/10/09");
  });

  it("列見出しが変わっていたら構造の変化として例外にする", () => {
    const changed = IMPLEMENTATION_HEADER.replace("★6追加", "星6");
    expect(() => parseImplementationDates(page(`<table>${changed}</table>`))).toThrow(/列見出しが想定と異なります/);
  });
});

// 編成順の 1 配置分（見出し・方向の表記・表）を作る。
function formationSection(section, names, direction = "←後方　　　前方→") {
  return `<h3>${section}</h3><div style="text-align:center"><strong>${direction}</strong></div><div class="nobr"><div class="h-scrollable"><table><tbody><tr><td>${names.map(icon).join("")}</td></tr></tbody></table></div></div>`;
}

describe("parseFormation", () => {
  it("「←後方 前方→」の表は右端が先頭なので反転し、前衛→中衛→後衛の順につなぐ。折り畳み内の旧版は読まない", () => {
    const html = page(
      formationSection("前衛", ["クウカ", "ミヤコ", "リマ"]) +
        formationSection("中衛", ["アユミ", "ネア"]) +
        fold("2025/12/10 の編成順変更まで", "<table><tr><td>" + ["ネア", "アユミ", "旧キャラ"].map(icon).join("") + "</td></tr></table>") +
        formationSection("後衛", ["ユキノ", "アリサ"]),
    );
    const { ordered, sections } = parseFormation(html);
    expect(ordered).toEqual(["リマ", "ミヤコ", "クウカ", "ネア", "アユミ", "アリサ", "ユキノ"]);
    expect(sections.map((section) => section.direction)).toEqual(["back-to-front", "back-to-front", "back-to-front"]);
  });

  it("「←前方 後方→」の表は反転しない", () => {
    const html = page(
      formationSection("前衛", ["リマ", "ミヤコ"], "←前方　後方→") + formationSection("中衛", ["ネア"]) + formationSection("後衛", ["アリサ"]),
    );
    expect(parseFormation(html).ordered).toEqual(["リマ", "ミヤコ", "ネア", "アリサ"]);
  });

  it("掲載方向の表記がなければ例外にする", () => {
    const html = page(formationSection("前衛", ["リマ"], "並び") + formationSection("中衛", ["ネア"]) + formationSection("後衛", ["アリサ"]));
    expect(() => parseFormation(html)).toThrow(/掲載方向が読み取れません/);
  });
});

describe("parseCategoryPage", () => {
  it("見出しごとに表のキャラを集め、ロールのアイコン（リンクでない画像）は数えない", () => {
    const cell = (name) => `<td><a title="キャラクター/${name}"><img alt="${name}"><br><img alt="ブレイカー"></a></td>`;
    const body = ATTRIBUTES.map((attribute) => `<h3>${attribute}属性</h3><table><tr>${cell(`${attribute}キャラ`)}</tr></table>`).join("");
    const { byCategory } = parseCategoryPage(page(body + `<h3>キャラ数による属性ボーナス</h3><table><tr><th>x</th></tr></table>`), ATTRIBUTES);
    expect(byCategory.get("火")).toEqual(["火キャラ"]);
    expect([...byCategory.values()].flat()).toHaveLength(5);
  });
});

// ステージのピース表を作る（HARD は「メモリーピース」、VH は「ピュアメモリーピース」）。
function pieceTable(label, name) {
  return `<table><tr><th colspan="2">${label}</th><td>${icon(name)}</td></tr><tr><th>装備</th><th>[表示]</th><td></td></tr></table>`;
}

describe("parseQuestPage（HARD と VH の区別）", () => {
  it("HARD はメモリーピース、VH はピュアメモリーピースとして読み、ステージ番号と接頭辞を分ける", () => {
    const hard = parseQuestPage(page(`<h3>H81-1</h3>${pieceTable("メモリーピース", "スズナ(編入生)")}<h3>H81-2</h3>${pieceTable("メモリーピース", "アン")}`));
    expect(hard.stages.map(({ stagePrefix, stage, pieceKind, characters }) => [stagePrefix, stage, pieceKind, characters])).toEqual([
      ["H", "81-1", "memory", ["スズナ(編入生)"]],
      ["H", "81-2", "memory", ["アン"]],
    ]);
    const veryHard = parseQuestPage(page(`<h3>VH68-1</h3>${pieceTable("ピュアメモリーピース", "ルカ")}`));
    expect(veryHard.stages[0]).toMatchObject({ stagePrefix: "VH", stage: "68-1", pieceKind: "pure", characters: ["ルカ"] });
  });

  it("「未実装」の見出し以降は未実装とし、同じ見出しの下の 2 つ目の表にはステージ番号を付けない。折り畳み内は読まない", () => {
    const html = page(
      `<h3>H82-1</h3>${pieceTable("メモリーピース", "グレア")}<h3>H82-2 (以下未実装)</h3>${pieceTable("メモリーピース", "プレシア(フォールン)")}${pieceTable("メモリーピース", "キャル")}` +
        fold("H82-3", pieceTable("メモリーピース", "旧データ")),
    );
    const { stages } = parseQuestPage(html);
    expect(stages.map(({ stage, implemented, characters }) => [stage, implemented, characters[0]])).toEqual([
      ["82-1", true, "グレア"],
      ["82-2", false, "プレシア(フォールン)"],
      [null, false, "キャル"],
    ]);
  });
});

describe("parseEventPieces", () => {
  it("結合セルを展開し、前編・後編を別件として、2 人のピースとサイドストーリー追加日を読む", () => {
    const html = page(`<h3>2022年新規</h3><table>
      <tr><th rowspan="2" colspan="2">イベント名</th><th colspan="2">メモリーピース</th><th rowspan="2">サイドストーリー追加</th></tr>
      <tr><th>【1】3箇所</th><th>【2】2箇所</th></tr>
      <tr><td colspan="2"><strong>新春美食メモリーズ<br class="spacer">シェフィのおつかい大作戦！</strong></td><td>${icon("ルカ(ニューイヤー)")}</td><td>${icon("イリヤ")}</td><td>2023/10/16</td></tr>
      <tr><td rowspan="2"><strong>Re:member <br class="spacer">僕の願いが紡ぐ未来</strong></td><td>前編</td><td>${icon("コッコロ")}</td><td>${icon("キャル")}</td><td rowspan="2">2023/11/16</td></tr>
      <tr><td><strong>後編</strong></td><td>${icon("ラビリスタ(オーバーロード)")}</td><td>${icon("ペコリーヌ")}</td></tr>
    </table>`);
    const { events } = parseEventPieces(html);
    expect(events.map(({ event, part, pieces, sideStoryAdded }) => [event, part, pieces, sideStoryAdded])).toEqual([
      ["新春美食メモリーズ　シェフィのおつかい大作戦！", null, ["ルカ(ニューイヤー)", "イリヤ"], "2023/10/16"],
      ["Re:member　僕の願いが紡ぐ未来", "前編", ["コッコロ", "キャル"], "2023/11/16"],
      ["Re:member　僕の願いが紡ぐ未来", "後編", ["ラビリスタ(オーバーロード)", "ペコリーヌ"], "2023/11/16"],
    ]);
  });
});
