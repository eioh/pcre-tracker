// 取得したページ（wikiwiki.jp の HTML）を解析するための共通処理。
// 本文は信頼しない入力なので、スクリプトは実行せず DOM として読むだけにする。
import { JSDOM } from "jsdom";

// HTML 文字列を DOM の document にする（スクリプトは実行しない）。
export function parseHtml(html) {
  return new JSDOM(html).window.document;
}

// wiki 本文の領域（#content）を返す。見つからなければページ構造の変化とみなして例外にする。
export function getContent(document) {
  const content = document.querySelector("#content");
  if (!content) {
    throw new Error("本文の領域（#content）が見つかりません。ページ構造が変わった可能性があります");
  }
  return content;
}

// 要素の表示テキストを、連続する空白を 1 つにまとめて返す。
export function cellText(element) {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

// 要素が折り畳み（旧版の表など）の中にあるかを返す。
export function isInsideFold(element) {
  return Boolean(element.closest(".fold-content, details"));
}

/**
 * 表の結合セル（rowspan / colspan）を展開し、行×列の格子にする。
 * 結合されたセルは、覆うすべての位置に同じ要素が入る。origin は元のセルの左上の位置かどうか。
 * @returns {{ cell: Element, origin: boolean }[][]}
 */
export function expandTable(table) {
  /** @type {{ cell: Element, origin: boolean }[][]} */
  const grid = [];
  const rows = [...table.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr, :scope > tr")];
  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ??= [];
    let columnIndex = 0;
    for (const cell of row.children) {
      if (cell.tagName !== "TD" && cell.tagName !== "TH") {
        continue;
      }
      // 上の行から伸びてきた結合セルが埋めている位置は飛ばす。
      while (grid[rowIndex][columnIndex]) {
        columnIndex += 1;
      }
      const rowSpan = Math.max(1, Number(cell.getAttribute("rowspan")) || 1);
      const colSpan = Math.max(1, Number(cell.getAttribute("colspan")) || 1);
      for (let dy = 0; dy < rowSpan; dy += 1) {
        grid[rowIndex + dy] ??= [];
        for (let dx = 0; dx < colSpan; dx += 1) {
          grid[rowIndex + dy][columnIndex + dx] = { cell, origin: dy === 0 && dx === 0 };
        }
      }
      columnIndex += colSpan;
    }
  });
  // rowspan が表の末尾を越えて作った余分な行は捨てる。
  return grid.slice(0, rows.length);
}

// 要素の前にある直近の見出し（h2〜h4）を返す。content 内を文書順にたどって探す。
export function precedingHeading(content, element) {
  let heading = null;
  for (const candidate of content.querySelectorAll("h2, h3, h4, table")) {
    if (candidate === element || candidate.contains(element)) {
      break;
    }
    if (candidate.tagName !== "TABLE") {
      heading = candidate;
    }
  }
  return heading;
}

// wiki のキャラ名を、マスターデータの表記（別衣装は全角カッコ）にそろえる。
export function normalizeCharacterName(name) {
  return name
    .normalize("NFC")
    .replace(/\s+/g, "")
    .replace(/\(/g, "（")
    .replace(/\)/g, "）");
}

const CHARACTER_PAGE_PREFIX = "キャラクター/";

// キャラ個別ページへのリンク（title="キャラクター/名前"）からキャラ名を取り出す。リンクでなければ null。
export function characterNameFromLink(anchor) {
  const title = anchor.getAttribute("title") ?? "";
  if (!title.startsWith(CHARACTER_PAGE_PREFIX)) {
    return null;
  }
  const name = title.slice(CHARACTER_PAGE_PREFIX.length);
  // 個別ページの下位ページ（例: キャラクター/名前/専用装備）は対象外。
  return name.includes("/") ? null : name;
}

// 要素内のキャラ個別ページへのリンクから、キャラ名を出現順に（重複を除いて）取り出す。
export function characterNamesIn(element) {
  const names = [];
  for (const anchor of element.querySelectorAll("a[title]")) {
    const name = characterNameFromLink(anchor);
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}
