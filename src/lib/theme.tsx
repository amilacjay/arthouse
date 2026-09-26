"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "arthouse:theme";

/**
 * Applied before paint by the inline script in the document head, so the first
 * frame is already in the right theme. Kept in sync here for runtime changes.
 */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var dark = stored === "dark" || ((!stored || stored === "system") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

type ThemeContextValue = {
  choice: ThemeChoice;
  resolved: "light" | "dark";
  setChoice: (c: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [systemDark, setSystemDark] = useState(false);

  // Read the stored choice after mount; rendering the same markup on both
  // sides avoids a hydration mismatch.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setChoiceState(stored);
      }
    } catch {
      /* storage may be blocked */
    }
    setSystemDark(systemPrefersDark());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" =
    choice === "system" ? (systemDark ? "dark" : "light") : choice;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ choice, resolved, setChoice }),
    [choice, resolved, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return ctx;
}
