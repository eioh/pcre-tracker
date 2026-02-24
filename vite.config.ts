import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const isGitHubPages =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_PAGES ===
  "true";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  base: isGitHubPages ? "/pcr-my-data/" : "/",
  server: {
    port: 5273,
  },
});
