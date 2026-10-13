// The splash renders the Home hero's pixel-scan wordmark, and it has to do it
// with everything inlined: the window is up BEFORE the web sidecar, so there is
// no origin to fetch a bundle, `three`, or the logo SVG from. These specs pin
// the properties that break silently — a stray external reference, a shader
// that stopped matching the web engine's, or a one-shot animation that leaves
// the rest of a cold boot on a frozen frame.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
  SPLASH_LOGO_DATA_URL,
  SPLASH_PIXEL_SCAN_MARKUP,
  SPLASH_PIXEL_SCAN_STYLE,
  splashPixelScanScript,
} from '../../src/main/splash-pixel-scan.js';

const script = splashPixelScanScript("light");
const webEngineSource = readFileSync(
  fileURLToPath(new URL('../../../web/src/components/home-hero/pixel-scan/engine.ts', import.meta.url)),
  'utf8',
);

function webShader(name: 'SHADER' | 'VERT'): string {
  const match = new RegExp(`const ${name} = \`\\n([\\s\\S]*?)\\n\`;`).exec(webEngineSource);
  if (!match?.[1]) throw new Error(`could not read ${name} from the web pixel-scan engine`);
  return match[1];
}

describe('splash pixel-scan wordmark', () => {
  test('inlines every asset it needs (no origin exists yet at splash time)', () => {
    expect(SPLASH_LOGO_DATA_URL.startsWith('data:image/svg+xml;base64,')).toBe(true);
    // Nothing may reach for a URL: no fetch, no <img src="/…">, no import.
    expect(script).not.toMatch(/fetch\(|import\(|src\s*=\s*["']\//);
    expect(script).toContain('var LOGO_SRC = "data:image/svg+xml;base64,');
    expect(SPLASH_PIXEL_SCAN_MARKUP).toContain('id="splash-canvas"');
    expect(SPLASH_PIXEL_SCAN_STYLE).toContain('aspect-ratio: 1705 / 291');
  });

  test('runs the same shader as the Home hero', () => {
    // The port is verbatim on purpose — if the effect is retuned on the web
    // side and not copied here, the splash and the Home logo drift apart.
    expect(script).toContain(JSON.stringify(`\n${webShader('SHADER')}\n`));
    expect(script).toContain(JSON.stringify(`\n${webShader('VERT')}\n`));
  });

  test('tints only the dark-mode glyph white', () => {
    const darkScript = splashPixelScanScript("dark");
    const functionBody = (name: string): string => {
      const start = darkScript.indexOf(`function ${name}(`);
      expect(start, `${name} function should exist`).toBeGreaterThanOrEqual(0);
      const bodyStart = darkScript.indexOf('{', start);
      const nextFunction = darkScript.indexOf('\n        function ', bodyStart);
      return darkScript.slice(bodyStart, nextFunction < 0 ? undefined : nextFunction);
    };
    for (const name of ['rasterise', 'drawStatic']) {
      const body = functionBody(name);
      const sourceIn = body.indexOf('globalCompositeOperation = "source-in"');
      const whiteFill = body.indexOf('fillStyle = "#ffffff"');
      const fillRect = body.indexOf('fillRect(');
      const sourceOver = body.indexOf('globalCompositeOperation = "source-over"');
      expect(sourceIn, `${name} enables source-in`).toBeGreaterThanOrEqual(0);
      expect(whiteFill, `${name} selects white`).toBeGreaterThan(sourceIn);
      expect(fillRect, `${name} paints the white fill`).toBeGreaterThan(whiteFill);
      expect(sourceOver, `${name} restores source-over`).toBeGreaterThan(fillRect);
    }
    expect(script).not.toContain('fillStyle = "#ffffff"');
    expect(darkScript).toContain('var ACCENT = [0.529, 0.918, 0.361];');
  });

  test('loops the sweep instead of playing once', () => {
    // A boot runs from ~2s to a cold minute; the previous splash clip played
    // once and held its last frame for the remainder.
    expect(script).toContain('var ENTRANCE_SECONDS = 2.6;');
    expect(script).toContain('var HOLD_SECONDS = 1.1;');
    expect(script).toContain('cycleStart = now;');
    expect(script).toContain('raf = requestAnimationFrame(frame);');
  });

  test('never leaves the window blank when WebGL is unavailable or lost', () => {
    expect(script).toContain('function drawStatic()');
    expect(script).toContain('webglcontextlost');
    expect(script).toContain('webglcontextrestored');
    // Context loss must fall back to the static wordmark, not just stop.
    const lostHandler = script.slice(script.indexOf('webglcontextlost'));
    expect(lostHandler.slice(0, 400)).toContain('drawStatic()');
  });
});
