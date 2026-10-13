/**
 * OpenCode renamed several CLI flags in its v2 line. The daemon supports both
 * families from one adapter, so every argv decision that depends on the CLI
 * shape is derived here from the `--version` string detection already stores
 * (`DetectedRuntimeVersions.agentCliVersion`).
 *
 * Observed version strings:
 *   - v1: `1.18.34`
 *   - v2: `opencode v2.0.23`
 *
 * The family is read from the major component anywhere in the string, so both
 * shapes resolve without a per-family release parser. An unknown or missing
 * version keeps the long-standing v1 argv: that is the behavior every existing
 * install has today, and a v2 binary with a failed version probe is already
 * surfaced separately rather than silently re-flagged.
 */
export type OpenCodeCliFamily = 'v1' | 'v2';

export function openCodeCliMajor(version: string | null | undefined): number | null {
  const match = /(\d+)\.[0-9]+\.[0-9]+/.exec(
    typeof version === 'string' ? version : '',
  );
  return match ? Number(match[1]) : null;
}

export function openCodeCliFamily(version: string | null | undefined): OpenCodeCliFamily {
  const major = openCodeCliMajor(version);
  return major !== null && major >= 2 ? 'v2' : 'v1';
}

export function isOpenCodeV2(version: string | null | undefined): boolean {
  return openCodeCliFamily(version) === 'v2';
}

/**
 * v1 required an explicit `--dir <cwd>` because it promoted its worktree to the
 * nearest enclosing git root, so a managed project nested under the Open Design
 * checkout was silently replaced by the repository root. v2 no longer does that
 * — it honors the child process cwd (verified against v2.0.23, which wrote into
 * a nested non-root directory) — and `--dir` was removed. For v2 we pass no
 * flag and let the spawn cwd stand.
 */
export function openCodeWorkspaceArgs(
  version: string | null | undefined,
  cwd: string | null | undefined,
): string[] {
  if (typeof cwd !== 'string' || cwd.length === 0) return [];
  return isOpenCodeV2(version) ? [] : ['--dir', cwd];
}

/**
 * v2 moved reasoning variants out of a dedicated `--variant` flag and into the
 * model id (`provider/model#variant`). v2 also stopped exposing a variant
 * catalog through `models`, so in practice `reasoning` stays `default`; this
 * mapping keeps the transport correct if a non-default value ever arrives.
 */
export function openCodeModelArg(
  version: string | null | undefined,
  model: string,
  reasoning: string | null | undefined,
): string {
  const variant = typeof reasoning === 'string' ? reasoning.trim() : '';
  if (
    isOpenCodeV2(version)
    && variant
    && variant !== 'default'
    && !model.includes('#')
  ) {
    return `${model}#${variant}`;
  }
  return model;
}
