import { beforeEach, describe, expect, mock, test } from 'bun:test';

/**
 * `resolveMcpToolApprovalMode` falls back to `prompt` for a tool with no
 * recorded mode, and PII redaction calls `redact_text` on every send. Without
 * the exemption the user gets an approval dialog per message, so these cover
 * that it is applied, scoped to that one tool, and non-destructive.
 */
type ToolConfig = { approvalMode?: string } & Record<string, unknown>;
let stored: { tools?: Record<string, ToolConfig> } | undefined;
let updates: Array<Record<string, unknown>> = [];
let readFails = false;

mock.module('../configStore', () => ({
  getMcpServer: async () => {
    if (readFails) throw new Error('config unreadable');
    return stored;
  },
  updateMcpServer: async (_id: string, patch: Record<string, unknown>) => {
    updates.push(patch);
  },
}));

beforeEach(() => {
  stored = { tools: {} };
  updates = [];
  readFails = false;
});

async function ensure() {
  const { ensureRedactTextAutoApproval } = await import('./basemindManager');
  await ensureRedactTextAutoApproval('basemind');
}

function writtenTools(): Record<string, ToolConfig> {
  return updates[0].tools as Record<string, ToolConfig>;
}

describe('ensureRedactTextAutoApproval', () => {
  test('auto-approves redact_text when nothing is on file', async () => {
    await ensure();

    expect(updates).toHaveLength(1);
    expect(writtenTools().redact_text.approvalMode).toBe('auto');
  });

  test('leaves an explicit choice alone', async () => {
    // Someone who set this to prompt on purpose keeps it.
    stored = { tools: { redact_text: { approvalMode: 'prompt' } } };

    await ensure();

    expect(updates).toHaveLength(0);
  });

  test('keeps other tools despite the one-level merge', async () => {
    // updateMcpServer spreads one level deep, so writing a bare
    // { redact_text } would drop every other tool's settings.
    stored = { tools: { vault: { approvalMode: 'prompt' }, code: { approvalMode: 'prompt' } } };

    await ensure();

    expect(writtenTools().vault.approvalMode).toBe('prompt');
    expect(writtenTools().code.approvalMode).toBe('prompt');
    expect(writtenTools().redact_text.approvalMode).toBe('auto');
  });

  test('preserves unrelated fields on redact_text itself', async () => {
    stored = { tools: { redact_text: { timeoutSec: 30 } } };

    await ensure();

    expect(writtenTools().redact_text.timeoutSec).toBe(30);
    expect(writtenTools().redact_text.approvalMode).toBe('auto');
  });

  test('swallows a config failure instead of breaking registration', async () => {
    readFails = true;

    await ensure();

    expect(updates).toHaveLength(0);
  });
});
