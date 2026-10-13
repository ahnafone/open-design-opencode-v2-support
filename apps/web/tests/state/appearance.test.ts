// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCENT_COLOR,
  applyAppearanceToDocument,
  normalizeAccentColor,
  resolveAccentColor,
  resolveAppTheme,
  resolveConcreteAppTheme,
} from '../../src/state/appearance';

describe('normalizeAccentColor', () => {
  it('accepts six-digit hex colors and normalizes casing', () => {
    expect(normalizeAccentColor('  #4F46E5  ')).toBe('#4f46e5');
  });

  it('rejects invalid accent colors', () => {
    expect(normalizeAccentColor('blue')).toBeNull();
    expect(normalizeAccentColor('#123')).toBeNull();
    expect(normalizeAccentColor('#12345g')).toBeNull();
  });
});

describe('resolveAccentColor', () => {
  it('falls back to the first appearance color for missing or invalid values', () => {
    expect(resolveAccentColor(undefined)).toBe(DEFAULT_ACCENT_COLOR);
    expect(resolveAccentColor('blue')).toBe(DEFAULT_ACCENT_COLOR);
  });
});

describe('applyAppearanceToDocument', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-strong');
    document.documentElement.style.removeProperty('--accent-soft');
    document.documentElement.style.removeProperty('--accent-tint');
    document.documentElement.style.removeProperty('--accent-hover');
    document.documentElement.style.removeProperty('--accent-contrast');
  });

  it('applies the selected theme and accent variables to the root element', () => {
    applyAppearanceToDocument({ accentColor: '#4F46E5' });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#4f46e5');
    expect(document.documentElement.style.getPropertyValue('--accent-hover')).toContain('#4f46e5');
  });

  it('preserves the default light appearance and resolves the dark default accent', () => {
    applyAppearanceToDocument({ theme: 'light' });
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#353535');
    expect(document.documentElement.style.getPropertyValue('--accent-soft')).toContain('#353535');
    expect(document.documentElement.style.getPropertyValue('--accent-contrast')).toBe('#fafafa');

    applyAppearanceToDocument({ theme: 'dark' });
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ededed');
    expect(document.documentElement.style.getPropertyValue('--accent-contrast')).toBe('#202020');
  });

  it('derives readable contrast ink for custom light and dark accents', () => {
    applyAppearanceToDocument({ accentColor: '#ffba12' });
    expect(document.documentElement.style.getPropertyValue('--accent-contrast')).toBe('#202020');
    applyAppearanceToDocument({ accentColor: '#202020' });
    expect(document.documentElement.style.getPropertyValue('--accent-contrast')).toBe('#fafafa');
  });

  it('does not apply appearance colors to global background variables', () => {
    document.documentElement.style.setProperty('--bg', '#fafafa');
    document.documentElement.style.setProperty('--bg-app', '#f7f7f7');

    applyAppearanceToDocument({ accentColor: '#059669' });

    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#fafafa');
    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('#f7f7f7');

    document.documentElement.style.removeProperty('--bg');
    document.documentElement.style.removeProperty('--bg-app');
  });

  it('applies accent variables while selecting dark theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    applyAppearanceToDocument({ theme: 'dark', accentColor: '#10B981' });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent-strong')).toContain('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent-soft')).toContain('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent-tint')).toContain('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent-hover')).toContain('#10b981');
  });

  it('replaces existing accent variables when the saved color changes', () => {
    applyAppearanceToDocument({ accentColor: '#4F46E5' });

    applyAppearanceToDocument({ accentColor: '#EF4444' });

    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ef4444');
    expect(document.documentElement.style.getPropertyValue('--accent-strong')).toContain('#ef4444');
    expect(document.documentElement.style.getPropertyValue('--accent-strong')).not.toContain('#4f46e5');
    expect(document.documentElement.style.getPropertyValue('--accent-soft')).toContain('#ef4444');
    expect(document.documentElement.style.getPropertyValue('--accent-tint')).toContain('#ef4444');
    expect(document.documentElement.style.getPropertyValue('--accent-hover')).toContain('#ef4444');
  });

  it('falls back to the default accent when no valid accent is configured', () => {
    document.documentElement.style.setProperty('--accent', '#4f46e5');

    applyAppearanceToDocument({ accentColor: 'not-a-color' });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#353535');
  });
});

describe('theme resolution', () => {
  it('preserves valid choices and falls back to system for invalid values', () => {
    expect(resolveAppTheme('light')).toBe('light');
    expect(resolveAppTheme('dark')).toBe('dark');
    expect(resolveAppTheme('system')).toBe('system');
    expect(resolveAppTheme('other' as never)).toBe('system');
  });

  it('resolves system safely when matchMedia is unavailable', () => {
    expect(resolveConcreteAppTheme('system')).toBe('light');
  });
});
