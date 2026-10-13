// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAppearanceToDocument, resolveAppTheme, resolveConcreteAppTheme } from '../../src/state/appearance';
import { DEFAULT_CONFIG, loadConfig } from '../../src/state/config';

const storageKey = 'open-design:config';

function mockScheme(prefersDark: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: prefersDark })));
}

describe('theme behavior', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
  });

  it('defaults a fresh install to system and preserves valid persisted selections', () => {
    expect(DEFAULT_CONFIG.theme).toBe('system');
    expect(loadConfig().theme).toBe('system');
    localStorage.setItem(storageKey, JSON.stringify({ theme: 'dark' }));
    expect(loadConfig().theme).toBe('dark');
  });

  it('resolves system to the concrete OS preference in both directions', () => {
    expect(resolveAppTheme('dark')).toBe('dark');
    expect(resolveAppTheme('invalid' as never)).toBe('system');
    expect(resolveConcreteAppTheme('system', true)).toBe('dark');
    expect(resolveConcreteAppTheme('system', false)).toBe('light');
    expect(resolveConcreteAppTheme('dark', false)).toBe('dark');
  });

  it('stamps only concrete themes and treats missing matchMedia as light', () => {
    vi.stubGlobal('matchMedia', undefined);
    applyAppearanceToDocument({ theme: 'system' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    applyAppearanceToDocument({ theme: 'dark' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('pre-hydration script paints the persisted selection resolved against the OS', () => {
    const layoutPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../app/layout.tsx');
    const source = readFileSync(layoutPath, 'utf8');
    const match = /const themeInitScript = `([^`]*)`;/.exec(source);
    if (!match?.[1]) throw new Error('themeInitScript not found');
    localStorage.setItem(storageKey, JSON.stringify({ theme: 'system' }));
    mockScheme(true);
    // eslint-disable-next-line no-new-func
    new Function(match[1])();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    mockScheme(false);
    // eslint-disable-next-line no-new-func
    new Function(match[1])();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('pre-hydration script falls back to light when matchMedia is unavailable', () => {
    const layoutPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../app/layout.tsx');
    const source = readFileSync(layoutPath, 'utf8');
    const match = /const themeInitScript = `([^`]*)`;/.exec(source);
    if (!match?.[1]) throw new Error('themeInitScript not found');
    vi.stubGlobal('matchMedia', undefined);
    localStorage.clear();
    // eslint-disable-next-line no-new-func
    new Function(match[1])();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
