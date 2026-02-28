import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isGitHubPages =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_PAGES ===
  "true";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isGitHubPages ? "/pcr-my-data/" : "/",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5273,
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
