"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AccentTheme = "ember" | "signal";

type ThemeContextValue = {
  theme: AccentTheme;
  setTheme: (theme: AccentTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: AccentTheme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<AccentTheme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next: AccentTheme) => {
    setThemeState(next);
    void fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
