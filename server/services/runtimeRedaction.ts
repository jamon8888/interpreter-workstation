/**
 * Runtime redaction for linked-file reads (#113).
 *
 * Composer redaction covers serialized submission text, but a `fileMention`
 * serializes to `[label](<path>)` — the *contents* reach the model later,
 * when the agent calls a file-read tool at runtime. This module redacts
 * those tool outputs through the same token vocabulary (`[LABEL_N]` via
 * `buildRedactedText`) so linked files produce artifacts indistinguishable
 * from pasted-file redaction.
 *
 * Hook point: `ToolManager.callTool` passes builtin and MCP results through
 * `maybeRedactToolResult` before they return to the agent loop. NER runs
 * through basemind `redact_text` (never a file-read tool), so the hook
 * cannot recurse into itself.
 *
 * Rehydration maps accumulate in a thread-scoped in-memory store. Nothing
 * here writes to disk: vault persistence waits on the passphrase UX
 * decision (#114), and a missing key degrades to tokens-without-reveal.
 */

import { buildRedactedText, mergeDetections } from '../../src/lib/pii/labels';
import { detectRegex } from '../../src/lib/pii/regex-detector';
import type { PiiDetection } from '../../src/lib/pii/regex-detector';
import { needsRedactionForProvider } from '../../src/lib/pii/redaction';
import type { BuiltinToolDefinition } from '../tools/builtinTools';
import type { AgentModelConfig } from '../../shared/types/model';

export const RUNTIME_REDACTION_DEFERRED_MARKER =
  '[redaction deferred: non-text content is not scanned for PII]';

/** Upstream harness file-read tools have no local metadata; match by name. */
const MCP_FILE_READ_TOOLS: ReadonlySet<string> = new Set(['read_file']);

export interface RuntimeRedactionDeps {
  isNerReady?: () => boolean;
  detectNer?: (text: string) => Promise<PiiDetection[]>;
}

async function defaultDetectNer(text: string): Promise<PiiDetection[]> {
  // Lazy import: piiDetection pulls in ToolManager, which loads this module
  // for the callTool hook. Deferring to call time breaks the cycle.
  const { piiDetectionService } = await import('./piiDetection');
  return piiDetectionService.detectPii(text);
}

async function defaultIsNerReady(): Promise<boolean> {
  const { piiDetectionService } = await import('./piiDetection');
  return piiDetectionService.isPiiModelReady();
}

function resolveDeps(deps: RuntimeRedactionDeps = {}): {
  isNerReady: () => boolean | Promise<boolean>;
  detectNer: (text: string) => Promise<PiiDetection[]>;
} {
  return {
    isNerReady: deps.isNerReady ?? defaultIsNerReady,
    detectNer: deps.detectNer ?? defaultDetectNer,
  };
}

// Thread-scoped rehydration maps: token -> original text. In-memory only;
// vault persistence (#114) will adopt this shape once the passphrase UX lands.
const runtimeRehydrationMaps = new Map<string, Record<string, string>>();

export function getRuntimeRehydrationMap(threadKey: string): Record<string, string> {
  return { ...(runtimeRehydrationMaps.get(threadKey) ?? {}) };
}

export function clearRuntimeRehydrationMaps(): void {
  runtimeRehydrationMaps.clear();
}

function storeRuntimeRehydrationMap(threadKey: string, map: Record<string, string>): void {
  const existing = runtimeRehydrationMaps.get(threadKey) ?? {};
  runtimeRehydrationMaps.set(threadKey, { ...existing, ...map });
}

export function isFileReadTool(
  serverId: string,
  toolName: string,
  builtinTool?: Pick<BuiltinToolDefinition, 'fileAccess'> | null,
): boolean {
  const fileAccess = builtinTool?.fileAccess as
    | { mode?: string; pathArg?: string | string[]; pathArgModes?: Record<string, string> }
    | undefined;
  if (fileAccess) {
    const pathArgs = Array.isArray(fileAccess.pathArg) ? fileAccess.pathArg : [fileAccess.pathArg];
    for (const argName of pathArgs) {
      if (typeof argName !== 'string') continue;
      const mode = fileAccess.pathArgModes?.[argName] ?? fileAccess.mode;
      if (mode === 'read') return true;
    }
    return false;
  }
  return serverId === 'builtin-fs' && MCP_FILE_READ_TOOLS.has(toolName);
}

function isNonTextContent(text: string): boolean {
  if (text.includes('\0')) return true;
  const sample = text.slice(0, 4000);
  if (sample.length === 0) return false;
  let nonPrintable = 0;
  for (const char of sample) {
    const code = char.codePointAt(0) ?? 32;
    if (code < 9 || (code > 13 && code < 32) || code === 127) nonPrintable += 1;
  }
  return nonPrintable / sample.length > 0.3;
}

export interface RedactTextOptions {
  threadKey?: string;
}

export async function redactFileReadOutputText(
  text: string,
  options: RedactTextOptions = {},
  deps: RuntimeRedactionDeps = {},
): Promise<{ text: string; redacted: boolean; deferred: boolean }> {
  if (isNonTextContent(text)) {
    return { text: `${text}\n${RUNTIME_REDACTION_DEFERRED_MARKER}`, redacted: false, deferred: true };
  }
  const resolved = resolveDeps(deps);
  const regexDetections = detectRegex(text);
  let detections: PiiDetection[] = regexDetections;
  if (regexDetections.length > 0) {
    try {
      if (await resolved.isNerReady()) {
        detections = mergeDetections(await resolved.detectNer(text), regexDetections);
      }
    } catch {
      detections = regexDetections;
    }
  }
  if (detections.length === 0) return { text, redacted: false, deferred: false };
  const { redactedText, rehydrationMap } = buildRedactedText(text, detections);
  if (options.threadKey) storeRuntimeRehydrationMap(options.threadKey, rehydrationMap);
  return { text: redactedText, redacted: true, deferred: false };
}

interface McpContentPart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

function isMcpContentResult(value: unknown): value is { content: McpContentPart[] } & Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const content = (value as { content?: unknown }).content;
  return Array.isArray(content);
}

function isErrorResult(value: unknown): boolean {
  return (
    typeof value === 'object'
    && value !== null
    && (value as { isError?: unknown }).isError === true
  );
}

export async function applyFileReadRedaction(
  result: unknown,
  options: RedactTextOptions = {},
  deps: RuntimeRedactionDeps = {},
): Promise<unknown> {
  if (isErrorResult(result)) return result;
  if (typeof result === 'string') {
    return (await redactFileReadOutputText(result, options, deps)).text;
  }
  if (isMcpContentResult(result)) {
    const content = await Promise.all(
      result.content.map(async (part) => {
        if (part?.type !== 'text' || typeof part.text !== 'string') return part;
        const redacted = await redactFileReadOutputText(part.text, options, deps);
        return redacted.redacted || redacted.deferred ? { ...part, text: redacted.text } : part;
      }),
    );
    if (content.every((part, index) => part === result.content[index])) return result;
    return { ...result, content };
  }
  return result;
}

export interface MaybeRedactOptions {
  serverId: string;
  toolName: string;
  builtinTool?: Pick<BuiltinToolDefinition, 'fileAccess'> | null;
  result: unknown;
  modelConfig?: Pick<AgentModelConfig, 'provider'> | null;
  threadKey?: string | null;
}

export async function maybeRedactToolResult(
  options: MaybeRedactOptions,
  deps: RuntimeRedactionDeps = {},
): Promise<unknown> {
  const { serverId, toolName, builtinTool, result, modelConfig, threadKey } = options;
  if (!isFileReadTool(serverId, toolName, builtinTool)) return result;
  // Server-side trust is ModelProvider-level: only on-device `local` models
  // (which include local Mistral) skip redaction. Anything else — including a
  // missing provider — fails closed. The renderer's richer runtime-profile
  // resolution (remote Mistral API) is a client-side notice concern, not a
  // reason to let raw file bytes reach an API model from the server path.
  if (!needsRedactionForProvider(modelConfig?.provider ?? null)) return result;
  return applyFileReadRedaction(result, threadKey ? { threadKey } : {}, deps);
}
