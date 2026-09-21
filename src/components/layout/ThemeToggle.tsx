"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
  /** Show a text label next to the icon (used inside sidebars). */
  showLabel?: boolean;
}

export default function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className={cn(
        "inline-flex items-center gap-3 rounded-btn text-textDim transition duration-200 hover:bg-surface2 hover:text-text",
        showLabel ? "w-full px-5 py-3 text-sm" : "p-2",
        className
      )}
    >
      {isDark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
      {showLabel && <span>{isDark ? "Tema claro" : "Tema escuro"}</span>}
    </button>
  );
}
