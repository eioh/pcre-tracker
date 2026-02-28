import rawMasterCharacters from "../data/characterMaster.generated.json";
import { masterCharacterListSchema } from "./schemas";
import type { MasterCharacter } from "./types";

function ensureUniqueNames(characters: MasterCharacter[]): void {
  const seen = new Set<string>();
  for (const character of characters) {
    if (seen.has(character.name)) {
      throw new Error(`重複したキャラクター名を検出しました: ${character.name}`);
    }
    seen.add(character.name);
  }
}

const parsedMasterCharacters = masterCharacterListSchema.parse(rawMasterCharacters);
ensureUniqueNames(parsedMasterCharacters);

export const masterCharacters: MasterCharacter[] = parsedMasterCharacters;

export const masterByName = new Map(masterCharacters.map((character) => [character.name, character]));
