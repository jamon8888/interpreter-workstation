import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { resolveBasemindBinary } from '../utils/basemindManager';

function runCmd(binary: string, args: string[], timeoutMs = 5000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(binary, args, { stdio: 'pipe' });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -1, stderr: 'timed out' });
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

// The binary ships only with packaged builds and local dev checkouts. Skipping
// on CI keeps the absence visible in the report instead of passing vacuously.
const binary = resolveBasemindBinary();

describe.skipIf(!binary)('basemindDownload — smoke tests against real binary', () => {
  it('basemind lang list succeeds', async () => {
    const result = await runCmd(binary, ['lang', 'list']);
    expect(result.code).toBe(0);
  });

  it('basemind serve --help exits cleanly', async () => {
    const result = await runCmd(binary, ['serve', '--help']);
    expect(result.code).toBe(0);
  });

  it('basemind statusline exits 0 when no daemon running', async () => {
    const result = await runCmd(binary, ['statusline', '-q']);
    expect(result.code).toBe(0);
  });

  it('basemind lang install exits 0 (grammars download)', async () => {
    // Allow up to 30s for grammar download (first-run network fetch)
    const result = await runCmd(binary, ['lang', 'install', '-q'], 30_000);
    expect(result.code).toBe(0);
  });
});
