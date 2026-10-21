// 解析結果を既存マスター全件と比較し、変更候補（proposals）・保留（holds）・参考情報（notes）に分ける。
// 判定規則はここで機械的に適用する（AI の判断だけに依存しない）。
// - 値は「真・偽・不明」の 3 値で扱い、空欄や取得失敗は不明とする。不明を理由に false 化・削除はしない。
// - 削除や true→false の変化は自動反映せず、すべて保留にする。
// - 日付は日本時間の今日と比べ、未来日・「近日予定」は未実装、当日は翌日に再確認（保留）とする。
// - 別名表にも既存マスターにもない名前は保留にする。
import { normalizeCharacterName } from "./html.mjs";
import { ATTRIBUTES, ROLES } from "./parsers.mjs";

// 取得件数が既存件数のこの割合を下回ったら、取得失敗かページ構造の変化とみなして全体を保留にする。
export const MIN_COUNT_RATIO = 0.9;

// 実装日一覧の入手手段から限定キャラかどうかを決める表。表にない値は不明とする。
export const LIMITED_BY_ACQUISITION = {
  "ガチャ(期間限定)": true,
  "ガチャ(フェス限定)": true,
  イベント限定: true,
  エクストラキャラ: true,
  "ガチャ(恒常)": false,
  ミッション: false,
  初期加入: false,
};

// 実装日一覧の日付列と、マスターの implemented のキーの対応。
const FEATURE_KEYS = /** @type {const} */ (["ue1", "ue1Sp", "ue2", "star6"]);
const FEATURE_LABELS = { ue1: "専用1", ue1Sp: "専用1SP", ue2: "専用2", star6: "★6" };

/**
 * 日付の文字列を、日本時間の今日（YYYY-MM-DD）と比べて分類する。
 * - released: 今日より前（実装済み）
 * - today: 今日（時刻が不明なので翌日に再確認）
 * - planned: 未来日・「予定」の表記
 * - unknown: 空欄
 * - unparseable: 読み取れない表記
 * @returns {{ status: "released" | "today" | "planned" | "unknown" | "unparseable", date: string | null }}
 */
export function classifyDate(text, today) {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") {
    return { status: "unknown", date: null };
  }
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(trimmed);
  if (match) {
    const date = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    if (date < today) {
      return { status: "released", date };
    }
    return { status: date === today ? "today" : "planned", date };
  }
  if (/予定|未定/.test(trimmed)) {
    return { status: "planned", date: null };
  }
  return { status: "unparseable", date: null };
}

// 日本時間の今日の日付（YYYY-MM-DD）を返す。
export function todayInJst(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 別名表を引いてから正規化し、マスターの表記にそろえる。
export function resolveName(rawName, aliases) {
  const normalized = normalizeCharacterName(rawName);
  return aliases[normalized] ?? aliases[rawName] ?? normalized;
}

// イベント名を照合用のキーにする（空白・ふりがなのカッコ書きを除き、全角半角をそろえる）。
export function eventKey(event, part) {
  // 照合に影響しない表記の違いを取り除く。
  const simplify = (text) =>
    text
      .normalize("NFKC")
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+/g, "");
  return simplify(event) + (part ? simplify(part) : "");
}

// 2 つの配列の最長共通部分列に入らない要素（並び替えで動いた要素）を返す。
function movedElements(expected, actual) {
  const n = expected.length;
  const m = actual.length;
  /** @type {number[][]} */
  const table = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = expected[i] === actual[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const kept = new Set();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === actual[j]) {
      kept.add(expected[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return expected.filter((name) => !kept.has(name));
}

/**
 * 利用者が確認済みで、マスターの値を正とする差分（acknowledged.json）。
 * - limited: マスターの値と、そのときの入手手段が一致する間だけ保留から外す（どちらかが変われば再び保留に出す）
 * - formationOrder: マスターの位置を正とするキャラ。編成順の並び替えの判定と挿入位置の基準から外す
 * @typedef {{
 *   limited: { name: string, masterValue: boolean, acquisition: string, reason: string }[],
 *   formationOrder: { name: string, reason: string }[],
 * }} Acknowledged
 */
const EMPTY_ACKNOWLEDGED = { limited: [], formationOrder: [] };

/**
 * 比較結果の 1 件。
 * @typedef {{ area: string, target: string, kind: string, detail: string, before?: unknown, after?: unknown, sources: string[] }} Finding
 */

/**
 * 解析済みの取得結果と既存マスターを比較する。
 * @param {{
 *   master: import("./integrity.mjs").ExistingMaster,
 *   parsed: {
 *     implementation: ReturnType<typeof import("./parsers.mjs").parseImplementationDates>,
 *     formation: ReturnType<typeof import("./parsers.mjs").parseFormation>,
 *     attribute: ReturnType<typeof import("./parsers.mjs").parseCategoryPage>,
 *     role: ReturnType<typeof import("./parsers.mjs").parseCategoryPage>,
 *     hardQuests: { sourceId: string, page: ReturnType<typeof import("./parsers.mjs").parseQuestPage> }[],
 *     veryHardQuests: { sourceId: string, page: ReturnType<typeof import("./parsers.mjs").parseQuestPage> }[],
 *     eventPieces: ReturnType<typeof import("./parsers.mjs").parseEventPieces>,
 *   },
 *   urls: Record<string, string>,
 *   aliases: Record<string, string>,
 *   acknowledged?: Acknowledged,
 *   today: string,
 * }} input
 */
export function compareWithMaster({ master, parsed, urls, aliases, acknowledged = EMPTY_ACKNOWLEDGED, today }) {
  /** @type {Finding[]} */
  const proposals = [];
  /** @type {Finding[]} */
  const holds = [];
  /** @type {Finding[]} */
  const notes = [];
  /** @type {string[]} */
  const globalHoldReasons = [];
  const masterByName = new Map(master.characters.map((character) => [character.name, character]));
  const url = (id) => urls[id] ?? id;

  // ---- 件数の検査（取得失敗・構造変化の検出） ----
  // 取得件数が既存件数を大きく下回っていないかを確かめる。
  const checkCount = (label, actual, expected) => {
    if (actual < expected * MIN_COUNT_RATIO) {
      globalHoldReasons.push(`${label}の件数（${actual}）が既存（${expected}）を大きく下回っています。取得失敗かページ構造の変化とみなします`);
    }
  };
  checkCount("実装日一覧", parsed.implementation.rows.length, master.characters.length);
  checkCount("編成順", parsed.formation.ordered.length, master.formationOrder.length);
  checkCount("属性別", [...parsed.attribute.byCategory.values()].flat().length, master.characters.length);
  checkCount("ロール別", [...parsed.role.byCategory.values()].flat().length, master.characters.length);
  checkCount("イベントのピース", parsed.eventPieces.events.length, master.sideStory.length);

  // ---- 属性・ロールのページを名前→区分の表にする ----
  /** @type {(page: { byCategory: Map<string, string[]> }) => Map<string, string[]>} */
  const categoryMap = (page) => {
    /** @type {Map<string, string[]>} */
    const map = new Map();
    for (const [category, names] of page.byCategory) {
      for (const raw of names) {
        const name = resolveName(raw, aliases);
        map.set(name, [...(map.get(name) ?? []), category]);
      }
    }
    return map;
  };
  const attributeByName = categoryMap(parsed.attribute);
  const roleByName = categoryMap(parsed.role);
  const formationNames = parsed.formation.ordered.map((raw) => resolveName(raw, aliases));

  // ---- 実装日一覧（キャラ・専用装備・★6・属性・ロール・限定） ----
  const seenInImplementation = new Set();
  for (const row of parsed.implementation.rows) {
    const columnName = `${row.baseName}${row.version ? `(${row.version})` : ""}`;
    const name = resolveName(row.linkName ?? columnName, aliases);
    seenInImplementation.add(name);
    const source = [url("implementation-dates")];
    const characterDate = classifyDate(row.dates.character, today);
    const existing = masterByName.get(name);

    if (!existing) {
      if (characterDate.status !== "released") {
        notes.push({
          area: "キャラ",
          target: name,
          kind: "未実装（予定）",
          detail: `キャラ実装日: ${row.dates.character || "空欄"}（${characterDate.status}）`,
          sources: source,
        });
        continue;
      }
      // 新キャラ候補。必要な値がすべてそろい、複数の取得元で一致した場合だけ候補にする。
      const reasons = [];
      if (!row.linkName) {
        reasons.push("個別ページへのリンクがなく、名前を確定できない");
      }
      const attributePages = attributeByName.get(name) ?? [];
      const rolePages = roleByName.get(name) ?? [];
      if (!ATTRIBUTES.includes(row.attribute) || attributePages.length !== 1 || attributePages[0] !== row.attribute) {
        reasons.push(`属性が一致しない（実装日一覧: ${row.attribute || "空欄"} / 属性ページ: ${attributePages.join("・") || "未掲載"}）`);
      }
      if (!ROLES.includes(row.role) || rolePages.length !== 1 || rolePages[0] !== row.role) {
        reasons.push(`ロールが一致しない（実装日一覧: ${row.role || "空欄"} / ロールページ: ${rolePages.join("・") || "未掲載"}）`);
      }
      const limited = LIMITED_BY_ACQUISITION[row.acquisition];
      if (limited === undefined) {
        reasons.push(`入手手段「${row.acquisition}」から限定区分を決められない`);
      }
      if (!formationNames.includes(name)) {
        reasons.push("編成順ページに未掲載");
      }
      const implemented = Object.fromEntries(FEATURE_KEYS.map((key) => [key, classifyDate(row.dates[key], today).status === "released"]));
      const candidate = {
        name,
        baseName: normalizeCharacterName(row.baseName),
        limited,
        attribute: row.attribute,
        role: row.role,
        implemented,
      };
      const finding = {
        area: "キャラ",
        target: name,
        kind: "新キャラ追加",
        detail: `キャラ実装日 ${characterDate.date}、入手手段 ${row.acquisition}`,
        after: candidate,
        sources: [url("implementation-dates"), url("attribute"), url("role"), url("formation")],
      };
      if (reasons.length > 0) {
        holds.push({ ...finding, detail: `${finding.detail}。保留理由: ${reasons.join("、")}` });
      } else {
        proposals.push(finding);
      }
      continue;
    }

    // 既存キャラの専用装備・★6。false→true だけを候補にし、true 側の不一致は保留にする。
    for (const key of FEATURE_KEYS) {
      const date = classifyDate(row.dates[key], today);
      const current = existing.implemented[key];
      const label = FEATURE_LABELS[key];
      if (!current && date.status === "released") {
        proposals.push({
          area: "実装状況",
          target: name,
          kind: `${label}を実装済みにする`,
          detail: `${label}追加日 ${date.date}`,
          before: false,
          after: true,
          sources: source,
        });
      } else if (current && date.status !== "released") {
        holds.push({
          area: "実装状況",
          target: name,
          kind: `${label}: マスターは実装済みだが一覧では未確認`,
          detail: `${label}追加日: ${row.dates[key] || "空欄"}（${date.status}）。true→false は自動反映しない`,
          sources: source,
        });
      } else if (date.status === "today" || date.status === "unparseable") {
        holds.push({
          area: "実装状況",
          target: name,
          kind: `${label}: 日付を判定できない`,
          detail: `${label}追加日: ${row.dates[key]}（${date.status === "today" ? "当日のため翌日に再確認" : "読み取れない表記"}）`,
          sources: source,
        });
      } else if (!current && date.status === "planned") {
        notes.push({
          area: "実装状況",
          target: name,
          kind: `${label}は予定`,
          detail: `${label}追加日: ${row.dates[key]}`,
          sources: source,
        });
      }
    }

    // 既存キャラの属性・ロール。マスターと違えば、取得元どうしが一致していても既存値の変更なので保留にする。
    for (const [label, key, pageMap, allowed] of /** @type {const} */ ([
      ["属性", "attribute", attributeByName, ATTRIBUTES],
      ["ロール", "role", roleByName, ROLES],
    ])) {
      const fromList = row[key];
      const fromPage = pageMap.get(name) ?? [];
      const agreed = allowed.includes(fromList) && fromPage.length === 1 && fromPage[0] === fromList;
      if (agreed && fromList === existing[key]) {
        continue;
      }
      holds.push({
        area: label,
        target: name,
        kind: `${label}の不一致`,
        detail: `マスター: ${existing[key]} / 実装日一覧: ${fromList || "空欄"} / ${label}ページ: ${fromPage.join("・") || "未掲載"}${agreed ? "（取得元どうしは一致）" : ""}`,
        sources: [url("implementation-dates"), url(key)],
      });
    }

    // 既存キャラの限定区分。既存値の変更は自動反映しない。
    const limited = LIMITED_BY_ACQUISITION[row.acquisition];
    const limitedAcknowledgement = acknowledged.limited.find(
      (entry) => entry.name === name && entry.masterValue === existing.limited && entry.acquisition === row.acquisition,
    );
    if (limited !== undefined && limited !== existing.limited && limitedAcknowledgement) {
      notes.push({
        area: "限定区分",
        target: name,
        kind: "確認済みの差分（マスターを正とする）",
        detail: `マスター: limited=${existing.limited} / 入手手段: ${row.acquisition}。${limitedAcknowledgement.reason}`,
        sources: source,
      });
    } else if (limited !== undefined && limited !== existing.limited) {
      holds.push({
        area: "限定区分",
        target: name,
        kind: "限定区分の不一致",
        detail: `マスター: limited=${existing.limited} / 実装日一覧の入手手段: ${row.acquisition}${row.note ? `（${row.note}）` : ""}`,
        sources: source,
      });
    } else if (limited === undefined) {
      holds.push({
        area: "限定区分",
        target: name,
        kind: "入手手段を判定できない",
        detail: `入手手段: ${row.acquisition || "空欄"}`,
        sources: source,
      });
    }
  }
  for (const character of master.characters) {
    if (!seenInImplementation.has(character.name)) {
      holds.push({
        area: "キャラ",
        target: character.name,
        kind: "実装日一覧に見つからない既存キャラ",
        detail: "削除は提案しない。名前の表記揺れか一覧の欠落を確認する",
        sources: [url("implementation-dates")],
      });
    }
  }

  // ---- 編成順 ----
  // マスターの位置を正とする確認済みのキャラは、並び替えの判定と挿入位置の基準から外す。
  const acknowledgedOrder = new Map(acknowledged.formationOrder.map((entry) => [entry.name, entry.reason]));
  const masterOrderSet = new Set(master.formationOrder);
  const comparableOrder = master.formationOrder.filter((name) => !acknowledgedOrder.has(name));
  const comparableSet = new Set(comparableOrder);
  const existingInWiki = formationNames.filter((name) => comparableSet.has(name));
  const moved = movedElements(comparableOrder, existingInWiki);
  for (const [name, reason] of acknowledgedOrder) {
    notes.push({
      area: "編成順",
      target: name,
      kind: "確認済みの差分（マスターの位置を正とする）",
      detail: reason,
      sources: [url("formation")],
    });
  }
  const missingInWiki = master.formationOrder.filter((name) => !formationNames.includes(name));
  const newInWiki = formationNames.filter((name) => !masterOrderSet.has(name));
  if (moved.length > 0) {
    holds.push({
      area: "編成順",
      target: moved.join("、"),
      kind: "既存キャラの並び替え",
      detail: `既存キャラ ${moved.length} 人の相対順が変わっています。並び替えは自動反映しない`,
      sources: [url("formation")],
    });
  }
  for (const name of missingInWiki) {
    holds.push({
      area: "編成順",
      target: name,
      kind: "編成順ページに見つからない既存キャラ",
      detail: "削除は提案しない",
      sources: [url("formation")],
    });
  }
  for (const name of newInWiki) {
    const index = formationNames.indexOf(name);
    const before = formationNames.slice(0, index).reverse().find((candidate) => comparableSet.has(candidate)) ?? null;
    const after = formationNames.slice(index + 1).find((candidate) => comparableSet.has(candidate)) ?? null;
    const finding = {
      area: "編成順",
      target: name,
      kind: "編成順に挿入",
      detail: `${before ?? "（先頭）"} の後ろ、${after ?? "（末尾）"} の前`,
      after: { insertAfter: before, insertBefore: after },
      sources: [url("formation")],
    };
    const isCandidate = proposals.some((proposal) => proposal.kind === "新キャラ追加" && proposal.target === name);
    if (moved.length === 0 && isCandidate) {
      proposals.push(finding);
    } else {
      holds.push({
        ...finding,
        detail: `${finding.detail}。保留理由: ${moved.length > 0 ? "既存キャラの並び替えがある" : "新キャラ候補になっていない"}`,
      });
    }
  }

  // ---- HARD のメモリーピース（VH のピュアメモリーピースとは混同しない） ----
  const candidateNames = new Set(proposals.filter((proposal) => proposal.kind === "新キャラ追加").map((proposal) => proposal.target));
  for (const { sourceId, page } of parsed.hardQuests) {
    for (const stage of page.stages) {
      if (stage.pieceKind !== "memory" || stage.stagePrefix !== "H") {
        holds.push({
          area: "HARD",
          target: stage.heading,
          kind: "HARD ページに HARD 以外の表",
          detail: `表の種類: ${stage.pieceKind === "pure" ? "ピュアメモリーピース" : "メモリーピース"} / 見出し: ${stage.heading}`,
          sources: [url(sourceId)],
        });
        continue;
      }
      if (!stage.implemented || !stage.stage) {
        notes.push({ area: "HARD", target: stage.heading, kind: "未実装のステージ", detail: stage.characters.join("、"), sources: [url(sourceId)] });
        continue;
      }
      const names = stage.characters.map((raw) => resolveName(raw, aliases));
      const current = master.hardQuest[stage.stage];
      if (names.length !== 1) {
        holds.push({
          area: "HARD",
          target: stage.stage,
          kind: "ピースのキャラを 1 人に決められない",
          detail: `読み取ったキャラ: ${names.join("、") || "なし"}`,
          sources: [url(sourceId)],
        });
      } else if (current === undefined) {
        const known = masterByName.has(names[0]) || candidateNames.has(names[0]);
        (known ? proposals : holds).push({
          area: "HARD",
          target: stage.stage,
          kind: "HARD ステージを追加",
          detail: known ? `${stage.stage}: ${names[0]}` : `${stage.stage}: ${names[0]}。保留理由: マスターにも新キャラ候補にもない名前`,
          after: names[0],
          sources: [url(sourceId)],
        });
      } else if (current !== names[0]) {
        holds.push({
          area: "HARD",
          target: stage.stage,
          kind: "既存ステージのキャラが異なる",
          detail: `マスター: ${current} / wiki: ${names[0]}`,
          sources: [url(sourceId)],
        });
      }
    }
  }
  for (const { sourceId, page } of parsed.veryHardQuests) {
    const pureStages = page.stages.filter((stage) => stage.pieceKind === "pure" && stage.stagePrefix === "VH");
    if (pureStages.length !== page.stages.length) {
      holds.push({
        area: "VH",
        target: page.title,
        kind: "VH ページにピュアメモリーピース以外の表",
        detail: "HARD との混同を避けるため、この取得元は使わない",
        sources: [url(sourceId)],
      });
    }
    notes.push({
      area: "VH",
      target: page.title,
      kind: "VH（ピュアメモリーピース）は照合のみ",
      detail: pureStages.map((stage) => `${stage.stage}: ${stage.characters.join("、")}`).join(" / "),
      sources: [url(sourceId)],
    });
  }

  // ---- サイドストーリー（イベントで配布されたピース） ----
  const masterEvents = new Map(master.sideStory.map((entry) => [eventKey(entry.event, null), entry]));
  const matchedMasterKeys = new Set();
  /** @type {Map<string, string>} 照合できた既存イベント名 → サイドストーリー追加日（YYYY-MM-DD） */
  const masterSideDates = new Map();
  /** @type {{ finding: Finding, date: string }[]} */
  const sideStoryAdditions = [];
  for (const event of parsed.eventPieces.events) {
    const displayName = event.part ? `${event.event} ${event.part}` : event.event;
    // マスターが前編・後編を分けずに 1 件で持っている場合に備え、分割名なしのキーでも照合する。
    const partKey = eventKey(event.event, event.part);
    const key = masterEvents.has(partKey) || !event.part ? partKey : eventKey(event.event, null);
    const entry = masterEvents.get(key);
    const side = classifyDate(event.sideStoryAdded, today);
    const pieces = event.pieces.map((raw) => resolveName(raw, aliases));
    const source = [url("event-pieces")];
    if (entry) {
      matchedMasterKeys.add(key);
      if (side.date && !masterSideDates.has(entry.event)) {
        masterSideDates.set(entry.event, side.date);
      }
      if (side.status !== "released") {
        holds.push({
          area: "サイドストーリー",
          target: entry.event,
          kind: "マスターにあるがサイドストーリー追加日が未確認",
          detail: `サイドストーリー追加: ${event.sideStoryAdded || "空欄"}（${side.status}）。削除は提案しない`,
          sources: source,
        });
      }
      const sameSet = pieces.length === entry.characters.length && pieces.every((name) => entry.characters.includes(name));
      if (!sameSet) {
        holds.push({
          area: "サイドストーリー",
          target: entry.event,
          kind: "対象キャラの不一致",
          detail: `マスター: ${entry.characters.join("、")} / wiki: ${pieces.join("、")}`,
          before: entry.characters,
          after: pieces,
          sources: source,
        });
      }
      continue;
    }
    if (side.status === "released") {
      const unknown = pieces.filter((name) => !masterByName.has(name) && !candidateNames.has(name));
      const finding = {
        area: "サイドストーリー",
        target: displayName,
        kind: "サイドストーリーを追加",
        detail: `サイドストーリー追加 ${side.date}、対象: ${pieces.join("、")}`,
        after: { event: displayName, characters: pieces },
        sources: source,
      };
      if (pieces.length === 2 && unknown.length === 0) {
        sideStoryAdditions.push({ finding, date: /** @type {string} */ (side.date) });
      } else {
        holds.push({
          ...finding,
          detail: `${finding.detail}。保留理由: ${unknown.length > 0 ? `マスターにない名前（${unknown.join("、")}）` : "対象キャラが 2 人でない"}`,
        });
      }
    } else if (side.status === "today" || side.status === "unparseable") {
      holds.push({
        area: "サイドストーリー",
        target: displayName,
        kind: "サイドストーリー追加日を判定できない",
        detail: `サイドストーリー追加: ${event.sideStoryAdded}`,
        sources: source,
      });
    } else if (side.status === "planned") {
      notes.push({ area: "サイドストーリー", target: displayName, kind: "サイドストーリー追加は予定", detail: event.sideStoryAdded, sources: source });
    }
  }
  // 追加するサイドストーリーは、既存の並び（サイドストーリー追加日の順）で、追加日がより後の最初のイベントの前に入れる。
  for (const { finding, date } of sideStoryAdditions) {
    const insertBefore = master.sideStory.find((entry) => (masterSideDates.get(entry.event) ?? "") > date)?.event ?? null;
    proposals.push({ ...finding, after: { ...finding.after, sideStoryAdded: date, insertBefore } });
  }
  for (const [key, entry] of masterEvents) {
    if (!matchedMasterKeys.has(key)) {
      holds.push({
        area: "サイドストーリー",
        target: entry.event,
        kind: "wiki と照合できない既存イベント",
        detail: `対象: ${entry.characters.join("、")}。削除は提案しない。イベント名の表記揺れを確認する`,
        sources: [url("event-pieces")],
      });
    }
  }

  // 全体保留のときは、変更候補をすべて保留へ移す。
  if (globalHoldReasons.length > 0) {
    holds.push(...proposals.map((proposal) => ({ ...proposal, detail: `${proposal.detail}。保留理由: 全体保留` })));
    proposals.length = 0;
  }
  return { globalHoldReasons, proposals, holds, notes };
}
