import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // cloudflare() は wrangler.jsonc を読み取り、Worker 実行環境と Static Assets 配信を
  // vite dev / build に統合する。base は Workers がドメイン直下配信のため "/" に統一する。
  plugins: [react(), tailwindcss(), cloudflare()],
  base: "/",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5273,
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // キャッシュ効率のため、大きなライブラリを別チャンクに分割する。
        manualChunks: (id) => {
          if (id.includes("node_modules/react-dom/") || id.includes("node_modules/react/")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/recharts/")) {
            return "recharts";
          }
          if (id.includes("node_modules/@radix-ui/") || id.includes("node_modules/@tanstack/")) {
            return "ui-vendor";
          }
        },
      },
    },
    // 本番ビルドのチャンクサイズ警告閾値を設定（過度な警告を避ける）。
    chunkSizeWarningLimit: 600,
  },
});
