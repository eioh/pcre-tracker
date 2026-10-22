// 報告の変更候補（proposals）を既存マスターの写しに当てはめ、更新候補のマスターデータを作る（段階2）。
// 当てはめるのは判定規則を通った追加・false→true だけで、想定外の種類の候補があれば例外にする。
// 元のデータは変更せず、新しいオブジェクトを返す。

/** @typedef {import("./integrity.mjs").ExistingMaster} ExistingMaster */

// 当てはめてよい変更候補の種類と、キャラの実装状況の候補が指すキー。
const FEATURE_KIND_TO_KEY = {
  専用1を実装済みにする: "ue1",
  専用1SPを実装済みにする: "ue1Sp",
  専用2を実装済みにする: "ue2",
  "★6を実装済みにする": "star6",
};
export const APPLICABLE_KINDS = ["新キャラ追加", "編成順に挿入", "HARD ステージを追加", "サイドストーリーを追加", ...Object.keys(FEATURE_KIND_TO_KEY)];

// HARD のステージ番号（例: "82-1"）をエリア・ステージの数値の組にして比べる。
function compareStage(left, right) {
  const [leftArea, leftStage] = left.split("-").map(Number);
  const [rightArea, rightStage] = right.split("-").map(Number);
  return leftArea - rightArea || leftStage - rightStage;
}

// JSON で扱う値を深く写す（元データを書き換えないため）。
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 変更候補を当てはめた更新候補のマスターデータを返す。
 * @param {ExistingMaster} base
 * @param {import("./compare.mjs").Finding[]} proposals
 * @returns {ExistingMaster}
 */
export function applyProposals(base, proposals) {
  const candidate = clone(base);
  const unknownKinds = proposals.filter((proposal) => !APPLICABLE_KINDS.includes(proposal.kind));
  if (unknownKinds.length > 0) {
    throw new Error(`当てはめられない種類の変更候補があります: ${unknownKinds.map((proposal) => `${proposal.kind}（${proposal.target}）`).join("、")}`);
  }

  // 新キャラは末尾に追加する（既存の並びは実装順）。implemented のキーの並びは既存データに合わせる。
  for (const proposal of proposals.filter((entry) => entry.kind === "新キャラ追加")) {
    const after = /** @type {any} */ (proposal.after);
    if (candidate.characters.some((character) => character.name === after.name)) {
      throw new Error(`新キャラ「${after.name}」は既にマスターにあります`);
    }
    candidate.characters.push({
      name: after.name,
      baseName: after.baseName,
      limited: after.limited,
      attribute: after.attribute,
      role: after.role,
      implemented: {
        star6: after.implemented.star6,
        ue1: after.implemented.ue1,
        ue1Sp: after.implemented.ue1Sp,
        ue2: after.implemented.ue2,
      },
      memoryPieceSources: [],
    });
  }

  // 既存キャラの専用装備・★6 を false→true にする。
  for (const proposal of proposals.filter((entry) => entry.kind in FEATURE_KIND_TO_KEY)) {
    const key = FEATURE_KIND_TO_KEY[/** @type {keyof typeof FEATURE_KIND_TO_KEY} */ (proposal.kind)];
    const character = candidate.characters.find((entry) => entry.name === proposal.target);
    if (!character || character.implemented[key] !== false) {
      throw new Error(`「${proposal.target}」の ${key} は false→true にできる状態ではありません`);
    }
    character.implemented[key] = true;
  }

  // 編成順に挿入する。直前のキャラの後ろ、なければ直後のキャラの前に入れる。
  // 候補は wiki の並び順に来るので、同じ基準の後ろに先に挿入したキャラがあれば、その後ろに続ける。
  const insertedNames = new Set();
  for (const proposal of proposals.filter((entry) => entry.kind === "編成順に挿入")) {
    const { insertAfter, insertBefore } = /** @type {any} */ (proposal.after);
    const order = candidate.formationOrder;
    if (order.includes(proposal.target)) {
      throw new Error(`「${proposal.target}」は既に編成順にあります`);
    }
    let index;
    if (insertAfter !== null) {
      index = order.indexOf(insertAfter) + 1;
      if (index === 0) {
        throw new Error(`「${proposal.target}」の挿入位置の基準「${insertAfter}」が編成順に見つかりません`);
      }
      while (index < order.length && insertedNames.has(order[index])) {
        index += 1;
      }
    } else if (insertBefore !== null) {
      index = order.indexOf(insertBefore);
      if (index < 0) {
        throw new Error(`「${proposal.target}」の挿入位置の基準「${insertBefore}」が編成順に見つかりません`);
      }
    } else {
      index = order.length;
    }
    order.splice(index, 0, proposal.target);
    insertedNames.add(proposal.target);
  }

  // HARD のステージを追加し、ステージ番号の順に並べ直す。
  const hardAdditions = proposals.filter((entry) => entry.kind === "HARD ステージを追加");
  for (const proposal of hardAdditions) {
    if (proposal.target in candidate.hardQuest) {
      throw new Error(`HARD ${proposal.target} は既にあります`);
    }
    candidate.hardQuest[proposal.target] = /** @type {string} */ (proposal.after);
  }
  if (hardAdditions.length > 0) {
    candidate.hardQuest = Object.fromEntries(Object.entries(candidate.hardQuest).sort(([left], [right]) => compareStage(left, right)));
  }

  // サイドストーリーを追加日の順の位置に挿入する（基準がなければ末尾）。
  const sideAdditions = proposals
    .filter((entry) => entry.kind === "サイドストーリーを追加")
    .map((entry) => /** @type {any} */ (entry.after))
    .sort((left, right) => left.sideStoryAdded.localeCompare(right.sideStoryAdded));
  for (const after of sideAdditions) {
    if (candidate.sideStory.some((entry) => entry.event === after.event)) {
      throw new Error(`サイドストーリー「${after.event}」は既にあります`);
    }
    const index = after.insertBefore === null ? -1 : candidate.sideStory.findIndex((entry) => entry.event === after.insertBefore);
    candidate.sideStory.splice(index < 0 ? candidate.sideStory.length : index, 0, { event: after.event, characters: after.characters });
  }
  return candidate;
}
