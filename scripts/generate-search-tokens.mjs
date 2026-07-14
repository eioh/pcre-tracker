import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { toHiragana, toKatakana, toRomaji } from "wanakana";

const sourceMasterPath = resolve(process.cwd(), "src/data/characterMaster.json");
const coinShopPath = resolve(process.cwd(), "src/data/coinShopMemoryPiece.json");
const hardQuestPath = resolve(process.cwd(), "src/data/hardQuestMemoryPiece.json");
const sideStoryPath = resolve(process.cwd(), "src/data/sideStoryMemoryPiece.json");
const formationOrderPath = resolve(process.cwd(), "src/data/formationOrder.json");
const generatedMasterPath = resolve(process.cwd(), "src/data/characterMaster.generated.json");

// 検索用の比較で使う正規化文字列を作る。
function normalizeForSearch(value) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "").trim();
}

// キャラ名から検索トークン一覧を作る。
function buildNameSearchTokens(name) {
  const normalizedName = normalizeForSearch(name);
  const hiraganaName = normalizeForSearch(toHiragana(name, { passRomaji: true }));
  const katakanaName = normalizeForSearch(toKatakana(hiraganaName, { passRomaji: true }));
  const romajiName = normalizeForSearch(toRomaji(name));
  return Array.from(new Set([normalizedName, hiraganaName, katakanaName, romajiName].filter((token) => token.length > 0)));
}

// コインショップのメモリピース入手データをキャラ名→ソース一覧のMapに変換する。
function buildCoinSourceMap() {
  const rawText = readFileSync(coinShopPath, "utf8");
  const coinData = JSON.parse(rawText);
  /** @type {Map<string, string[]>} */
  const map = new Map();
  for (const [coinType, names] of Object.entries(coinData)) {
    for (const name of names) {
      if (!map.has(name)) {
        map.set(name, []);
      }
      map.get(name).push(coinType);
    }
  }
  return map;
}

// ハードクエストのメモリピース入手データからキャラ名のSetを構築する。
function buildHardQuestCharacterSet() {
  const rawText = readFileSync(hardQuestPath, "utf8");
  const hardQuestData = JSON.parse(rawText);
  return new Set(Object.values(hardQuestData));
}

// サイドストーリーのメモリピース入手データからキャラ名のSetを構築する。
function buildSideStoryCharacterSet() {
  const rawText = readFileSync(sideStoryPath, "utf8");
  const sideStoryData = JSON.parse(rawText);
  /** @type {Set<string>} */
  const set = new Set();
  for (const entry of sideStoryData) {
    for (const name of entry.characters) {
      set.add(name);
    }
  }
  return set;
}

// 編成順リスト(formationOrder.json)を検証し、キャラ名→編成順(0始まり)のMapを構築する。
function buildFormationOrderMap(masterNames) {
  const rawText = readFileSync(formationOrderPath, "utf8");
  const orderedNames = JSON.parse(rawText);
  if (!Array.isArray(orderedNames)) {
    throw new Error("formationOrder.json の形式が不正です(キャラ名の配列である必要があります)");
  }
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const name of orderedNames) {
    if (typeof name !== "string") {
      throw new Error(`formationOrder.json に文字列でない要素があります: ${JSON.stringify(name)}`);
    }
    if (map.has(name)) {
      throw new Error(`formationOrder.json に重複したキャラクター名があります: ${name}`);
    }
    if (!masterNames.has(name)) {
      throw new Error(`formationOrder.json にマスターデータに存在しない名前があります: ${name}`);
    }
    map.set(name, map.size);
  }
  const missing = [...masterNames].filter((name) => !map.has(name));
  if (missing.length > 0) {
    throw new Error(`formationOrder.json に載っていないキャラクターがあります: ${missing.join(", ")}`);
  }
  return map;
}

// マスターデータへ検索トークンとコインショップ・ハードクエスト・サイドストーリー情報を統合して保存する。
function generateSearchTokens() {
  const rawText = readFileSync(sourceMasterPath, "utf8");
  const characters = JSON.parse(rawText);

  if (!Array.isArray(characters)) {
    throw new Error("characterMaster.json の形式が不正です");
  }

  const coinSourceMap = buildCoinSourceMap();
  const hardQuestCharacters = buildHardQuestCharacterSet();
  const sideStoryCharacters = buildSideStoryCharacterSet();
  const masterNames = new Set(
    characters.filter((character) => character && typeof character.name === "string").map((character) => character.name),
  );
  const formationOrderMap = buildFormationOrderMap(masterNames);

  const enriched = characters.map((character) => {
    if (!character || typeof character !== "object" || typeof character.name !== "string") {
      return character;
    }
    const coinSources = coinSourceMap.get(character.name) ?? [];
    const hardQuestSources = hardQuestCharacters.has(character.name) ? ["hard_quest"] : [];
    const sideStorySources = sideStoryCharacters.has(character.name) ? ["side_story"] : [];
    return {
      ...character,
      memoryPieceSources: [...coinSources, ...hardQuestSources, ...sideStorySources, ...(character.memoryPieceSources ?? [])],
      searchTokens: buildNameSearchTokens(character.name),
      formationOrder: formationOrderMap.get(character.name),
    };
  });

  const tempPath = `${generatedMasterPath}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
    renameSync(tempPath, generatedMasterPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

generateSearchTokens();
