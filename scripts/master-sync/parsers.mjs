// 取得元ページごとの解析器。ページの表を読み、正規化前のキャラ名・日付・区分などを取り出す。
// 想定した見出し・列が見つからない場合は、ページ構造が変わったとみなして例外にする（推測で読み進めない）。
// 本文は信頼しない入力なので、文字列は値として扱うだけで、指示として解釈しない。
import {
  cellText,
  characterNameFromLink,
  characterNamesIn,
  expandTable,
  getContent,
  isInsideFold,
  parseHtml,
  precedingHeading,
} from "./html.mjs";

export const ATTRIBUTES = ["火", "水", "風", "光", "闇"];
export const ROLES = ["アタッカー", "タンク", "ヒーラー", "バッファー", "デバッファー", "ブレイカー", "ブースター", "ジャマー"];

// ページ下部などに表示される「最終更新」の日時を取り出す（報告用。見つからなければ null）。
export function parseLastModified(document) {
  const match = /Last-modified:\s*([0-9-]+\s*\([^)]*\)\s*[0-9:]+)/.exec(document.body?.textContent ?? "");
  return match ? match[1].replace(/\s+/g, " ") : null;
}

// 実装日一覧の列見出し。この並びでなければ構造の変化とみなす。
const IMPLEMENTATION_HEADERS = [
  "画像(リンク)",
  "キャラ名",
  "バージョン",
  "初期★",
  "配置",
  "タイプ",
  "属性",
  "ロール",
  "入手手段",
  "備考",
  "キャラ実装",
  "専用1追加",
  "専用1SP追加",
  "専用2追加",
  "★6追加",
];

/**
 * 実装日一覧（キャラクター/追加・強化年月日順）を解析する。
 * キャラ名は「キャラ名」列と「バージョン」列から組み立て、画像リンクのページ名（あれば）も残して照合に使う。
 */
export function parseImplementationDates(html) {
  const document = parseHtml(html);
  const content = getContent(document);
  const tables = [...content.querySelectorAll("table")].filter((table) => !isInsideFold(table));
  const table = tables.find((candidate) => cellText(candidate.querySelector("tr")).startsWith("画像(リンク)"));
  if (!table) {
    throw new Error("実装日一覧の表が見つかりません");
  }
  const grid = expandTable(table);
  const headers = grid[0].map(({ cell }) => cellText(cell));
  if (headers.join("|") !== IMPLEMENTATION_HEADERS.join("|")) {
    throw new Error(`実装日一覧の列見出しが想定と異なります: ${headers.join(" / ")}`);
  }
  const rows = grid.slice(1).map((row, index) => {
    // 列見出しから値を引く。
    const value = (header) => cellText(row[IMPLEMENTATION_HEADERS.indexOf(header)].cell);
    const linkCell = row[0].cell;
    const link = [...linkCell.querySelectorAll("a[title]")].map(characterNameFromLink).find(Boolean) ?? null;
    const baseName = value("キャラ名");
    const version = value("バージョン");
    return {
      rowIndex: index + 1,
      baseName,
      version: version === "－" || version === "-" || version === "" ? null : version,
      linkName: link,
      initialStar: value("初期★"),
      position: value("配置"),
      attackType: value("タイプ"),
      attribute: value("属性"),
      role: value("ロール"),
      acquisition: value("入手手段"),
      note: value("備考"),
      dates: {
        character: value("キャラ実装"),
        ue1: value("専用1追加"),
        ue1Sp: value("専用1SP追加"),
        ue2: value("専用2追加"),
        star6: value("★6追加"),
      },
    };
  });
  return { lastModified: parseLastModified(document), rows };
}

// 編成順ページの配置見出し（前方から順）。
const FORMATION_SECTIONS = ["前衛", "中衛", "後衛"];

/**
 * 編成順（隊列）ページを解析し、前方（先頭）から後方へ並べたキャラ名の配列を返す。
 * 各配置の表の直前にある「←後方 前方→」の表記で掲載方向を確かめ、折り畳み内の旧版の表は読まない。
 */
export function parseFormation(html) {
  const document = parseHtml(html);
  const content = getContent(document);
  /** @type {{ section: string, names: string[], direction: string }[]} */
  const sections = [];
  for (const table of content.querySelectorAll("table")) {
    if (isInsideFold(table)) {
      continue;
    }
    const heading = cellText(precedingHeading(content, table));
    if (!FORMATION_SECTIONS.includes(heading)) {
      continue;
    }
    if (sections.some((entry) => entry.section === heading)) {
      throw new Error(`編成順の「${heading}」に折り畳み外の表が複数あります`);
    }
    // 表を包む要素の直前にある方向の表記を探す。
    let wrapper = table;
    while (wrapper.parentElement && wrapper.parentElement !== content && !wrapper.previousElementSibling) {
      wrapper = wrapper.parentElement;
    }
    const directionText = cellText(wrapper.previousElementSibling).replace(/\s+/g, "");
    let direction;
    if (/^←後方.*前方→$/.test(directionText)) {
      direction = "back-to-front";
    } else if (/^←前方.*後方→$/.test(directionText)) {
      direction = "front-to-back";
    } else {
      throw new Error(`編成順「${heading}」の掲載方向が読み取れません: ${directionText}`);
    }
    const listed = characterNamesIn(table);
    sections.push({ section: heading, names: direction === "back-to-front" ? listed.reverse() : listed, direction });
  }
  for (const section of FORMATION_SECTIONS) {
    if (!sections.some((entry) => entry.section === section)) {
      throw new Error(`編成順の「${section}」の表が見つかりません`);
    }
  }
  const ordered = FORMATION_SECTIONS.flatMap((section) => sections.find((entry) => entry.section === section)?.names ?? []);
  return { lastModified: parseLastModified(document), sections, ordered };
}

/**
 * 属性別・ロール別のページを解析し、区分名→キャラ名の一覧を返す。
 * 見出し（h3）が区分名に一致する節の、折り畳み外の表だけを読む。
 * @param {string} html
 * @param {string[]} categories 区分名の一覧（ATTRIBUTES または ROLES）
 */
export function parseCategoryPage(html, categories) {
  const document = parseHtml(html);
  const content = getContent(document);
  /** @type {Map<string, string[]>} */
  const byCategory = new Map(categories.map((category) => [category, []]));
  for (const table of content.querySelectorAll("table")) {
    if (isInsideFold(table)) {
      continue;
    }
    const heading = cellText(precedingHeading(content, table));
    const category = categories.find((candidate) => heading === candidate || heading === `${candidate}属性`);
    if (!category) {
      continue;
    }
    const names = byCategory.get(category) ?? [];
    for (const name of characterNamesIn(table)) {
      if (!names.includes(name)) {
        names.push(name);
      }
    }
    byCategory.set(category, names);
  }
  for (const [category, names] of byCategory) {
    if (names.length === 0) {
      throw new Error(`「${category}」の表が見つからないか空です`);
    }
  }
  return { lastModified: parseLastModified(document), byCategory };
}

/**
 * HARD / VERY HARD のステージ攻略ページを解析する。
 * - 各ステージの「メモリーピース」表（VH は「ピュアメモリーピース」）からキャラ名を取る。表の見出しで HARD と VH を区別する。
 * - 見出しに「未実装」を含む節以降のステージは未実装として扱う（ステージ番号の見出しがないこともある）。
 */
export function parseQuestPage(html) {
  const document = parseHtml(html);
  const content = getContent(document);
  const title = cellText(document.querySelector("title"));
  /** @type {{ stage: string | null, pieceKind: "memory" | "pure", characters: string[], implemented: boolean, heading: string }[]} */
  const stages = [];
  let unimplementedFromHere = false;
  let lastHeadingElement = null;
  for (const table of content.querySelectorAll("table")) {
    if (isInsideFold(table)) {
      continue;
    }
    const firstHeader = cellText(table.querySelector("th"));
    if (firstHeader !== "メモリーピース" && firstHeader !== "ピュアメモリーピース") {
      continue;
    }
    const headingElement = precedingHeading(content, table);
    const heading = cellText(headingElement);
    if (/未実装/.test(heading)) {
      unimplementedFromHere = true;
    }
    // 同じ見出しの下に 2 つ目のピース表が来たら、見出しのないステージとみなす。
    const stageMatch = /^(V?H)(\d+-\d+)/.exec(heading);
    const isNewHeading = headingElement !== lastHeadingElement;
    lastHeadingElement = headingElement;
    const pieceCell = table.querySelector("tr td");
    stages.push({
      stage: isNewHeading && stageMatch ? stageMatch[2] : null,
      stagePrefix: stageMatch ? stageMatch[1] : null,
      pieceKind: firstHeader === "メモリーピース" ? "memory" : "pure",
      characters: pieceCell ? characterNamesOrAlts(pieceCell) : [],
      implemented: !unimplementedFromHere,
      heading,
    });
  }
  return { title, lastModified: parseLastModified(document), stages };
}

// セル内のキャラ名を、個別ページへのリンクがあればそこから、なければ画像の alt から取る。
function characterNamesOrAlts(cell) {
  const linked = characterNamesIn(cell);
  if (linked.length > 0) {
    return linked;
  }
  return [...cell.querySelectorAll("img[alt]")].map((image) => image.getAttribute("alt") ?? "").filter(Boolean);
}

/**
 * イベントで配布されたピースのページを解析する。
 * 列見出しに「【1】3箇所」「【2】2箇所」「サイドストーリー追加」を持つ表を、結合セルを展開して 1 行ずつ読む。
 * 前編・後編などの分割は「イベント名」列の 2 列目から取り、分割ごとに 1 件とする。
 */
export function parseEventPieces(html) {
  const document = parseHtml(html);
  const content = getContent(document);
  /** @type {{ event: string, part: string | null, pieces: string[], sideStoryAdded: string, section: string }[]} */
  const events = [];
  for (const table of content.querySelectorAll("table")) {
    if (isInsideFold(table)) {
      continue;
    }
    const grid = expandTable(table);
    if (grid.length < 3) {
      continue;
    }
    const subHeaders = grid[1].map(({ cell }) => cellText(cell));
    const piece1 = subHeaders.indexOf("【1】3箇所");
    const piece2 = subHeaders.indexOf("【2】2箇所");
    const side = grid[0].findIndex(({ cell }) => cellText(cell) === "サイドストーリー追加");
    if (piece1 < 0 || piece2 < 0 || side < 0) {
      continue;
    }
    const nameColumns = grid[0].map(({ cell }, index) => (cellText(cell) === "イベント名" ? index : -1)).filter((index) => index >= 0);
    const section = cellText(precedingHeading(content, table));
    for (const row of grid.slice(2)) {
      const nameCell = row[nameColumns[0]].cell;
      // 2 列目が別のセルなら分割名（前編・後編など）。
      const partCell = nameColumns.length > 1 && row[nameColumns[1]].cell !== nameCell ? row[nameColumns[1]].cell : null;
      events.push({
        event: eventNameText(nameCell),
        part: partCell ? cellText(partCell) : null,
        pieces: [...characterNamesOrAlts(row[piece1].cell), ...characterNamesOrAlts(row[piece2].cell)],
        sideStoryAdded: cellText(row[side].cell),
        section,
      });
    }
  }
  if (events.length === 0) {
    throw new Error("イベントのピース表が見つかりません");
  }
  return { lastModified: parseLastModified(document), events };
}

// イベント名のセルから、改行（<br>）を全角スペースに置き換えた名前を作る。
function eventNameText(cell) {
  const clone = cell.cloneNode(true);
  for (const br of clone.querySelectorAll("br")) {
    br.replaceWith("　");
  }
  return (clone.textContent ?? "").replace(/[ \t\r\n]+/g, " ").replace(/ ?　 ?/g, "　").trim();
}
