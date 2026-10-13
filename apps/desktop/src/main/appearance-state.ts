import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { app } from "electron";

/** Desktop-shell appearance state for painting the splash before the web boots; deliberately NOT daemon data. */
export type AppAppearanceTheme = "light" | "dark" | "system";

export function isAppAppearanceTheme(value: unknown): value is AppAppearanceTheme {
  return value === "light" || value === "dark" || value === "system";
}

export function readPersistedAppearanceTheme(path: string): AppAppearanceTheme {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { theme?: unknown };
    return isAppAppearanceTheme(parsed?.theme) ? parsed.theme : "system";
  } catch {
    return "system";
  }
}

export function persistAppearanceTheme(path: string, theme: AppAppearanceTheme): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ theme }), "utf8");
  } catch (error) {
    console.warn("[open-design desktop] failed to persist appearance theme", error);
  }
}

export function resolveAppearanceStatePath(): string {
  return join(app.getPath("userData"), "appearance.json");
}
