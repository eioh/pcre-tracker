var _a, _b;
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var isGitHubPages = ((_b = (_a = globalThis.process) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.GITHUB_PAGES) ===
    "true";
export default defineConfig({
    plugins: [react()],
    base: isGitHubPages ? "/pcr-my-data/" : "/",
});
