import { opencodeByokModelId } from '../byok-opencode.js';
import { isOpenCodeV2 } from '../opencode-cli-version.js';
import {
  OPENCODE_PERMISSION_CAPABILITY,
  appendOpenCodePermissionBypass,
  appendOpenCodeWorkspaceDir,
} from '../opencode-permissions.js';
import { DEFAULT_MODEL_OPTION } from './shared.js';
import type { RuntimeAgentDef } from '../types.js';

export const byokOpenCodeAgentDef = {
  id: 'byok-opencode',
  name: 'BYOK OpenCode',
  bin: 'opencode-cli',
  fallbackBins: ['opencode'],
  versionArgs: ['--version'],
  ...OPENCODE_PERMISSION_CAPABILITY,
  fallbackModels: [DEFAULT_MODEL_OPTION],
  buildArgs: (_prompt, _imagePaths, _extra, options = {}, runtimeContext = {}) => {
    const args = ['run', '--format', 'json'];
    const cliVersion = runtimeContext.cliVersion ?? null;
    // v2 runs a shared background service that reads its config once, so the
    // per-run `OPENCODE_CONFIG_CONTENT` carrying the BYOK provider overlay is
    // ignored by a later `opencode run`. `--standalone` forces each run to boot
    // its own config-reading process, making the injected provider effective.
    // v1 has no such service or flag, and an unknown version keeps the v1 argv.
    if (isOpenCodeV2(cliVersion)) {
      args.push('--standalone');
    }
    // OpenCode promotes nested directories to the enclosing Git worktree unless
    // its own directory flag is explicit (v1), so a managed project under the
    // development repository can otherwise have Write/Edit target the repo root
    // instead of the selected project. v2 honors the spawn cwd and removed the
    // flag; `appendOpenCodeWorkspaceDir` picks the right shape per version.
    appendOpenCodeWorkspaceDir(args, runtimeContext.cwd, cliVersion);
    appendOpenCodePermissionBypass(args, 'byok-opencode');
    const model = opencodeByokModelId(options.model);
    if (model) args.push('-m', model);
    return args;
  },
  promptViaStdin: true,
  streamFormat: 'json-event-stream',
  eventParser: 'opencode',
  externalMcpInjection: 'opencode-env-content',
  supportsCustomModel: true,
} satisfies RuntimeAgentDef;
