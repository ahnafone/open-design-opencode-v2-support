import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/home/entry-layout.css', import.meta.url), 'utf8');

describe('Home content surface theme', () => {
  it('keeps a light base surface and overrides it for dark theme', () => {
    expect(css).toMatch(/\.entry-main--scroll\s*\{[^}]*--entry-content-surface:\s*rgba\(255, 255, 255, 0\.85\)/s);
    const darkRule = css.match(/\[data-theme="dark"\]\s+\.entry-main--scroll\s*\{([^}]*)\}/s)?.[1];
    expect(darkRule).toBeTruthy();
    expect(darkRule).toMatch(/--entry-content-surface:\s*rgba\(32, 32, 32, 0\.85\)/);
    expect(darkRule).not.toMatch(/--entry-content-surface:\s*rgba\(255, 255, 255, 0\.85\)/);
  });

  it('keeps the solid-surface fallbacks winning for an explicit dark theme', () => {
    for (const atRule of [
      '@media (prefers-reduced-transparency: reduce)',
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
    ]) {
      const start = css.indexOf(atRule);
      expect(start, `missing ${atRule}`).toBeGreaterThanOrEqual(0);
      const open = css.indexOf('{', start);
      let depth = 0;
      let end = open;
      for (; end < css.length; end += 1) {
        if (css[end] === '{') depth += 1;
        if (css[end] === '}' && --depth === 0) break;
      }
      const body = css.slice(open + 1, end);
      const darkFallback = body.match(/([^{}]+)\{[^{}]*--entry-content-surface:\s*var\(--bg\)/s)?.[1] ?? '';
      expect(darkFallback).toMatch(/\[data-theme="dark"\]\s*\.entry-main--scroll/);
    }
  });
});
