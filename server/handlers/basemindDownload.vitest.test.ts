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

describe('basemindDownload — smoke tests against real binary', () => {
  const binary = resolveBasemindBinary();

  it('resolveBasemindBinary returns a non-empty path on this machine', () => {
    expect(binary).not.toBe('');
    expect(binary).toContain('basemind');
  });

  it('basemind lang list succeeds', async () => {
    if (!binary) return;
    const result = await runCmd(binary, ['lang', 'list']);
    expect(result.code).toBe(0);
  });

  it('basemind serve --help exits cleanly', async () => {
    if (!binary) return;
    const result = await runCmd(binary, ['serve', '--help']);
    expect(result.code).toBe(0);
  });

  it('basemind statusline exits 0 when no daemon running', async () => {
    if (!binary) return;
    const result = await runCmd(binary, ['statusline', '-q']);
    expect(result.code).toBe(0);
  });

  it('basemind lang install exits 0 (grammars download)', async () => {
    if (!binary) return;
    // Allow up to 30s for grammar download (first-run network fetch)
    const result = await runCmd(binary, ['lang', 'install', '-q'], 30_000);
    expect(result.code).toBe(0);
  });
});
