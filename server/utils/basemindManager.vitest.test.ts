import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'node:fs';

describe('resolveBasemindBinary', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the local debug binary path when it exists', async () => {
    const { resolveBasemindBinary } = await import('./basemindManager');
    const result = resolveBasemindBinary();
    expect(result).toContain('basemind');
    expect(existsSync(result)).toBe(true);
  });

  it('returns non-empty string on this machine', async () => {
    const { resolveBasemindBinary } = await import('./basemindManager');
    const result = resolveBasemindBinary();
    expect(result).not.toBe('');
  });
});
