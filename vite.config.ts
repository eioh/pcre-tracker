import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // cloudflare() は wrangler.jsonc を読み取り、Worker 実行環境と Static Assets 配信を
  // vite dev / build に統合する。base は Workers がドメイン直下配信のため "/" に統一する。
  // VitePWA は Workbox generateSW でアプリシェルを precache する Service Worker を生成し、
  // クライアント出力（dist/client）へ sw.js / manifest.webmanifest を書き出す。
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    VitePWA({
      // 更新はユーザー操作で適用する（自動リロードで編集を失わせない）。
      registerType: "prompt",
      // dev では Service Worker を無効化する（デフォルト off のまま明示）。
      devOptions: { enabled: false },
      // manifest の icons は globPatterns（icons/*.png）で precache 済みのため、
      // プラグインの自動追加を無効化して precache エントリの重複を防ぐ。
      includeManifestIcons: false,
      // precache 対象。7MB の favicon.png を巻き込まないよう拡張子を限定し、
      // アイコンは public/icons/ 配下のものだけを対象にする。
      // manifest.webmanifest はプラグインが precache へ自動追加するため glob には含めない（重複防止）。
      workbox: {
        globPatterns: ["**/*.{js,css,html}", "icons/*.png"],
        // SPA オフライン起動のためナビゲーションは index.html へフォールバックする。
        navigateFallback: "/index.html",
        // /api/* は better-auth の OAuth リダイレクトやデータ同期のため SW を介入させない。
        navigateFallbackDenylist: [/^\/api\//],
        // オフライン起動時のフォント崩れ防止に Google Fonts をランタイムキャッシュする。
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              // styles.css の @import 経由（no-cors）では opaque レスポンス（status 0）になるため、
              // 0 を許可しないと stylesheet がキャッシュされずオフライン起動時にフォントが崩れる。
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      // ホーム画面追加（A2HS）とスタンドアロン起動のための Web App Manifest。
      manifest: {
        name: "プリコネ育成トラッカー",
        short_name: "プリコネ育成",
        description: "プリンセスコネクト！Re:Dive のキャラクター育成状況を管理するツール",
        lang: "ja",
        display: "standalone",
        start_url: "/",
        scope: "/",
        theme_color: "#0d1117",
        background_color: "#0d1117",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
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
