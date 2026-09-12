import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolveBasemindBinary } from './basemindManager';

// These are smoke assertions against the real basemind binary, which ships
// only with packaged builds and local dev checkouts. CI runners have no
// binary, so the suite skips there instead of reporting a hollow pass.
const binary = resolveBasemindBinary();

describe.skipIf(!binary)('resolveBasemindBinary', () => {
  it('returns a path that points at the basemind binary', () => {
    expect(binary).toContain('basemind');
    expect(existsSync(binary)).toBe(true);
  });
});
