import { agentCapabilities } from './capabilities.js';
import { openCodeWorkspaceArgs } from './opencode-cli-version.js';
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
