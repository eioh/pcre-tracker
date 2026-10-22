// 既存マスターデータの参照整合性を検査する（読み取り専用）。
// generate-search-tokens.mjs は characterMaster と formationOrder のキャラ集合しか検査しないため、
// HARD・サイドストーリー・コインショップのキャラ名がマスターに存在するかをここで確かめる。
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 比較・検査に使う既存マスターデータ一式。
 * @typedef {{
 *   characters: { name: string, baseName: string, limited: boolean, attribute: string, role: string,
 *     implemented: { star6: boolean, ue1: boolean, ue1Sp: boolean, ue2: boolean } }[],
 *   formationOrder: string[],
 *   hardQuest: Record<string, string>,
 *   sideStory: { event: string, characters: string[] }[],
 *   coinShop: Record<string, string[]>,
 * }} ExistingMaster
 */

// リポジトリの src/data/ から既存マスターデータを読み込む。
/** @returns {ExistingMaster} */
export function loadExistingMaster(repoRoot) {
  // src/data/ 配下の JSON を読む。
  const read = (file) => JSON.parse(readFileSync(join(repoRoot, "src/data", file), "utf8"));
  return {
    characters: read("characterMaster.json"),
    formationOrder: read("formationOrder.json"),
    hardQuest: read("hardQuestMemoryPiece.json"),
    sideStory: read("sideStoryMemoryPiece.json"),
    coinShop: read("coinShopMemoryPiece.json"),
  };
}

/**
 * 参照整合性の検査結果 1 件。
 * @typedef {{ file: string, location: string, name: string, problem: string }} IntegrityIssue
 */

// 各データのキャラ名がマスターに存在するか、同じ一覧内で重複していないかを検査する。
/** @param {ExistingMaster} master @returns {IntegrityIssue[]} */
export function checkReferenceIntegrity(master) {
  const names = new Set(master.characters.map((character) => character.name));
  /** @type {IntegrityIssue[]} */
  const issues = [];

  // マスターに存在しない名前を問題として記録する。
  const checkName = (file, location, name) => {
    if (!names.has(name)) {
      issues.push({ file, location, name, problem: "characterMaster.json に存在しない名前" });
    }
  };

  for (const [stage, name] of Object.entries(master.hardQuest)) {
    checkName("hardQuestMemoryPiece.json", stage, name);
  }
  const seenEvents = new Set();
  for (const entry of master.sideStory) {
    if (seenEvents.has(entry.event)) {
      issues.push({ file: "sideStoryMemoryPiece.json", location: entry.event, name: "", problem: "イベント名の重複" });
    }
    seenEvents.add(entry.event);
    for (const name of entry.characters) {
      checkName("sideStoryMemoryPiece.json", entry.event, name);
    }
  }
  for (const [coinType, coinNames] of Object.entries(master.coinShop)) {
    const seen = new Set();
    for (const name of coinNames) {
      checkName("coinShopMemoryPiece.json", coinType, name);
      if (seen.has(name)) {
        issues.push({ file: "coinShopMemoryPiece.json", location: coinType, name, problem: "同じコイン種別内での重複" });
      }
      seen.add(name);
    }
  }
  return issues;
}
