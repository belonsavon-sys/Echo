/* eslint-disable no-console */

type ValidationResult = {
  errors: string[];
  warnings: string[];
};

function loadDotEnvIfAvailable(): void {
  const maybeLoadEnv = (process as any).loadEnvFile as ((path?: string) => void) | undefined;
  if (!maybeLoadEnv) return;
  try {
    maybeLoadEnv(".env");
  } catch {
    // Ignore missing .env files.
  }
}

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function validate(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nodeEnv = readEnv("NODE_ENV") || "development";
  const localDevAuth = readEnv("LOCAL_DEV_AUTH") === "true";

  const requiredAlways = ["DATABASE_URL"];
  for (const key of requiredAlways) {
    if (!readEnv(key)) {
      errors.push(`${key} is required`);
    }
  }

  if (nodeEnv === "production" && localDevAuth) {
    errors.push("LOCAL_DEV_AUTH=true is not allowed in production");
  }

  if (!localDevAuth) {
    const requiredSupabase = [
      "SUPABASE_URL",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
    ];
    for (const key of requiredSupabase) {
      if (!readEnv(key)) {
        errors.push(`${key} is required when LOCAL_DEV_AUTH is not true`);
      }
    }

    if (!readEnv("SUPABASE_JWT_AUD")) {
      warnings.push("SUPABASE_JWT_AUD is unset; server defaults to authenticated");
    }

    const supabaseUrl = readEnv("SUPABASE_URL");
    const viteSupabaseUrl = readEnv("VITE_SUPABASE_URL");
    if (supabaseUrl && viteSupabaseUrl && supabaseUrl !== viteSupabaseUrl) {
      errors.push("SUPABASE_URL and VITE_SUPABASE_URL must match");
    }
  }

  return { errors, warnings };
}

loadDotEnvIfAvailable();
const result = validate();

if (result.warnings.length > 0) {
  for (const warning of result.warnings) {
    console.warn(`[env:warn] ${warning}`);
  }
}

if (result.errors.length > 0) {
  for (const error of result.errors) {
    console.error(`[env:error] ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("[env:check] environment validation passed");
}
