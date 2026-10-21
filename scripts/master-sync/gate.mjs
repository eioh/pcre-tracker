// 更新候補のゲート判定（段階2）。当てはめ処理とは独立に、元データと候補の差分を検査する。
// 判定規則（削除・true→false・並び替え・既存値の変更をしない、報告にない変更をしない、形式と参照整合性を守る）を
// 機械的に確かめ、1 つでも破っていれば不合格にする。
import { isDeepStrictEqual } from "node:util";
import { checkReferenceIntegrity } from "./integrity.mjs";
import { ATTRIBUTES, ROLES } from "./parsers.mjs";

/** @typedef {import("./integrity.mjs").ExistingMaster} ExistingMaster */

const IMPLEMENTED_KEYS = ["star6", "ue1", "ue1Sp", "ue2"];
const CHARACTER_KEYS = ["name", "baseName", "limited", "attribute", "role", "implemented", "memoryPieceSources"];

// 配列 sub が配列 full の部分列（相対順を保ったまま含まれる）かを返す。
function isSubsequence(sub, full) {
  let index = 0;
  for (const item of full) {
    if (index < sub.length && isDeepStrictEqual(item, sub[index])) {
      index += 1;
    }
  }
  return index === sub.length;
}

// 新キャラの形式（項目・型・列挙値）を検査し、問題の一覧を返す。
function validateNewCharacter(character) {
  const problems = [];
  const keys = Object.keys(character);
  if (!isDeepStrictEqual(keys, CHARACTER_KEYS)) {
    problems.push(`項目が想定と異なる（${keys.join(", ")}）`);
  }
  if (typeof character.name !== "string" || character.name === "" || typeof character.baseName !== "string" || character.baseName === "") {
    problems.push("name / baseName が空");
  }
  if (typeof character.limited !== "boolean") {
    problems.push("limited が真偽値でない");
  }
  if (!ATTRIBUTES.includes(character.attribute)) {
    problems.push(`attribute が不正（${character.attribute}）`);
  }
  if (!ROLES.includes(character.role)) {
    problems.push(`role が不正（${character.role}）`);
  }
  if (!isDeepStrictEqual(Object.keys(character.implemented ?? {}), IMPLEMENTED_KEYS) || !IMPLEMENTED_KEYS.every((key) => typeof character.implemented[key] === "boolean")) {
    problems.push("implemented の形式が不正");
  }
  if (!isDeepStrictEqual(character.memoryPieceSources, [])) {
    problems.push("memoryPieceSources が空配列でない");
  }
  return problems;
}

/**
 * 元データと候補を比べてゲート判定する。
 * @param {{ base: ExistingMaster, candidate: ExistingMaster, report: { globalHoldReasons: string[], proposals: import("./compare.mjs").Finding[] } }} input
 * @returns {{ ok: boolean, failures: string[], changes: string[] }}
 */
export function gateCandidate({ base, candidate, report }) {
  /** @type {string[]} */
  const failures = [];
  /** @type {string[]} */
  const changes = [];
  const proposed = (kind, target) => report.proposals.some((proposal) => proposal.kind === kind && proposal.target === target);

  if (report.globalHoldReasons.length > 0) {
    failures.push(`報告が全体保留になっている（${report.globalHoldReasons.join(" / ")}）`);
  }

  // ---- キャラ ----
  const candidateByName = new Map(candidate.characters.map((character) => [character.name, character]));
  if (candidateByName.size !== candidate.characters.length) {
    failures.push("characterMaster に重複した name がある");
  }
  if (!isSubsequence(base.characters.map((character) => character.name), candidate.characters.map((character) => character.name))) {
    failures.push("既存キャラの削除または並び替えがある");
  }
  for (const before of base.characters) {
    const after = candidateByName.get(before.name);
    if (!after) {
      continue;
    }
    for (const key of Object.keys(before)) {
      if (key === "implemented") {
        continue;
      }
      if (!isDeepStrictEqual(before[key], after[key])) {
        failures.push(`既存キャラ「${before.name}」の ${key} が変わっている（${JSON.stringify(before[key])} → ${JSON.stringify(after[key])}）`);
      }
    }
    if (!isDeepStrictEqual(Object.keys(after), Object.keys(before))) {
      failures.push(`既存キャラ「${before.name}」の項目が変わっている`);
    }
    for (const key of IMPLEMENTED_KEYS) {
      const from = before.implemented[key];
      const to = after.implemented?.[key];
      if (from === to) {
        continue;
      }
      const label = { star6: "★6", ue1: "専用1", ue1Sp: "専用1SP", ue2: "専用2" }[key];
      if (from === true) {
        failures.push(`既存キャラ「${before.name}」の ${key} が true から変わっている`);
      } else if (to === true && proposed(`${label}を実装済みにする`, before.name)) {
        changes.push(`実装状況: ${before.name} の ${label}を実装済みにする`);
      } else {
        failures.push(`既存キャラ「${before.name}」の ${key} が報告にない変わり方をしている（${from} → ${to}）`);
      }
    }
  }
  const baseNames = new Set(base.characters.map((character) => character.name));
  for (const character of candidate.characters.filter((entry) => !baseNames.has(entry.name))) {
    if (!proposed("新キャラ追加", character.name)) {
      failures.push(`報告にない新キャラ「${character.name}」がある`);
      continue;
    }
    const problems = validateNewCharacter(character);
    if (problems.length > 0) {
      failures.push(`新キャラ「${character.name}」の形式: ${problems.join("、")}`);
    }
    changes.push(`新キャラ: ${character.name}（${character.attribute} / ${character.role} / limited=${character.limited}）`);
  }

  // ---- 編成順 ----
  if (!isSubsequence(base.formationOrder, candidate.formationOrder)) {
    failures.push("編成順で既存キャラの削除または並び替えがある");
  }
  const orderSet = new Set(candidate.formationOrder);
  if (orderSet.size !== candidate.formationOrder.length || orderSet.size !== candidateByName.size || ![...candidateByName.keys()].every((name) => orderSet.has(name))) {
    failures.push("編成順と characterMaster のキャラ集合が一致しない");
  }
  const baseOrder = new Set(base.formationOrder);
  for (const name of candidate.formationOrder.filter((entry) => !baseOrder.has(entry))) {
    if (!proposed("編成順に挿入", name)) {
      failures.push(`報告にない編成順の挿入「${name}」がある`);
    } else {
      const index = candidate.formationOrder.indexOf(name);
      changes.push(`編成順: ${name} を ${candidate.formationOrder[index - 1] ?? "（先頭）"} の後ろに挿入`);
    }
  }

  // ---- HARD ----
  for (const [stage, name] of Object.entries(base.hardQuest)) {
    if (candidate.hardQuest[stage] !== name) {
      failures.push(`既存の HARD ${stage} が変わっている（${name} → ${candidate.hardQuest[stage] ?? "削除"}）`);
    }
  }
  for (const [stage, name] of Object.entries(candidate.hardQuest)) {
    if (stage in base.hardQuest) {
      continue;
    }
    if (proposed("HARD ステージを追加", stage)) {
      changes.push(`HARD: ${stage} に ${name} を追加`);
    } else {
      failures.push(`報告にない HARD ${stage} がある`);
    }
  }

  // ---- サイドストーリー・コインショップ ----
  if (!isSubsequence(base.sideStory, candidate.sideStory)) {
    failures.push("既存のサイドストーリーの変更・削除・並び替えがある");
  }
  const baseEvents = new Set(base.sideStory.map((entry) => entry.event));
  for (const entry of candidate.sideStory.filter((item) => !baseEvents.has(item.event))) {
    if (proposed("サイドストーリーを追加", entry.event)) {
      changes.push(`サイドストーリー: ${entry.event}（${entry.characters.join("、")}）を追加`);
    } else {
      failures.push(`報告にないサイドストーリー「${entry.event}」がある`);
    }
  }
  if (!isDeepStrictEqual(base.coinShop, candidate.coinShop)) {
    failures.push("コインショップのデータが変わっている（同期の対象外）");
  }

  // ---- 報告の候補がすべて反映されているか ----
  if (changes.length !== report.proposals.length) {
    failures.push(`報告の変更候補 ${report.proposals.length} 件に対し、反映された変更が ${changes.length} 件`);
  }

  // ---- 参照整合性 ----
  for (const issue of checkReferenceIntegrity(candidate)) {
    failures.push(`参照整合性: ${issue.file} [${issue.location}] ${issue.name} ${issue.problem}`);
  }
  return { ok: failures.length === 0, failures, changes };
}
