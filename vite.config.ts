import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

function getPackageVersion(): string {
  try {
    const packageJsonPath = path.resolve(import.meta.dirname, "package.json");
    const contents = fs.readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(contents) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim()) {
      return parsed.version;
    }
  } catch {
    // Fall through to default.
  }
  return "0.0.0";
}

const appVersion = getPackageVersion();
const commitSha =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_SHA ||
  "local";
const buildTimeIso = new Date().toISOString();
const authMode = process.env.LOCAL_DEV_AUTH === "true" ? "LOCAL_DEV_AUTH" : "SUPABASE_JWT";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT_SHA__: JSON.stringify(commitSha),
    __APP_BUILD_TIME__: JSON.stringify(buildTimeIso),
    __AUTH_MODE__: JSON.stringify(authMode),
    __DEV_TOOLS_ENABLED__: JSON.stringify(process.env.NODE_ENV !== "production"),
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
