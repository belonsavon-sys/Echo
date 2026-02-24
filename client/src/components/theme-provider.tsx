import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const themes = [
  { id: "default", name: "Default", preview: "#3b82f6" },
  { id: "ocean", name: "Ocean", preview: "#0ea5c9" },
  { id: "sunset", name: "Sunset", preview: "#f97316" },
  { id: "forest", name: "Forest", preview: "#2f9e6e" },
  { id: "midnight", name: "Midnight", preview: "#5b5bf7" },
  { id: "rose", name: "Rose", preview: "#e04882" },
  { id: "amber", name: "Amber", preview: "#e5a000" },
  { id: "lavender", name: "Lavender", preview: "#9b6dd7" },
  { id: "slate", name: "Slate", preview: "#6b7f99" },
  { id: "coral", name: "Coral", preview: "#d96a51" },
] as const;

type ThemeId = (typeof themes)[number]["id"];

interface ThemeContextValue {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  theme: string;
  setTheme: (value: string) => void;
  themes: typeof themes;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem("fudget-dark-mode");
      return stored === "true";
    } catch {
      return false;
    }
  });

  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem("fudget-theme") || "default";
    } catch {
      return "default";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("fudget-dark-mode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const root = document.documentElement;
    themes.forEach((t) => {
      if (t.id !== "default") {
        root.classList.remove(`theme-${t.id}`);
      }
    });
    if (theme !== "default") {
      root.classList.add(`theme-${theme}`);
    }
    localStorage.setItem("fudget-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
