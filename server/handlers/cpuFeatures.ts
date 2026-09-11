import { resolveBasemindBinary } from '../utils/basemindManager';
import { spawn } from 'node:child_process';

const DEFAULT_FEATURES = { arch: 'unknown', avx2: false, avx: false, sse4_1: false, sse4_2: false, neon: false };

type CpuFeatures = typeof DEFAULT_FEATURES;

const FEATURE_FLAGS = ['avx2', 'avx', 'sse4_1', 'sse4_2', 'neon'] as const;

const DETECTION_TIMEOUT_MS = 5_000;

/**
 * `JSON.parse` accepts `{}`, `null`, `42` and arrays just as happily as a real
 * payload. A partial object then reaches `isCompatible`, where a missing `arch`
 * falls through to `return true` and an AVX2-only stage is declared compatible
 * on a machine that may not support it. Callers get the documented shape or the
 * fallback, never something in between.
 */
function isCpuFeatures(value: unknown): value is CpuFeatures {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.arch !== 'string' || record.arch.length === 0) return false;
  return FEATURE_FLAGS.every((flag) => typeof record[flag] === 'boolean');
}

/**
 * Detect CPU feature flags by shelling out to `basemind cpu-features`.
 * Returns a safe fallback on any error — the UI decides what to do.
 */
export async function cpuFeatures(): Promise<{ arch: string; avx2: boolean; avx: boolean; sse4_1: boolean; sse4_2: boolean; neon: boolean }> {
  const binary = resolveBasemindBinary();
  if (!binary) return DEFAULT_FEATURES;

  return new Promise((resolve) => {
    const child = spawn(binary, ['cpu-features'], { stdio: 'pipe' });
    let stdout = '';
    let settled = false;
    // A hung child emits neither `close` nor `error`, and onboarding awaits this
    // promise, so without a deadline the flow waits forever.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(DEFAULT_FEATURES);
    }, DETECTION_TIMEOUT_MS);
    function settle(features: CpuFeatures): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(features);
    }
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed: unknown = JSON.parse(stdout.trim());
          settle(isCpuFeatures(parsed) ? parsed : DEFAULT_FEATURES);
        } catch { settle(DEFAULT_FEATURES); }
      } else {
        settle(DEFAULT_FEATURES);
      }
    });
    child.on('error', () => settle(DEFAULT_FEATURES));
  });
}
