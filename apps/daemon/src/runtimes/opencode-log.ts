// OpenCode swallows provider failures in headless `run --format json` mode:
// on a 429 usage-limit (and similar), it marks the error retryable, retries
// silently, and emits NOTHING on stdout/stderr — so the daemon only sees an
// inactivity-watchdog timeout with no reason. The real error is recorded
// only in OpenCode's own session log (`service=llm … error={…}`). This
// module recovers that signal so the chat UI can show "usage limit reached"
// instead of a bare timeout. OpenCode-specific by design; see issue #982.

import { closeSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { classifyAgentServiceFailure, type AgentServiceFailureCode } from './auth.js';

export interface OpenCodeServiceFailure {
  code: AgentServiceFailureCode;
  message: string;
  retryable: boolean;
  statusCode: number | null;
}

// OpenCode resolves its data dir as `$XDG_DATA_HOME/opencode` (when set) or
// `$HOME/.local/share/opencode`, with session logs under `log/`. Mirror that
// so we read the same files the spawned CLI wrote. Null when neither var is
// set (we have no basis to guess a path).
export function resolveOpenCodeLogDir(
  env: Record<string, string | undefined>,
): string | null {
  const xdg = typeof env.XDG_DATA_HOME === 'string' ? env.XDG_DATA_HOME.trim() : '';
  const home = typeof env.HOME === 'string' ? env.HOME.trim() : '';
  const base = xdg || (home ? path.join(home, '.local', 'share') : '');
  if (!base) return null;
  return path.join(base, 'opencode', 'log');
}

// Read the tail of OpenCode's most recent session log. Filenames are
// `<ISO-like-timestamp>.log`, so a lexicographic sort orders them by recency.
// `since` (when provided) binds the lookup to the current run: a file last
// written before the run started can only belong to an earlier session, so
// it is skipped rather than risk surfacing a stale provider error for this
// run. (This does not disambiguate two OpenCode runs writing into the same
// HOME concurrently — OpenCode only emits its session id on the stdout
// stream, which is empty in the silent-stall case, so mtime is the only
// run-binding signal available here.) The 2 MB tail comfortably holds the
// final error frame even though
// OpenCode embeds the entire request body (system prompt + tool schemas) in
// each `service=llm` line. Synchronous bounded reads preserve the existing
// non-async watchdog/close call sites. The only callers are the
// (non-async) run close handler and the inactivity watchdog, once per failed
// OpenCode run. Returns null on any fs error (no dir yet, perms).
export function readLatestOpenCodeLogTail(
  logDir: string,
  options: { maxBytes?: number; since?: number } = {},
): string | null {
  const { maxBytes = 2_000_000, since } = options;
  let names: string[];
  try {
    names = readdirSync(logDir).filter((name) => name.endsWith('.log'));
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  names.sort().reverse(); // newest filename first
  for (const name of names) {
    const full = path.join(logDir, name);
    if (since != null) {
      try {
        if (statSync(full).mtimeMs < since) continue;
      } catch {
        continue;
      }
    }
    let fd: number | null = null;
    try {
      const size = statSync(full).size;
      const byteLength = Math.min(size, maxBytes);
      const buffer = Buffer.allocUnsafe(byteLength);
      fd = openSync(full, 'r');
      const bytesRead = readSync(fd, buffer, 0, byteLength, size - byteLength);
      return buffer.subarray(0, bytesRead).toString('utf8');
    } catch {
      continue;
    } finally {
      if (fd !== null) {
        try {
          closeSync(fd);
        } catch {
          // A close failure must not override a successful bounded read or
          // escape the best-effort log lookup.
        }
      }
    }
  }
  return null;
}

// Only treat a `"message":"…"` value as the failure reason when it reads
// like a service error. The embedded request body uses `"content":` for
// prompt text, but tool schemas and user prompts could still contain a
// stray `"message"` key, so this keyword gate keeps unrelated payload text
// from masquerading as the error.
const SERVICE_ERROR_MESSAGE_RE =
  /usage limit|rate[ _-]?limit|quota|limit reached|insufficient|credit|balance|overloaded|unavailable|unauthor|authenticat|invalid[ _-]?(?:api[ _-]?)?key|api key|\/login|exhaust|too many requests/i;

const HARD_QUOTA_MESSAGE_RE =
  /\b(session limit|usage limit|limit reached|quota|billing (?:hard )?limit|insufficient[ _-]?(?:quota|credit|funds)|exceeded your current quota)\b/i;

function pickServiceErrorMessage(line: string): string | null {
  const re = /"message":"((?:[^"\\]|\\.)*)"/g;
  let fallback: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    let value: string;
    try {
      value = JSON.parse(`"${match[1]}"`);
    } catch {
      value = match[1]!;
    }
    value = value.trim();
    if (SERVICE_ERROR_MESSAGE_RE.test(value)) return value;
    if (!fallback) fallback = value;
  }
  return fallback && SERVICE_ERROR_MESSAGE_RE.test(fallback) ? fallback : null;
}

function codeFromStatus(statusCode: number): AgentServiceFailureCode | null {
  if (statusCode === 401 || statusCode === 403) return 'AGENT_AUTH_REQUIRED';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode >= 500 && statusCode <= 599) return 'UPSTREAM_UNAVAILABLE';
  return null;
}

function defaultMessageForCode(code: AgentServiceFailureCode): string {
  switch (code) {
    case 'AGENT_AUTH_REQUIRED':
      return 'OpenCode could not authenticate with the model provider.';
    case 'RATE_LIMITED':
      return 'OpenCode hit a provider usage or rate limit.';
    case 'UPSTREAM_UNAVAILABLE':
      return "OpenCode's model provider is temporarily unavailable.";
  }
}

// Classify the latest provider failure in an OpenCode log tail.
// We scope to that single line so the huge request body of *other* lines
// can't leak in, key the classification on the unambiguous HTTP `statusCode`
// first, and fall back to keyword matching the extracted message only.
export function extractOpenCodeServiceFailure(
  logTail: string,
): OpenCodeServiceFailure | null {
  return extractOpenCodeFailure(logTail);
}

export function extractOpenCodeServiceFailureForSession(
  logTail: string,
  sessionId: string,
): OpenCodeServiceFailure | null {
  if (!sessionId.trim()) return null;
  const sessionToken = new RegExp(`(?:^|\\s)session\\.id=${sessionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
  return extractOpenCodeFailure(logTail, sessionToken);
}

function extractOpenCodeFailure(
  logTail: string,
  sessionToken?: RegExp,
): OpenCodeServiceFailure | null {
  if (!logTail || !logTail.trim()) return null;
  const lines = logTail.split(/\r?\n/);
  let line: string | null = null;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const candidate = lines[i]!;
    if (sessionToken) {
      const quoteIndex = candidate.indexOf('"');
      const singleQuoteIndex = candidate.indexOf("'");
      const errorIndex = candidate.indexOf('error=');
      const prefixEnd = [quoteIndex, singleQuoteIndex, errorIndex].filter((index) => index >= 0).reduce(
        (earliest, index) => Math.min(earliest, index),
        candidate.length,
      );
      if (!sessionToken.test(candidate.slice(0, prefixEnd))) continue;
    }
    const serviceError = candidate.includes('service=llm') && /\bERROR\b/.test(candidate) && candidate.includes('error=');
    const modelUnavailable = /SessionRunnerModel\.ModelUnavailableError:\s*Model unavailable:\s*[^\s/]+\/[^\s]+/i.test(candidate);
    const drainFailure = /\bFailed to drain Session\b/.test(candidate) && /\blevel=ERROR\b/.test(candidate);
    if (serviceError || modelUnavailable || drainFailure) {
      line = candidate;
      break;
    }
  }
  if (!line) return null;

  const statusMatch = /"statusCode":\s*(\d{3})/.exec(line);
  const statusCode = statusMatch ? Number(statusMatch[1]) : null;
  const modelUnavailable = /SessionRunnerModel\.ModelUnavailableError:\s*(Model unavailable:\s*[^\s]+(?:\s+[^\s]+)?)/i.exec(line);
  const drainCause = /\bFailed to drain Session\b/.test(line)
    ? /\bcause=(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^,}]+))/.exec(line)
    : null;
  const extractedModelMessage = modelUnavailable?.[1]?.replace(/[\\"'\s]+$/, '') ?? null;
  const rawCause = drainCause?.[1] ?? drainCause?.[2] ?? drainCause?.[3];
  const message = pickServiceErrorMessage(line) ?? extractedModelMessage ??
    (rawCause && SERVICE_ERROR_MESSAGE_RE.test(rawCause) ? rawCause.trim() : null);

  let code: AgentServiceFailureCode | null =
    statusCode != null ? codeFromStatus(statusCode) : null;
  if (!code && /SessionRunnerModel\.ModelUnavailableError/i.test(line)) {
    code = 'UPSTREAM_UNAVAILABLE';
  }
  if (!code && message) code = classifyAgentServiceFailure(message);
  if (!code) return null;
  const retryable = code === 'UPSTREAM_UNAVAILABLE' || (
    code === 'RATE_LIMITED' && !HARD_QUOTA_MESSAGE_RE.test(message ?? '')
  );

  return { code, message: message || defaultMessageForCode(code), retryable, statusCode };
}

// Convenience for the run close handler / inactivity watchdog: resolve the
// log dir from the spawned agent's env, read the newest log tail (bound to
// the current run via `since`), and classify it.
export function readOpenCodeServiceFailure(
  env: Record<string, string | undefined>,
  options: { since?: number; sessionId?: string; maxBytes?: number } = {},
): OpenCodeServiceFailure | null {
  const logDir = resolveOpenCodeLogDir(env);
  if (!logDir) return null;
  const tail = readLatestOpenCodeLogTail(logDir, options);
  if (!tail) return null;
  return options.sessionId
    ? extractOpenCodeServiceFailureForSession(tail, options.sessionId)
    : extractOpenCodeServiceFailure(tail);
}
