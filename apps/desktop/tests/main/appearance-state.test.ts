import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { persistAppearanceTheme, readPersistedAppearanceTheme } from "../../src/main/appearance-state.js";

const dirs: string[] = [];
function testPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "od-appearance-"));
  dirs.push(dir);
  return join(dir, "nested", "appearance.json");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("desktop appearance state", () => {
  test("persists and reads a theme", () => {
    const path = testPath();
    mkdirSync(join(path, ".."), { recursive: true });
    persistAppearanceTheme(path, "dark");
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ theme: "dark" });
    expect(readPersistedAppearanceTheme(path)).toBe("dark");
  });

  test.each(["missing", "invalid JSON", "invalid theme"])("defaults to system for %s", (kind) => {
    const path = testPath();
    mkdirSync(join(path, ".."), { recursive: true });
    if (kind === "invalid JSON") writeFileSync(path, "{");
    if (kind === "invalid theme") writeFileSync(path, JSON.stringify({ theme: "sepia" }));
    expect(readPersistedAppearanceTheme(path)).toBe("system");
  });

  test("defaults to system without throwing when the input path is a directory", () => {
    const path = testPath();
    mkdirSync(path, { recursive: true });
    expect(() => readPersistedAppearanceTheme(path)).not.toThrow();
    expect(readPersistedAppearanceTheme(path)).toBe("system");
  });

  test("creates missing nested directories when persisting a theme", () => {
    const path = testPath();
    expect(() => persistAppearanceTheme(path, "dark")).not.toThrow();
    expect(statSync(join(path, "..")).isDirectory()).toBe(true);
    expect(readPersistedAppearanceTheme(path)).toBe("dark");
  });

  test("does not throw when the persistence parent path is a file", () => {
    const path = testPath();
    const parent = join(path, "..");
    writeFileSync(parent, "not a directory");
    expect(() => persistAppearanceTheme(path, "dark")).not.toThrow();
  });
});
