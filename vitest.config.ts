import { defineConfig } from "vitest/config";

// ルートの Vitest 設定。Vitest 4 の multi-project（projects）構成で
// フロント（jsdom）と Worker（@cloudflare/vitest-pool-workers）の 2 プロジェクトを束ねる。
// 各プロジェクトの実行環境は両立しないため、それぞれ専用の設定ファイルへ分離している。
// scripts/ 配下の Node 用スクリプトのテストは、設定が小さいため Node 環境のプロジェクトとしてここに直接書く。
export default defineConfig({
  test: {
    projects: [
      "./vitest.config.front.ts",
      "./vitest.config.worker.ts",
      {
        test: {
          // プロジェクト名。`npm test` の出力やフィルタリングで識別に使う。
          name: "scripts",
          // DOM を使わない Node.js スクリプトなので Node 環境で実行する。
          environment: "node",
          include: ["scripts/**/*.test.mjs"],
        },
      },
    ],
  },
});
