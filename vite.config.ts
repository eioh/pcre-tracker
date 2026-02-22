import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubPages =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_PAGES ===
  "true";

export default defineConfig({
  plugins: [react()],
  base: isGitHubPages ? "/pcr-my-data/" : "/",
});
