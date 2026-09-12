import { describe, expect, mock, test } from 'bun:test';

/**
 * Regression guard for the silent-degradation bug: `ToolManager.callTool`
 * throws `MCP tool calls require a Codex thread context` when no threadId is
 * present, the composer catches that and falls back to regex, so NER detection
 * never ran and nothing surfaced the failure.
 */
const callToolCalls: Array<{
  serverId: string;
  toolName: string;
  toolContext: { threadId?: string } | undefined;
}> = [];

mock.module('../tools/toolManager', () => ({
  ToolManager: class {
    async callTool(
      serverId: string,
      toolName: string,
      _args: Record<string, unknown>,
      _saveToDisk?: boolean,
      _callerTabId?: string,
      toolContext?: { threadId?: string },
    ) {
      callToolCalls.push({ serverId, toolName, toolContext });
      return {
        structuredContent: {
          result: {
            redacted_text: 'Call [EMAIL_0]',
            rehydration_map: { '[EMAIL_0]': 'john@example.com' },
            detections: [
              { category: 'email', start: 5, end: 21, text: 'john@example.com', confidence: 0.9 },
            ],
          },
        },
      };
    }
  },
}));

mock.module('./appMcpThread', () => ({
  getAppMcpOwnerThreadId: async () => 'mcp-owner-thread-1',
  resetAppMcpOwnerThread: () => {},
}));

describe('detectPii thread context', () => {
  test('passes an owner thread so the MCP call is not rejected', async () => {
    const { piiDetectionService } = await import('./piiDetection');
    const detections = await piiDetectionService.detectPii('Call john@example.com');

    expect(callToolCalls).toHaveLength(1);
    expect(callToolCalls[0].serverId).toBe('basemind');
    expect(callToolCalls[0].toolName).toBe('redact_text');
    expect(callToolCalls[0].toolContext?.threadId).toBe('mcp-owner-thread-1');

    // The detections have to survive the round trip: an empty result here is
    // indistinguishable from the regex-only fallback the bug produced.
    expect(detections).toHaveLength(1);
    expect(detections[0].text).toBe('john@example.com');
  });
});
