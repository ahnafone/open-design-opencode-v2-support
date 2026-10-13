import { getOpenDesignHost } from '@open-design/host';
import type { AppTheme } from '../types';

const ACCENT_VARS = [
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--accent-tint',
  '--accent-hover',
  '--accent-contrast',
] as const;

export const DEFAULT_ACCENT_COLOR = '#353535';
export const ACCENT_SWATCHES = [
  DEFAULT_ACCENT_COLOR,
  '#202020',
  '#848484',
  '#87ea5c',
  '#0d5400',
  '#1A74FF',
  '#FFBA12',
  '#FF7528',
  '#F04142',
] as const;

export function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function resolveAccentColor(value: unknown): string {
  return normalizeAccentColor(value) ?? DEFAULT_ACCENT_COLOR;
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
  }, 0);
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

function accentVars(accentColor: string): Record<(typeof ACCENT_VARS)[number], string> {
  const lightInk = '#fafafa';
  const darkInk = '#202020';
  const bestStandardInk = contrastRatio(lightInk, accentColor) >= contrastRatio(darkInk, accentColor) ? lightInk : darkInk;
  const contrast = contrastRatio(bestStandardInk, accentColor) >= 4.5
    ? bestStandardInk
    : contrastRatio('#ffffff', accentColor) >= contrastRatio('#000000', accentColor) ? '#ffffff' : '#000000';
  return {
    '--accent': accentColor,
    '--accent-contrast': contrast,
    // Keep these mix ratios in sync with the pre-hydration script in app/layout.tsx.
    '--accent-strong': `color-mix(in srgb, ${accentColor} 82%, var(--text-strong))`,
    '--accent-soft': `color-mix(in srgb, ${accentColor} 12%, var(--bg-subtle))`,
    '--accent-tint': `color-mix(in srgb, ${accentColor} 6%, var(--bg-panel))`,
    '--accent-hover': `color-mix(in srgb, ${accentColor} 86%, var(--text-strong))`,
  };
}

/** Return the user's valid stored selection, defaulting invalid data to system. */
export function resolveAppTheme(persisted?: AppTheme | null): AppTheme {
  return persisted === 'light' || persisted === 'dark' || persisted === 'system'
    ? persisted
    : 'system';
}

export function resolveConcreteAppTheme(
  theme: AppTheme,
  prefersDark = typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches,
): 'light' | 'dark' {
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
}

export function applyAppearanceToDocument({
  theme = 'system',
  accentColor,
}: {
  theme?: AppTheme;
  accentColor?: string;
}): void {
  const root = document.documentElement;
  const concreteTheme = resolveConcreteAppTheme(theme);
  root.setAttribute('data-theme', concreteTheme);
  // Desktop shell: keep the native window appearance (the macOS vibrancy
  // glass material) in step with the app theme. Without this the glass
  // follows the OS appearance, so the light app over a dark OS sat on dark
  // glass and read as a muddy gray (#94). Feature-detected — browsers and
  // older host builds have no appearance capability.
  getOpenDesignHost()?.appearance?.setTheme(theme);

  const normalized = normalizeAccentColor(accentColor);
  const baseAccent = normalized && normalized !== DEFAULT_ACCENT_COLOR
    ? normalized
    : concreteTheme === 'dark' ? '#ededed' : DEFAULT_ACCENT_COLOR;
  const vars = accentVars(baseAccent);
  for (const name of ACCENT_VARS) {
    root.style.setProperty(name, vars[name]);
  }
}
