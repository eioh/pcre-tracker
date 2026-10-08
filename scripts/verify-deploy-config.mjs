// デプロイ用にビルドで生成された dist/pcre_tracker/wrangler.json を、リポジトリの wrangler.jsonc と照合する。
// deploy ジョブは別ジョブで作った成果物を受け取って wrangler に渡すため、wrangler を呼ぶ前に
// checkout したこのスクリプトで「想定外の設定が混ざっていないこと」を確認する。
// 依存パッケージに左右されないよう、Node.js 標準 API だけを使う。
//
// 使い方: node scripts/verify-deploy-config.mjs [--root <リポジトリのルート>]
//   --root を省略すると、このスクリプトの 1 つ上のディレクトリをリポジトリのルートとして扱う。
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

// リポジトリのルートから見た、デプロイ用設定ファイル・ビルド出力・マイグレーションの位置。
const DEPLOY_CONFIG_RELATIVE_PATH = "dist/pcre_tracker/wrangler.json";
const SOURCE_CONFIG_RELATIVE_PATH = "wrangler.jsonc";
const DIST_RELATIVE_PATH = "dist";

// wrangler.jsonc と同じ値でなければならないキー（公開先・バインディング先・実行時の挙動に関わる）。
const KEYS_SAME_AS_SOURCE = [
  "name",
  "compatibility_date",
  "compatibility_flags",
  "routes",
  "triggers",
  "vars",
  "workers_dev",
  "preview_urls",
];

// @cloudflare/vite-plugin / wrangler が生成時に必ず同じ値で出力するキー。
// プラグイン更新で値が変わった場合は、内容を確認してからここを更新する。
const KEYS_WITH_FIXED_VALUE = {
  // 環境（env）を使わない構成。false にすると旧来のサービス環境として解釈される。
  legacy_env: true,
  // vite でバンドル済みのため wrangler 側で再バンドルしない。
  no_bundle: true,
  // バンドルしないので実際には使われないが、生成物の既定値として固定する。
  jsx_factory: "React.createElement",
  jsx_fragment: "React.Fragment",
  // アップロードするモジュールの種類。追加の規則で想定外のファイルを取り込ませない。
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
  python_modules: { exclude: ["**/*.pyc"] },
  // 環境を定義していないことを確認する。
  definedEnvironments: [],
};

// ビルドしたマシンの絶対パスなど、デプロイに影響しないため値を比較しないキー。
// configPath / userConfigPath は `--config` を明示すると wrangler が引数から求め直すため、ファイル内の値は使われない。
// dev は `wrangler dev` 専用のローカル設定で、deploy では参照されない。
const KEYS_IGNORED = {
  configPath: "string",
  userConfigPath: "string",
  dev: "object",
};

// このアプリでは使っていないバインディング類。生成物には空の値で出力されるので、中身が空であることを確認する。
const KEYS_MUST_BE_EMPTY = [
  "durable_objects",
  "workflows",
  "migrations",
  "exports",
  "kv_namespaces",
  "cloudchamber",
  "send_email",
  "queues",
  "r2_buckets",
  "vectorize",
  "ai_search_namespaces",
  "ai_search",
  "agent_memory",
  "hyperdrive",
  "services",
  "analytics_engine_datasets",
  "dispatch_namespaces",
  "mtls_certificates",
  "pipelines",
  "secrets_store_secrets",
  "artifacts",
  "unsafe_hello_world",
  "flagship",
  "worker_loaders",
  "ratelimits",
  "vpc_services",
  "vpc_networks",
  "logfwdr",
];

// 個別の処理で検証するキー。
const KEYS_CHECKED_INDIVIDUALLY = ["topLevelName", "main", "assets", "d1_databases"];

// 生成物に存在してよいトップレベルキーの一覧（これ以外のキーがあれば失敗させる）。
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  ...KEYS_SAME_AS_SOURCE,
  ...Object.keys(KEYS_WITH_FIXED_VALUE),
  ...Object.keys(KEYS_IGNORED),
  ...KEYS_MUST_BE_EMPTY,
  ...KEYS_CHECKED_INDIVIDUALLY,
]);

// d1_databases の各要素に存在してよいキー。
const ALLOWED_D1_KEYS = new Set(["binding", "database_name", "database_id", "migrations_dir"]);

// JSONC（コメント・末尾カンマ付き JSON）を JSON.parse できる形に直す。
// 文字列リテラルの中の `//` や `/*` はコメントとして扱わない。
export function stripJsonc(text) {
  let withoutComments = "";
  let inString = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (inString) {
      withoutComments += char;
      if (char === "\\") {
        // エスケープされた次の 1 文字（\" など）は文字列の終端として扱わない。
        withoutComments += next ?? "";
        index += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      withoutComments += char;
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      // 行コメントは改行の直前まで読み飛ばす。
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (char === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);
      if (end === -1) {
        throw new Error("閉じられていないブロックコメントがあります");
      }
      index = end + 2;
      continue;
    }
    withoutComments += char;
    index += 1;
  }

  // 末尾カンマ（`,` の後に空白を挟んで `}` か `]` が続くもの）を文字列の外でだけ取り除く。
  let result = "";
  inString = false;
  for (let i = 0; i < withoutComments.length; i += 1) {
    const char = withoutComments[i];
    if (inString) {
      result += char;
      if (char === "\\") {
        result += withoutComments[i + 1] ?? "";
        i += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === ",") {
      const rest = withoutComments.slice(i + 1);
      if (/^\s*[}\]]/.test(rest)) {
        continue;
      }
    }
    result += char;
  }
  return result;
}

// 値が JSON のプレーンなオブジェクト（配列・null 以外）かを判定する。
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 空配列・空オブジェクト、またはそれらだけを入れ子にした値かを判定する（例: { bindings: [] }）。
function isDeepEmpty(value) {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (isPlainObject(value)) {
    return Object.values(value).every((child) => isDeepEmpty(child));
  }
  return false;
}

// child が parent ディレクトリの内側（parent 自身は含まない）にあるかを判定する。
function isInsideDirectory(parent, child) {
  const rel = relative(parent, child);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

// 実在するパスをシンボリックリンク解決後の実パスに直す（存在しなければ null）。
function toRealPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

// 設定ファイル相対のパスが dist/ の内側を指し、実在するかを検証してエラーを追加する。
function checkPathInsideDist({ errors, label, value, configDirectory, distDirectory, expectedType }) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${label} が文字列ではありません`);
    return;
  }
  if (isAbsolute(value)) {
    errors.push(`${label} に絶対パスは使えません: ${value}`);
    return;
  }
  const resolved = resolve(configDirectory, value);
  if (!isInsideDirectory(distDirectory, resolved)) {
    errors.push(`${label} が ${DIST_RELATIVE_PATH}/ の外を指しています: ${value}`);
    return;
  }
  const realResolved = toRealPath(resolved);
  const realDist = toRealPath(distDirectory);
  if (realResolved === null || realDist === null) {
    errors.push(`${label} が指すパスが存在しません: ${value}`);
    return;
  }
  // シンボリックリンク経由で dist/ の外へ出ていないかも確認する。
  if (!isInsideDirectory(realDist, realResolved)) {
    errors.push(`${label} がリンク経由で ${DIST_RELATIVE_PATH}/ の外を指しています: ${value}`);
    return;
  }
  const stats = statSync(realResolved);
  if (expectedType === "file" && !stats.isFile()) {
    errors.push(`${label} がファイルではありません: ${value}`);
  }
  if (expectedType === "directory" && !stats.isDirectory()) {
    errors.push(`${label} がディレクトリではありません: ${value}`);
  }
}

// assets の各値を wrangler.jsonc と比べ、directory だけは dist/ 内を指すことを確認する。
function checkAssets({ errors, deployAssets, sourceAssets, configDirectory, distDirectory }) {
  if (!isPlainObject(deployAssets) || !isPlainObject(sourceAssets)) {
    errors.push("assets がオブジェクトではありません（wrangler.jsonc と生成物の両方に必要です）");
    return;
  }
  const keys = new Set([...Object.keys(deployAssets), ...Object.keys(sourceAssets)]);
  keys.delete("directory");
  for (const key of keys) {
    if (!isDeepStrictEqual(deployAssets[key], sourceAssets[key])) {
      errors.push(`assets.${key} が wrangler.jsonc と一致しません`);
    }
  }
  checkPathInsideDist({
    errors,
    label: "assets.directory",
    value: deployAssets.directory,
    configDirectory,
    distDirectory,
    expectedType: "directory",
  });
}

// d1_databases を要素ごとに wrangler.jsonc と比べ、migrations_dir がリポジトリの migrations を指すことを確認する。
function checkD1Databases({ errors, deployDatabases, sourceDatabases, configDirectory, rootDirectory }) {
  if (!Array.isArray(deployDatabases) || !Array.isArray(sourceDatabases)) {
    errors.push("d1_databases が配列ではありません");
    return;
  }
  if (deployDatabases.length !== sourceDatabases.length) {
    errors.push("d1_databases の件数が wrangler.jsonc と一致しません");
    return;
  }
  deployDatabases.forEach((database, index) => {
    const source = sourceDatabases[index];
    const label = `d1_databases[${index}]`;
    if (!isPlainObject(database) || !isPlainObject(source)) {
      errors.push(`${label} がオブジェクトではありません`);
      return;
    }
    for (const key of Object.keys(database)) {
      if (!ALLOWED_D1_KEYS.has(key)) {
        errors.push(`${label} に想定外のキーがあります: ${key}`);
      }
    }
    for (const key of ["binding", "database_name", "database_id"]) {
      if (typeof database[key] !== "string" || database[key] !== source[key]) {
        errors.push(`${label}.${key} が wrangler.jsonc と一致しません`);
      }
    }
    // 生成物の migrations_dir は設定ファイルの位置からの相対パスなので、解決した絶対パスで比べる。
    const expectedMigrations = resolve(rootDirectory, source.migrations_dir ?? "migrations");
    const actual = database.migrations_dir;
    if (typeof actual !== "string" || isAbsolute(actual) || resolve(configDirectory, actual) !== expectedMigrations) {
      errors.push(`${label}.migrations_dir がリポジトリの migrations を指していません: ${String(actual)}`);
    }
  });
}

// デプロイ用設定を検証し、見つかった問題をエラーメッセージの配列で返す（空配列なら合格）。
export function verifyDeployConfig({ rootDirectory }) {
  const errors = [];
  const deployConfigPath = resolve(rootDirectory, DEPLOY_CONFIG_RELATIVE_PATH);
  const sourceConfigPath = resolve(rootDirectory, SOURCE_CONFIG_RELATIVE_PATH);
  const distDirectory = resolve(rootDirectory, DIST_RELATIVE_PATH);
  const configDirectory = dirname(deployConfigPath);

  if (!existsSync(deployConfigPath)) {
    return [`${DEPLOY_CONFIG_RELATIVE_PATH} が見つかりません（先にビルドが必要です）`];
  }
  let deployConfig;
  let sourceConfig;
  try {
    deployConfig = JSON.parse(readFileSync(deployConfigPath, "utf8"));
  } catch (error) {
    return [`${DEPLOY_CONFIG_RELATIVE_PATH} を JSON として読めません: ${error.message}`];
  }
  try {
    sourceConfig = JSON.parse(stripJsonc(readFileSync(sourceConfigPath, "utf8")));
  } catch (error) {
    return [`${SOURCE_CONFIG_RELATIVE_PATH} を読めません: ${error.message}`];
  }
  if (!isPlainObject(deployConfig) || !isPlainObject(sourceConfig)) {
    return ["設定ファイルのトップレベルがオブジェクトではありません"];
  }

  // ビルド時にコマンドを実行させる設定は、どんな値でも受け付けない。
  if (Object.hasOwn(deployConfig, "build")) {
    errors.push("build キーは使えません（deploy 時にコマンドが実行されるため）");
  }
  for (const key of Object.keys(deployConfig)) {
    if (key !== "build" && !ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      errors.push(`想定外のトップレベルキーがあります: ${key}`);
    }
  }

  for (const key of KEYS_SAME_AS_SOURCE) {
    if (!isDeepStrictEqual(deployConfig[key], sourceConfig[key])) {
      errors.push(`${key} が wrangler.jsonc と一致しません`);
    }
  }
  for (const [key, expected] of Object.entries(KEYS_WITH_FIXED_VALUE)) {
    if (!isDeepStrictEqual(deployConfig[key], expected)) {
      errors.push(`${key} が想定値 ${JSON.stringify(expected)} ではありません`);
    }
  }
  for (const [key, expectedType] of Object.entries(KEYS_IGNORED)) {
    const value = deployConfig[key];
    const valid = expectedType === "object" ? isPlainObject(value) : typeof value === expectedType;
    if (value !== undefined && !valid) {
      errors.push(`${key} の型が想定（${expectedType}）と異なります`);
    }
  }
  for (const key of KEYS_MUST_BE_EMPTY) {
    if (deployConfig[key] !== undefined && !isDeepEmpty(deployConfig[key])) {
      errors.push(`${key} は空でなければなりません（このアプリでは使っていないバインディングです）`);
    }
  }

  if (deployConfig.topLevelName !== undefined && deployConfig.topLevelName !== sourceConfig.name) {
    errors.push("topLevelName が wrangler.jsonc の name と一致しません");
  }
  checkPathInsideDist({
    errors,
    label: "main",
    value: deployConfig.main,
    configDirectory,
    distDirectory,
    expectedType: "file",
  });
  checkAssets({
    errors,
    deployAssets: deployConfig.assets,
    sourceAssets: sourceConfig.assets,
    configDirectory,
    distDirectory,
  });
  checkD1Databases({
    errors,
    deployDatabases: deployConfig.d1_databases,
    sourceDatabases: sourceConfig.d1_databases,
    configDirectory,
    rootDirectory,
  });
  return errors;
}

// コマンドライン引数から --root を読み取り、省略時はこのスクリプトの 1 つ上をルートにする。
function parseRootDirectory(argv) {
  const index = argv.indexOf("--root");
  if (index !== -1) {
    const value = argv[index + 1];
    if (!value) {
      throw new Error("--root の値がありません");
    }
    return resolve(value);
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

// CLI として実行されたときに検証し、問題があれば終了コード 1 で終える。
function main() {
  const rootDirectory = parseRootDirectory(process.argv.slice(2));
  const errors = verifyDeployConfig({ rootDirectory });
  if (errors.length > 0) {
    console.error(`デプロイ用設定の検証に失敗しました（${DEPLOY_CONFIG_RELATIVE_PATH}）:`);
    for (const message of errors) {
      console.error(`  - ${message}`);
    }
    process.exit(1);
  }
  console.log(`デプロイ用設定の検証に成功しました（${DEPLOY_CONFIG_RELATIVE_PATH}）`);
}

// テストから import されたときは実行せず、直接実行されたときだけ検証する。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
