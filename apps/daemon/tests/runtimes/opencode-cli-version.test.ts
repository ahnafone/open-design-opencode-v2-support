import { describe, expect, it } from 'vitest';

import {
  isOpenCodeV2,
  openCodeCliFamily,
  openCodeCliMajor,
  openCodeModelArg,
  openCodeWorkspaceArgs,
} from '../../src/runtimes/opencode-cli-version.js';

describe('opencode cli version family', () => {
  it('reads the major from both known version string shapes', () => {
    expect(openCodeCliMajor('1.18.34')).toBe(1);
    expect(openCodeCliMajor('opencode v2.0.23')).toBe(2);
    expect(openCodeCliMajor('v2.1.0-beta.3')).toBe(2);
    expect(openCodeCliMajor(null)).toBeNull();
    expect(openCodeCliMajor('')).toBeNull();
    expect(openCodeCliMajor('not-a-version')).toBeNull();
  });

  it('treats unknown versions as the long-standing v1 family', () => {
    expect(openCodeCliFamily('1.18.34')).toBe('v1');
    expect(openCodeCliFamily('opencode v2.0.23')).toBe('v2');
    expect(openCodeCliFamily(undefined)).toBe('v1');
    expect(isOpenCodeV2('2.0.23')).toBe(true);
    expect(isOpenCodeV2('1.18.34')).toBe(false);
  });
});

describe('opencode workspace args', () => {
  it('passes --dir only for the v1 family', () => {
    expect(openCodeWorkspaceArgs('1.18.34', '/tmp/project')).toEqual([
      '--dir',
      '/tmp/project',
    ]);
  });

  it('omits --dir for v2, which honors the spawn cwd', () => {
    expect(openCodeWorkspaceArgs('opencode v2.0.23', '/tmp/project')).toEqual([]);
  });

  it('omits the flag when no cwd is known', () => {
    expect(openCodeWorkspaceArgs('1.18.34', '')).toEqual([]);
    expect(openCodeWorkspaceArgs('1.18.34', null)).toEqual([]);
  });
});

describe('opencode model arg', () => {
  it('keeps the plain model id for v1 and appends the variant only for v2', () => {
    expect(openCodeModelArg('1.18.34', 'opencode-go/glm-5.3', 'high')).toBe(
      'opencode-go/glm-5.3',
    );
    expect(openCodeModelArg('opencode v2.0.23', 'opencode-go/glm-5.3', 'high')).toBe(
      'opencode-go/glm-5.3#high',
    );
  });

  it('ignores default/empty variants and an already-qualified model', () => {
    expect(openCodeModelArg('2.0.23', 'p/m', 'default')).toBe('p/m');
    expect(openCodeModelArg('2.0.23', 'p/m', '')).toBe('p/m');
    expect(openCodeModelArg('2.0.23', 'p/m#low', 'high')).toBe('p/m#low');
  });
});
