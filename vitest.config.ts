import { defineConfig } from "vitest/config";

// ルートの Vitest 設定。Vitest 4 の multi-project（projects）構成で
// フロント（jsdom）と Worker（@cloudflare/vitest-pool-workers）の 2 プロジェクトを束ねる。
// 各プロジェクトの実行環境は両立しないため、それぞれ専用の設定ファイルへ分離している。
export default defineConfig({
  test: {
    projects: ["./vitest.config.front.ts", "./vitest.config.worker.ts"],
  },
});
