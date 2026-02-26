import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { toHiragana, toKatakana, toRomaji } from "wanakana";

const masterPath = resolve(process.cwd(), "src/data/characterMaster.json");

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

// マスターデータへ検索トークンを付与して保存する。
function generateSearchTokens() {
  const rawText = readFileSync(masterPath, "utf8");
  const characters = JSON.parse(rawText);

  if (!Array.isArray(characters)) {
    throw new Error("characterMaster.json の形式が不正です");
  }

  const enriched = characters.map((character) => {
    if (!character || typeof character !== "object" || typeof character.name !== "string") {
      return character;
    }
    return {
      ...character,
      searchTokens: buildNameSearchTokens(character.name),
    };
  });

  const tempPath = `${masterPath}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
    renameSync(tempPath, masterPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

generateSearchTokens();
