import path from 'path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { ToolManager } from '../tools/toolManager';
import { resolveBundledResourceCandidates } from './bundledRuntimePaths';

let basemindBinaryPath: string | null = null;

function findBasemindBinary(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
    const withExe = candidate.endsWith('.exe') ? candidate : `${candidate}.exe`;
    if (existsSync(withExe)) {
      return withExe;
    }
  }
  return null;
}

export function resolveBasemindBinary(): string {
  if (basemindBinaryPath) return basemindBinaryPath;

  const packagedCandidates = resolveBundledResourceCandidates({
    packagedSegments: ['basemind', 'bin', 'basemind'],
  });

  const found = findBasemindBinary(packagedCandidates);
  if (found) {
    basemindBinaryPath = found;
    return basemindBinaryPath;
  }

  const devCandidates = [
    path.join(process.cwd(), 'node_modules', '@jamon8888', 'basemind-fork', 'bin', 'basemind'),
    path.join(process.cwd(), 'node_modules', '@jamon8888', 'basemind-fork', 'bin', 'basemind.exe'),
  ];

  const devFound = findBasemindBinary(devCandidates);
  if (devFound) {
    basemindBinaryPath = devFound;
    return basemindBinaryPath;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const basemind = require('@jamon8888/basemind-fork') as { binaryPath: string | null | undefined };
    if (basemind.binaryPath && existsSync(basemind.binaryPath)) {
      basemindBinaryPath = basemind.binaryPath;
      return basemindBinaryPath;
    }
  } catch {
    // ignore - fallback paths will be checked
  }

  throw new Error(
    `[basemind] Binary not found. Checked packaged: ${packagedCandidates.join(', ')}, dev: ${devCandidates.join(', ')}`,
  );
}

export function basemindScan(_opts: { root: string; paths?: string[]; json?: boolean }) {
  return { success: false, exitCode: null, stdout: '', stderr: '', error: 'stub' };
}

export function basemindRescan(_opts: { root: string; paths?: string[]; json?: boolean }) {
  return { success: false, exitCode: null, stdout: '', stderr: '', error: 'stub' };
}

export async function registerBasemindServer(): Promise<string> {
  return '';
}

export async function unregisterBasemindServer(): Promise<void> {}

export async function getBasemindServerStatus(): Promise<{ status: string }> {
  return { status: 'disconnected' };
}
