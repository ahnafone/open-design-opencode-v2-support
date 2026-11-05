import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { agentCapabilities } from './capabilities.js';
import { openCodeWorkspaceArgs } from './opencode-cli-version.js';
import { execAgentFile } from './invocation.js';
import type { RuntimeAgentDef } from './types.js';

export const OPENCODE_SKIP_PERMISSIONS_FLAG = '--dangerously-skip-permissions';
export const OPENCODE_AUTO_APPROVE_FLAG = '--auto';
export const OPENCODE_WORKSPACE_DIR_FLAG = '--dir';

export const OPENCODE_PERMISSION_CAPABILITY = {
  helpArgs: ['run', '--help'],
  capabilityFlags: {
    [OPENCODE_SKIP_PERMISSIONS_FLAG]: 'skipPermissions',
    // OpenCode v2 renamed `--dangerously-skip-permissions` to `--auto`. Probed
    // from the same `run --help` read, so the adapter forwards whichever flag
    // the installed build actually advertises. Without one of these a
    // non-interactive run has every tool call rejected by the permission gate.
    [OPENCODE_AUTO_APPROVE_FLAG]: 'autoApprove',
  },
} satisfies Pick<RuntimeAgentDef, 'helpArgs' | 'capabilityFlags'>;

export function appendOpenCodePermissionBypass(args: string[], agentId: string): void {
  const capabilities = agentCapabilities.get(agentId);
  if (capabilities?.skipPermissions) {
    args.push(OPENCODE_SKIP_PERMISSIONS_FLAG);
    return;
  }
  if (capabilities?.autoApprove) {
    args.push(OPENCODE_AUTO_APPROVE_FLAG);
  }
}

export interface OpenCodeEditBaseResolution {
  /** Every worktree OpenCode may resolve edits against; deny rules cover all. */
  dirs: string[];
  /** How `git rev-parse` answered. A failure no longer withholds the grant. */
  gitProbe: 'resolved' | 'not_git' | 'failed';
  gitProbeError?: string;
}

/**
 * The worktrees OpenCode may check relative edit paths against.
 *
 * OpenCode adopts the enclosing Git worktree, or the volume root outside Git.
 * Resource rules only add `deny` entries, so covering every candidate base
 * can never widen write access. Candidates come from the filesystem (the
 * nearest ancestor holding `.git`, and the volume root) plus Git's own answer
 * when it gives one. A failed or slow `git rev-parse` therefore no longer
 * withholds the task-profile grant: on a Windows package it was killed by its
 * 2 s timeout, the run could not read its profile, and it ended without the
 * requested change (OPEND-4366 W03). Only an ancestor whose `.git` cannot be
 * checked leaves the base unconfirmed; that still throws, and the caller
 * withholds the grant.
 */
export async function resolveOpenCodeEditBaseDirs(cwd: string): Promise<OpenCodeEditBaseResolution> {
  const start = path.resolve(cwd);
  const real = await realpath(start).catch(() => start);
  const dirs = new Set<string>([path.parse(start).root, path.parse(real).root]);
  for (const from of new Set([start, real])) {
    const found = await nearestGitAncestor(from);
    if (found) dirs.add(found);
  }
  try {
    const { stdout } = await execAgentFile('git', ['rev-parse', '--show-toplevel'], {
      cwd, timeout: 2_000, env: { ...process.env, LC_ALL: 'C' },
    });
    const root = String(stdout).trim();
    if (!path.isAbsolute(root)) throw new Error('Git did not return an absolute OpenCode edit base.');
    dirs.add(path.resolve(root));
    return { dirs: [...dirs], gitProbe: 'resolved' };
  } catch (error) {
    const failure = error as { stderr?: unknown; message?: unknown };
    if (String(failure.stderr ?? '').includes('not a git repository')) {
      return { dirs: [...dirs], gitProbe: 'not_git' };
    }
    return {
      dirs: [...dirs],
      gitProbe: 'failed',
      gitProbeError: String(failure.message ?? error).split('\n')[0] ?? '',
    };
  }
}

async function nearestGitAncestor(from: string): Promise<string | null> {
  let dir = from;
  for (;;) {
    try {
      await lstat(path.join(dir, '.git'));
      return dir;
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      // Anything but "absent" means this level is unknown, and an unknown
      // worktree must not produce a grant with edit rules for the wrong root.
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Pin OpenCode's workspace to the resolved project directory.
 *
 * OpenCode v1 did not treat its process cwd as the project: it walked up to the
 * nearest enclosing git root and adopted THAT as the worktree (verified with
 * `opencode debug scrap`, whose every registered project is a git root). A
 * managed project directory is not a git repository, and a development install
 * keeps the daemon data directory under the repository root — so OpenCode walked
 * past the project and adopted the whole Open Design checkout.
 *
 * The consequences were all silent: the agent named the repository root as its
 * workspace and wrote the deliverable there, the project directory stayed
 * empty, `snapshotProjectArtifactsAsync(cwd)` saw nothing, and the Run reported
 * `no_artifact`. `permission.external_directory` could not catch it either —
 * once the repository is the worktree, writing inside it is an in-project write.
 *
 * v1 therefore received `--dir <cwd>` unconditionally, matching the BYOK OpenCode
 * definition that already carried this workaround. A v1 build without `--dir`
 * should still fail loudly at spawn rather than silently write to the wrong
 * root.
 *
 * OpenCode v2 honors the child process cwd and removed `--dir`; see
 * `openCodeWorkspaceArgs`, which returns nothing for v2 so the spawn cwd stands.
 */
export function appendOpenCodeWorkspaceDir(
  args: string[],
  cwd: string | null | undefined,
  version: string | null | undefined,
): void {
  args.push(...openCodeWorkspaceArgs(version, cwd));
}

/**
 * System temporary directories a headless OpenCode run may use.
 *
 * Agents write scratch files to temp paths on their own: thumbnails, ffmpeg
 * frames, browser probe scripts, usually as literal `/tmp/...` paths rather
 * than through `$TMPDIR`. Without an `external_directory` grant a headless
 * OpenCode run auto-rejects the follow-up read with "The user rejected
 * permission", and the model then ends the turn with no output.
 *
 * Codex's workspace-write sandbox makes `/tmp` and `$TMPDIR` writable by
 * default for the same reason. The caller's allowlist builder adds realpath
 * variants, so macOS `/private/tmp` and `/private/var/folders/...` follow.
 */
export function openCodeSystemTempDirectories(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (platform === 'win32') {
    const value = (key: string) => env[
      Object.keys(env).find((name) => name.toLowerCase() === key.toLowerCase()) ?? key
    ];
    const root = value('TEMP') || value('TMP') || `${value('SystemRoot') || value('windir')}\\temp`;
    return [root.length > 1 && root.endsWith('\\') && root.at(-2) !== ':' ? root.slice(0, -1) : root];
  }
  const root = env.TMPDIR || env.TMP || env.TEMP || '/tmp';
  return Array.from(new Set([root.length > 1 && root.endsWith('/') ? root.slice(0, -1) : root, '/tmp']));
}
