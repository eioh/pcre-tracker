// 0.18.x では readD1Migrations / cloudflareTest ともにパッケージのルートから export される
// （旧版の "@cloudflare/vitest-pool-workers/config" サブパスは存在しない）。
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineProject } from "vitest/config";

// Cloudflare Workers（miniflare 実行環境）向けのテストプロジェクト設定。
// @cloudflare/vitest-pool-workers 0.18.x の cloudflareTest() プラグイン方式を用い、
// wrangler.jsonc の設定（main / bindings 等）を読み取って Worker をテスト用に起動する。
export default defineProject({
  plugins: [
    // 非同期ファクトリで migrations/ 配下のマイグレーションを読み込み、miniflare のバインディングとして渡す。
    // Phase 2 本体で migrations/ に SQL が追加されるまでは空配列（マイグレーション 0 件）になるが、
    // readD1Migrations は空ディレクトリでも [] を返すため壊れない。
    cloudflareTest(async () => {
      // リポジトリ直下の migrations/ ディレクトリを読み込む。
      // Vitest はプロジェクトルートを cwd として実行するため、相対パス "migrations" で解決できる
      // （node:path / __dirname を使わず @types/node への依存を避ける意図）。
      // ディレクトリ内の *.sql をマイグレーション番号順に読み込む（0 件なら空配列）。
      const migrations = await readD1Migrations("migrations");
      return {
        // テストと同一アイソレートで動かす Worker のエントリポイント（SELF 経由の fetch に必要）。
        main: "./worker/index.ts",
        miniflare: {
          // setup ファイルからマイグレーション一覧を参照できるよう、テスト用バインディングとして渡す。
          // Phase 2 で D1 バインディング（DB）が追加されるまでは適用対象がないため実質 no-op。
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  test: {
    // プロジェクト名。`npm test` の出力やフィルタリングで識別に使う。
    name: "worker",
    // Worker 側テストのセットアップ（D1 マイグレーション適用の骨格）。
    setupFiles: ["./test/worker/apply-migrations.ts"],
    // Worker 側テストのみを対象にする。
    include: ["test/worker/**/*.test.ts"],
  },
});
