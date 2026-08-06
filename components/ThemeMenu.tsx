"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import styles from "./TitanTheme.module.css";

export type TitanTheme = "dark" | "light" | "system";

const STORAGE_KEY = "project-titan-theme";

function isTitanTheme(value: string | null): value is TitanTheme {
  return value === "dark" || value === "light" || value === "system";
}

function resolveTheme(theme: TitanTheme): "dark" | "light" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: TitanTheme): void {
  const resolved = resolveTheme(theme);
  const documentRoot = document.documentElement;
  documentRoot.dataset.theme = resolved;
  documentRoot.dataset.themePreference = theme;
  documentRoot.style.colorScheme = resolved;
}

export default function ThemeMenu() {
  const [theme, setTheme] = useState<TitanTheme>("system");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initial: TitanTheme = isTitanTheme(saved) ? saved : "system";
    setTheme(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = () => {
      const preference = window.localStorage.getItem(STORAGE_KEY);
      if (preference === "system" || preference === null) applyTheme("system");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const selectTheme = (next: TitanTheme) => {
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    setOpen(false);
  };

  const CurrentIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const currentLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";
  const options = [
    { value: "dark" as const, label: "Dark", description: "Deep navy command centre", icon: Moon },
    { value: "light" as const, label: "Light", description: "Bright professional workspace", icon: Sun },
    { value: "system" as const, label: "System", description: "Follow this device", icon: Monitor },
  ];

  return (
    <div className={styles.themeMenuRoot} ref={rootRef}>
      <button type="button" className={styles.themeMenuButton} onClick={() => setOpen((value) => !value)} aria-label="Choose appearance theme" aria-haspopup="menu" aria-expanded={open}>
        <CurrentIcon size={17} />
        <span>{currentLabel}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className={styles.themeMenuPanel} role="menu">
          <div className={styles.themeMenuTitle}>Appearance</div>
          {options.map((option) => {
            const Icon = option.icon;
            const selected = theme === option.value;
            return (
              <button type="button" className={styles.themeMenuOption} key={option.value} onClick={() => selectTheme(option.value)} role="menuitemradio" aria-checked={selected}>
                <span className={styles.themeOptionIcon}><Icon size={17} /></span>
                <span className={styles.themeOptionText}><strong>{option.label}</strong><small>{option.description}</small></span>
                {selected ? <Check size={16} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
