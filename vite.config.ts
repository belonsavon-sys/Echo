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

function getManualChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("recharts")) return "charts-vendor";
  if (id.includes("@radix-ui")) return "radix-vendor";
  if (id.includes("@supabase") || id.includes("/jose/")) return "auth-vendor";
  if (id.includes("@tanstack/react-query")) return "query-vendor";
  if (id.includes("@dnd-kit")) return "dnd-vendor";
  if (id.includes("react-day-picker") || id.includes("date-fns")) return "date-vendor";
  return "vendor";
}

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
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
