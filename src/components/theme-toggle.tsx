"use client";

import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "gapfinder-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable in private mode; the in-session theme still applies.
    }
  }

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
    >
      <Sun size={15} className="theme-toggle-sun" aria-hidden />
      <Moon size={15} className="theme-toggle-moon" aria-hidden />
    </button>
  );
}
