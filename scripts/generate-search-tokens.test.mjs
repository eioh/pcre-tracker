import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const scriptPath = join(repoRoot, "scripts/generate-search-tokens.mjs");
const createdRoots = [];

// 一時ディレクトリに src/data の写しを作り、そのルートを返す（生成スクリプトは作業ディレクトリ基準で読む）。
function makeDataCopy() {
  const root = mkdtempSync(join(tmpdir(), "generate-search-tokens-"));
  createdRoots.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  cpSync(join(repoRoot, "src/data"), join(root, "src/data"), { recursive: true });
  return root;
}

// 写しの JSON を読み、変更してから書き戻す。
function editJson(root, file, edit) {
  const path = join(root, "src/data", file);
  writeFileSync(path, `${JSON.stringify(edit(JSON.parse(readFileSync(path, "utf8"))), null, 2)}\n`, "utf8");
}

// 写しを作業ディレクトリにして生成スクリプトを実行する。
function runGenerate(root) {
  return spawnSync(process.execPath, [scriptPath], { cwd: root, encoding: "utf8" });
}

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("generate-search-tokens の参照整合性チェック", () => {
  it("現在のデータでは成功する", () => {
    const root = makeDataCopy();
    const result = runGenerate(root);
    expect(result.status).toBe(0);
  });

  it("サイドストーリー・HARD・コインショップにマスターにない名前があれば失敗し、生成物を書き換えない", () => {
    const root = makeDataCopy();
    const generatedPath = join(root, "src/data/characterMaster.generated.json");
    rmSync(generatedPath);
    editJson(root, "sideStoryMemoryPiece.json", (data) => [...data, { event: "テスト", characters: ["ぺコリーヌ", "コッコロ"] }]);
    editJson(root, "hardQuestMemoryPiece.json", (data) => ({ ...data, "99-1": "存在しないキャラ" }));
    editJson(root, "coinShopMemoryPiece.json", (data) => ({ ...data, arena_coin: [...data.arena_coin, data.arena_coin[0]] }));
    const result = runGenerate(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("参照整合性に問題があります");
    expect(result.stderr).toContain("sideStoryMemoryPiece.json [テスト] ぺコリーヌ: characterMaster.json に存在しない名前");
    expect(result.stderr).toContain("hardQuestMemoryPiece.json [99-1] 存在しないキャラ");
    expect(result.stderr).toContain("同じコイン種別内での重複");
    expect(existsSync(generatedPath)).toBe(false);
  });
});
