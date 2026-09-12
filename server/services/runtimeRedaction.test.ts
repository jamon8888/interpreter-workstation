import { describe, expect, test } from 'bun:test';

import {
  applyFileReadRedaction,
  clearRuntimeRehydrationMaps,
  getRuntimeRehydrationMap,
  isFileReadTool,
  maybeRedactToolResult,
} from './runtimeRedaction';

const PROBE_EMAIL = 'john@example.com';

const stubDeps = {
  // NER down by default: regex-only fallback must still redact.
  isNerReady: () => false,
  detectNer: async (_text: string): Promise<never[]> => [],
};

describe('isFileReadTool', () => {
  test('matches builtin tools with read fileAccess', () => {
    expect(isFileReadTool('builtin-test-filesystem', 'read_file', {
      fileAccess: { mode: 'read', pathArg: 'path' },
    } as never)).toBe(true);
  });

  test('matches upstream builtin-fs read_file by name', () => {
    expect(isFileReadTool('builtin-fs', 'read_file')).toBe(true);
  });

  test('ignores write and delete tools', () => {
    expect(isFileReadTool('builtin-fs', 'write_file')).toBe(false);
    expect(isFileReadTool('builtin-fs', 'delete_file')).toBe(false);
    expect(isFileReadTool('builtin-fs', 'list_directory')).toBe(false);
  });
});

describe('applyFileReadRedaction', () => {
  test('redacts PII in MCP text content to tokens only', async () => {
    clearRuntimeRehydrationMaps();
    const result = await applyFileReadRedaction(
      { content: [{ type: 'text', text: `Contact ${PROBE_EMAIL} for the report` }], isError: false },
      { threadKey: 'thread-1' },
      stubDeps,
    );
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).toMatch(/\[EMAIL_\d+\]/);
    expect(text).not.toContain(PROBE_EMAIL);
    expect(getRuntimeRehydrationMap('thread-1')['[EMAIL_0]']).toBe(PROBE_EMAIL);
  });

  test('uses the same token vocabulary as pasted-file redaction', async () => {
    clearRuntimeRehydrationMaps();
    const result = await applyFileReadRedaction(
      `Call ${PROBE_EMAIL}`,
      { threadKey: 'thread-2' },
      stubDeps,
    );
    expect(result).toBe('Call [EMAIL_0]');
  });

  test('merges NER detections over regex when models are ready', async () => {
    clearRuntimeRehydrationMaps();
    const result = await applyFileReadRedaction(
      { content: [{ type: 'text', text: 'Jane Doe <jane@example.com>' }], isError: false },
      { threadKey: 'thread-3' },
      {
        isNerReady: () => true,
        detectNer: async () => [
          { category: 'person_full_name', start: 0, end: 8, text: 'Jane Doe', confidence: 0.9 },
        ],
      },
    );
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).toMatch(/\[NAME_\d+\]/);
    expect(text).not.toContain('Jane Doe');
    expect(text).not.toContain('jane@example.com');
  });

  test('marks binary content deferred instead of silently passing it', async () => {
    clearRuntimeRehydrationMaps();
    const result = await applyFileReadRedaction(
      { content: [{ type: 'text', text: 'PNG\0\x01\x02binary' }], isError: false },
      { threadKey: 'thread-4' },
      stubDeps,
    );
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).toContain('redaction deferred');
  });

  test('passes error results through untouched', async () => {
    const result = await applyFileReadRedaction(
      { content: [{ type: 'text', text: `denied ${PROBE_EMAIL}` }], isError: true },
      { threadKey: 'thread-5' },
      stubDeps,
    );
    expect((result as { content: Array<{ text: string }> }).content[0].text).toContain(PROBE_EMAIL);
  });
});

describe('maybeRedactToolResult', () => {
  test('redacts file reads on untrusted providers', async () => {
    clearRuntimeRehydrationMaps();
    const result = await maybeRedactToolResult(
      {
        serverId: 'builtin-fs',
        toolName: 'read_file',
        result: { content: [{ type: 'text', text: `mail ${PROBE_EMAIL}` }] },
        modelConfig: { provider: 'api', modelId: 'gpt-4o' } as never,
        threadKey: 'thread-6',
      },
      stubDeps,
    );
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).not.toContain(PROBE_EMAIL);
  });

  test('passes file reads through on trusted providers', async () => {
    const raw = { content: [{ type: 'text', text: `mail ${PROBE_EMAIL}` }] };
    const result = await maybeRedactToolResult(
      {
        serverId: 'builtin-fs',
        toolName: 'read_file',
        result: raw,
        modelConfig: { provider: 'local', modelId: 'mistral-nemo:12b' } as never,
        threadKey: 'thread-7',
      },
      stubDeps,
    );
    expect(result).toBe(raw);
  });

  test('fails closed when the provider is unknown', async () => {
    clearRuntimeRehydrationMaps();
    const result = await maybeRedactToolResult(
      {
        serverId: 'builtin-fs',
        toolName: 'read_file',
        result: { content: [{ type: 'text', text: `mail ${PROBE_EMAIL}` }] },
        threadKey: 'thread-8',
      },
      stubDeps,
    );
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).not.toContain(PROBE_EMAIL);
  });

  test('ignores non-read tools', async () => {
    const raw = { content: [{ type: 'text', text: `mail ${PROBE_EMAIL}` }] };
    const result = await maybeRedactToolResult(
      {
        serverId: 'builtin-fs',
        toolName: 'write_file',
        result: raw,
        modelConfig: { provider: 'api', modelId: 'gpt-4o' } as never,
        threadKey: 'thread-9',
      },
      stubDeps,
    );
    expect(result).toBe(raw);
  });

  test('redacts without storing when no thread key exists', async () => {
    clearRuntimeRehydrationMaps();
    const result = await maybeRedactToolResult(
      {
        serverId: 'builtin-fs',
        toolName: 'read_file',
        result: { content: [{ type: 'text', text: `mail ${PROBE_EMAIL}` }] },
        modelConfig: { provider: 'api', modelId: 'gpt-4o' } as never,
      },
      stubDeps,
    );
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).not.toContain(PROBE_EMAIL);
    expect(text).toMatch(/\[EMAIL_\d+\]/);
    // Tokens without reveal: nothing stored under any other key.
    expect(getRuntimeRehydrationMap('no-such-thread')).toEqual({});
  });
});
