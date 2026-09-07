import path from 'path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { ToolManager } from '../tools/toolManager';
import { resolveBundledResourceCandidates } from './bundledRuntimePaths';

import os from 'node:os';

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
    path.join(os.homedir(), '.local', 'bin', 'basemind'),
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

export interface BasemindScanOptions {
  root?: string;
  paths?: string[];
  json?: boolean;
}

export interface BasemindScanResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
}

/**
 * Run `basemind scan [paths]` as a one-shot subprocess.
 * Used after workspacePseudonymize writes shadow files to .redacted/.
 */
export async function basemindScan(opts: BasemindScanOptions = {}): Promise<BasemindScanResult> {
  const binaryPath = resolveBasemindBinary();
  const args = ['scan'];

  if (opts.root) {
    args.push('--root', opts.root);
  }
  if (opts.paths && opts.paths.length > 0) {
    args.push(...opts.paths);
  }
  if (opts.json) {
    args.push('--json');
  }

  return new Promise((resolve) => {
    const proc = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000, // 5 min timeout for large corpora
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        stdout,
        stderr,
        exitCode: null,
        error: err.message,
      });
    });
  });
}

/**
 * Run `basemind rescan [paths]` to re-index specific paths.
 * Faster than full scan for incremental updates.
 */
export async function basemindRescan(opts: BasemindScanOptions = {}): Promise<BasemindScanResult> {
  const binaryPath = resolveBasemindBinary();
  const args = ['rescan'];

  if (opts.root) {
    args.push('--root', opts.root);
  }
  if (opts.paths && opts.paths.length > 0) {
    args.push(...opts.paths);
  }
  if (opts.json) {
    args.push('--json');
  }

  return new Promise((resolve) => {
    const proc = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        stdout,
        stderr,
        exitCode: null,
        error: err.message,
      });
    });
  });
}

const BASEMIND_SERVER_ID = 'basemind';

/**
 * Register basemind as an MCP tool server via ToolManager.
 * basemind serve runs as a long-running stdio MCP server.
 * Its tools (code { outline, symbols, grep, ... }, admin { rescan, ... }) are
 * exposed via the MCP route once registered.
 */
export async function registerBasemindServer(): Promise<string> {
  const binaryPath = resolveBasemindBinary();

  const toolManager = new ToolManager();
  try {
    // Check if already registered
    await toolManager.getServerStatus(BASEMIND_SERVER_ID);
    return BASEMIND_SERVER_ID;
  } catch {
    // Not registered yet, add it
  }

  const serverId = await toolManager.addServer({
    name: 'Basemind',
    description: 'Code map, document RAG, and semantic search - 300+ languages',
    transport: 'stdio',
    command: binaryPath,
    args: ['serve'],
    enabled: true,
    startupTimeoutSec: 30,
    toolTimeoutSec: 60,
  });

  return serverId;
}

/**
 * Unregister basemind MCP server (for cleanup/testing).
 */
export async function unregisterBasemindServer(): Promise<void> {
  const toolManager = new ToolManager();
  try {
    await toolManager.removeServer(BASEMIND_SERVER_ID);
  } catch {
    // Ignore if not registered
  }
}

/**
 * Get basemind server status.
 */
export async function getBasemindServerStatus() {
  const toolManager = new ToolManager();
  return toolManager.getServerStatus(BASEMIND_SERVER_ID);
}
