import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const REMEMBER_ME_KEY = "fudget-remember-me";

function getSupabaseSessionKeyPrefix(): string {
  if (!supabaseUrl) return "sb-";
  try {
    const host = new URL(supabaseUrl).hostname;
    const projectRef = host.split(".")[0];
    return `sb-${projectRef}-`;
  } catch {
    return "sb-";
  }
}

const SUPABASE_SESSION_KEY_PREFIX = getSupabaseSessionKeyPrefix();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Authentication will not work.");
}

function hasWindow() {
  return typeof window !== "undefined";
}

function isRememberMeEnabled(): boolean {
  if (!hasWindow()) return true;
  return window.localStorage.getItem(REMEMBER_ME_KEY) !== "false";
}

function clearSupabaseSessionFromStorage(storage: Storage) {
  const keysToDelete: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(SUPABASE_SESSION_KEY_PREFIX)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    storage.removeItem(key);
  }
}

const adaptiveAuthStorage = {
  getItem: (key: string): string | null => {
    if (!hasWindow()) return null;
    const primary = isRememberMeEnabled() ? window.localStorage : window.sessionStorage;
    return primary.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (!hasWindow()) return;
    const primary = isRememberMeEnabled() ? window.localStorage : window.sessionStorage;
    const secondary = isRememberMeEnabled() ? window.sessionStorage : window.localStorage;
    primary.setItem(key, value);
    secondary.removeItem(key);
  },
  removeItem: (key: string): void => {
    if (!hasWindow()) return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function getRememberMePreference(): boolean {
  return isRememberMeEnabled();
}

export function setRememberMePreference(rememberMe: boolean): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "true" : "false");
  if (rememberMe) {
    clearSupabaseSessionFromStorage(window.sessionStorage);
  } else {
    clearSupabaseSessionFromStorage(window.localStorage);
  }
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: adaptiveAuthStorage,
  },
});

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
