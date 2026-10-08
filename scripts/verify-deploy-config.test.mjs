import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { stripJsonc, verifyDeployConfig } from "./verify-deploy-config.mjs";

// リポジトリの実際の wrangler.jsonc（JSONC のまま）を読み込む。
const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const sourceJsonc = readFileSync(join(repoRoot, "wrangler.jsonc"), "utf8");
const sourceConfig = JSON.parse(stripJsonc(sourceJsonc));

// @cloudflare/vite-plugin が出力するのと同じ形の、正常なデプロイ用設定を組み立てる。
function buildValidDeployConfig() {
  const { $schema: _schema, main: _main, ...rest } = sourceConfig;
  return {
    configPath: "/build/wrangler.jsonc",
    userConfigPath: "/build/wrangler.jsonc",
    topLevelName: sourceConfig.name,
    definedEnvironments: [],
    legacy_env: true,
    jsx_factory: "React.createElement",
    jsx_fragment: "React.Fragment",
    rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
    ...rest,
    main: "index.js",
    assets: { ...sourceConfig.assets, directory: "../client" },
    d1_databases: sourceConfig.d1_databases.map((database) => ({ ...database, migrations_dir: "../../migrations" })),
    durable_objects: { bindings: [] },
    queues: { producers: [], consumers: [] },
    services: [],
    python_modules: { exclude: ["**/*.pyc"] },
    dev: { ip: "127.0.0.1" },
    no_bundle: true,
  };
}

const createdRoots = [];

// 一時ディレクトリにリポジトリ相当の構成（wrangler.jsonc・migrations・dist）を作り、そのルートを返す。
function createFixture(mutate = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "verify-deploy-config-"));
  createdRoots.push(root);
  writeFileSync(join(root, "wrangler.jsonc"), sourceJsonc);
  mkdirSync(join(root, "migrations"));
  mkdirSync(join(root, "dist/client"), { recursive: true });
  mkdirSync(join(root, "dist/pcre_tracker"), { recursive: true });
  writeFileSync(join(root, "dist/pcre_tracker/index.js"), "export default {};\n");
  const deployConfig = buildValidDeployConfig();
  mutate(deployConfig);
  writeFileSync(join(root, "dist/pcre_tracker/wrangler.json"), JSON.stringify(deployConfig));
  return root;
}

// テストごとに作った一時ディレクトリを片付ける。
afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("stripJsonc", () => {
  it("コメントと末尾カンマを除き、文字列内の // や /* はそのまま残す", () => {
    const text = `{
      // 行コメント
      "url": "https://example.com/a//b", /* ブロック */
      "quote": "say \\"//hi\\"",
      "list": [1, 2,],
    }`;
    expect(JSON.parse(stripJsonc(text))).toEqual({
      url: "https://example.com/a//b",
      quote: 'say "//hi"',
      list: [1, 2],
    });
  });
});

describe("verifyDeployConfig", () => {
  it("正常な生成物は合格する", () => {
    expect(verifyDeployConfig({ rootDirectory: createFixture() })).toEqual([]);
  });

  it("新しい wrangler の出力形式（connect・k2 が空配列、legacy_env なし）は合格する", () => {
    const root = createFixture((config) => {
      config.connect = [];
      config.k2 = [];
      delete config.legacy_env;
    });
    expect(verifyDeployConfig({ rootDirectory: root })).toEqual([]);
  });

  it.each([
    ["build キーの追加", (config) => (config.build = { command: "echo" }), "build キー"],
    ["database_id の変更", (config) => (config.d1_databases[0].database_id = "other"), "database_id"],
    ["routes の変更", (config) => (config.routes = [{ pattern: "example.com", custom_domain: true }]), "routes"],
    ["vars の変更", (config) => (config.vars = { ...config.vars, ALLOWED_ORIGINS: "https://example.com" }), "vars"],
    ["workers_dev の有効化", (config) => (config.workers_dev = true), "workers_dev"],
    ["main が dist の外", (config) => (config.main = "../../worker/index.ts"), "main"],
    ["main が存在しない", (config) => (config.main = "missing.js"), "main"],
    ["assets.directory が dist の外", (config) => (config.assets.directory = "../../src"), "assets.directory"],
    ["assets の挙動の変更", (config) => (config.assets.run_worker_first = true), "assets.run_worker_first"],
    ["migrations_dir の変更", (config) => (config.d1_databases[0].migrations_dir = "../client"), "migrations_dir"],
    ["d1 要素への想定外のキー", (config) => (config.d1_databases[0].preview_database_id = "x"), "preview_database_id"],
    ["未使用バインディングの追加", (config) => (config.services = [{ binding: "X", service: "y" }]), "services"],
    ["想定外のトップレベルキー", (config) => (config.find_additional_modules = true), "find_additional_modules"],
    ["no_bundle の欠落", (config) => delete config.no_bundle, "no_bundle"],
    ["connect の追加", (config) => (config.connect = [{ protocol: "tcp", port: 8080 }]), "connect"],
    ["k2 の追加", (config) => (config.k2 = [{ binding: "X", stream: "y" }]), "k2"],
    ["legacy_env が false", (config) => (config.legacy_env = false), "legacy_env"],
    ["legacy_env が文字列", (config) => (config.legacy_env = "true"), "legacy_env"],
    ["rules の追加", (config) => config.rules.push({ type: "Text", globs: ["**/*.txt"] }), "rules"],
  ])("%s は失敗する", (_label, mutate, expectedMessagePart) => {
    const errors = verifyDeployConfig({ rootDirectory: createFixture(mutate) });
    expect(errors.some((message) => message.includes(expectedMessagePart))).toBe(true);
  });

  it("生成物が無ければ失敗する", () => {
    const root = createFixture();
    rmSync(join(root, "dist/pcre_tracker/wrangler.json"));
    expect(verifyDeployConfig({ rootDirectory: root })).toHaveLength(1);
  });
});
