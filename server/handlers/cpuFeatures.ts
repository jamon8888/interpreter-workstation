import { resolveBasemindBinary } from '../utils/basemindManager';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { arch } from 'node:os';

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

function detectFromProcCpuinfo(): CpuFeatures {
  try {
    const cpuinfo = readFileSync('/proc/cpuinfo', 'utf-8');
    const flags = cpuinfo
      .split('\n')
      .find(line => line.startsWith('flags'))
      ?.split(':')?.[1]
      ?.trim()
      ?.split(/\s+/) ?? [];

    const hostArch = arch();
    const mapped = hostArch === 'x64' ? 'x86_64' : hostArch === 'arm64' ? 'aarch64' : hostArch;

    return {
      arch: mapped,
      avx2: flags.includes('avx2'),
      avx: flags.includes('avx'),
      sse4_1: flags.includes('sse4_1'),
      sse4_2: flags.includes('sse4_2'),
      neon: flags.includes('asimd') || flags.includes('neon'),
    };
  } catch {
    return DEFAULT_FEATURES;
  }
}

/**
 * Detect CPU feature flags by shelling out to `basemind cpu-features`.
 * Falls back to reading `/proc/cpuinfo` on Linux when the subcommand
 * is unavailable, then to a safe default.
 */
export async function cpuFeatures(): Promise<{ arch: string; avx2: boolean; avx: boolean; sse4_1: boolean; sse4_2: boolean; neon: boolean }> {
  const binary = resolveBasemindBinary();
  if (!binary) return detectFromProcCpuinfo();

  return new Promise((resolve) => {
    const child = spawn(binary, ['cpu-features'], { stdio: 'pipe' });
    let stdout = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(detectFromProcCpuinfo());
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
          settle(isCpuFeatures(parsed) ? parsed : detectFromProcCpuinfo());
        } catch { settle(detectFromProcCpuinfo()); }
      } else {
        settle(detectFromProcCpuinfo());
      }
    });
    child.on('error', () => settle(detectFromProcCpuinfo()));
  });
}
