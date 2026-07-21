import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";

// フロントエンド（React + jsdom）向けのテストプロジェクト設定。
// 従来 vitest.config.ts に置いていた jsdom 構成をそのまま projects の 1 つとして切り出したもの。
// Worker 用プロジェクト（vitest.config.worker.ts）とは実行環境が両立しないため分離している。
export default defineProject({
  plugins: [react()],
  resolve: {
    alias: {
      // 本番のみ vite-plugin-pwa が実体化する仮想モジュール。テストにはプラグインが無く
      // Vite の import 解析が失敗するため、no-op スタブへ差し替えて解決させる（実行はされない）。
      "virtual:pwa-register": fileURLToPath(new URL("./src/test/stubs/virtual-pwa-register.ts", import.meta.url)),
    },
  },
  test: {
    // プロジェクト名。`npm test` の出力やフィルタリングで識別に使う。
    name: "front",
    // React コンポーネントのテストに必要な DOM 環境。
    environment: "jsdom",
    // Testing Library のマッチャ登録や cleanup を行う共通セットアップ。
    setupFiles: "./src/test/setup.ts",
    // フロント側テストのみを対象にする（Worker 側テストは worker プロジェクトが担当）。
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
