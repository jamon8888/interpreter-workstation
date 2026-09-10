import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { Socket } from 'node:net';
import { createRequire } from 'node:module';

// Cargo emits `basemind.exe` on Windows, so every candidate path below has to
// carry the platform suffix, not just the ones that go through PATH or npm.
const BINARY_NAME = process.platform === 'win32' ? 'basemind.exe' : 'basemind';

function findBasemindBinary(): string {
  const projectRoot = process.cwd();

  const pathBin = process.env.PATH?.split(process.platform === 'win32' ? ';' : ':')
    .map(p => resolve(p, BINARY_NAME))
    .find(p => { try { return existsSync(p); } catch { return false; } }) ?? '';
  if (pathBin) return pathBin;

  const localDebug = resolve(projectRoot, 'basemind', 'target', 'debug', BINARY_NAME);
  if (existsSync(localDebug)) return localDebug;

  const localRelease = resolve(projectRoot, 'basemind', 'target', 'release', BINARY_NAME);
  if (existsSync(localRelease)) return localRelease;

  const cargoBin = resolve(homedir(), '.cargo', 'bin', BINARY_NAME);
  if (existsSync(cargoBin)) return cargoBin;

  try {
    // The server entrypoints run as ESM, where the CommonJS `require` binding
    // does not exist. Calling it here threw a ReferenceError that this catch
    // swallowed, so npm-installed binaries were never discovered.
    const npmPackageJson = createRequire(import.meta.url).resolve('basemind/package.json');
    const npmBin = resolve(npmPackageJson, '..', 'bin', BINARY_NAME);
    if (existsSync(npmBin)) return npmBin;
  } catch {}

  return '';
}

function basemindCommsDir(): string {
  return resolve(homedir(), '.local', 'share', 'basemind', 'comms');
}

export function isDaemonRunning(): boolean {
  const sock = resolve(basemindCommsDir(), 'comms.sock');
  if (!existsSync(sock)) return false;
  const pidFile = resolve(basemindCommsDir(), 'daemon.pid');
  if (!existsSync(pidFile)) return false;
  try {
    const content = readFileSync(pidFile, 'utf8').trim();
    const parsed = JSON.parse(content);
    const pid = typeof parsed === 'object' && parsed !== null && 'pid' in parsed ? Number(parsed.pid) : Number(parsed);
    if (!Number.isFinite(pid)) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let _cachedBinary: string | null = null;

export function resolveBasemindBinary(): string {
  if (_cachedBinary === null) {
    _cachedBinary = findBasemindBinary();
  }
  return _cachedBinary;
}

function mcpRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const sockPath = resolve(basemindCommsDir(), 'comms.sock');
  return new Promise((resolve, reject) => {
    const sock = new Socket();
    let data = '';
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`MCP request timed out: ${method}`));
    }, 30_000);
    sock.connect(sockPath, () => {
      const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
      sock.write(req + '\n');
    });
    sock.on('data', (chunk) => {
      data += chunk.toString();
      let resp: { result?: unknown; error?: { code?: number; message?: string } };
      try {
        resp = JSON.parse(data);
      } catch {
        return; // Partial frame; wait for the rest.
      }
      clearTimeout(timer);
      sock.destroy();
      // A JSON-RPC rejection is a well-formed response with `error` and no
      // `result`. Resolving it handed callers the error envelope, which they
      // then reported as a successful scan.
      if (resp.error) {
        const { code, message } = resp.error;
        const suffix = code === undefined ? '' : ` (${code})`;
        reject(new Error(`MCP request failed: ${method}${suffix}: ${message ?? 'unknown error'}`));
        return;
      }
      resolve(resp.result ?? resp);
    });
    sock.on('error', (err) => {
      clearTimeout(timer);
      sock.destroy();
      reject(err);
    });
  });
}

export async function basemindScan(opts: { root: string; paths?: string[]; json?: boolean }) {
  if (!isDaemonRunning()) return { success: false, exitCode: null, stdout: '', stderr: '', error: 'daemon not running' };
  try {
    await mcpRequest('tools/call', {
      name: 'code',
      arguments: { subcommand: 'files', root: opts.root, paths: opts.paths }
    });
    return { success: true, exitCode: 0, stdout: '', stderr: '', error: undefined };
  } catch (err) {
    return { success: false, exitCode: null, stdout: '', stderr: '', error: err instanceof Error ? err.message : String(err) };
  }
}

export async function basemindRescan(opts: { root: string; paths?: string[]; json?: boolean }) {
  if (!isDaemonRunning()) return { success: false, exitCode: null, stdout: '', stderr: '', error: 'daemon not running' };
  try {
    await mcpRequest('tools/call', {
      name: 'code',
      arguments: { subcommand: 'files', root: opts.root, paths: opts.paths, full: true }
    });
    return { success: true, exitCode: 0, stdout: '', stderr: '', error: undefined };
  } catch (err) {
    return { success: false, exitCode: null, stdout: '', stderr: '', error: err instanceof Error ? err.message : String(err) };
  }
}

export async function registerBasemindServer(): Promise<string> {
  const { getToolManager } = await import('../tools/toolManagerAccessor');
  const binary = resolveBasemindBinary();
  if (!binary) return '';
  try {
    const serverId = await getToolManager().addServer({
      name: 'Basemind',
      description: 'Local code search and semantic graph engine',
      transport: 'stdio',
      command: binary,
      args: ['serve', '--no-watch'],
      enabled: true,
    });
    return serverId;
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) return 'basemind';
    return '';
  }
}

export async function unregisterBasemindServer(): Promise<void> {
  const { getToolManager } = await import('../tools/toolManagerAccessor');
  try {
    await getToolManager().removeServer('basemind');
  } catch {}
}

export async function getBasemindServerStatus(): Promise<{ status: string }> {
  if (isDaemonRunning()) return { status: 'connected' };
  return { status: 'disconnected' };
}
