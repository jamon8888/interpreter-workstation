import { existsSync, readdirSync } from 'node:fs';
import { basemindScan, basemindRescan } from '../utils/basemindManager';
import { resolveXbergPipelineBinary } from '../utils/xbergPipelineBinary';
import { resolveBasemindBinary } from '../utils/basemindManager';
import path from 'node:path';

export interface WorkspaceScanRequest {
  /** Absolute workspace root path (basemind --root). */
  workspacePath: string;
  /** Paths to scan relative to workspace root. Defaults to ['.redacted']. */
  paths?: string[];
  /** Use --json for machine-readable output. */
  json?: boolean;
}

export interface WorkspaceScanResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface WorkspaceScanStatus {
  redactionActive: boolean;
  indexing: boolean;
  fileCount: number;
  lastScanAt: string | null;
  xbergAvailable: boolean;
  basemindAvailable: boolean;
  resourcesReady: {
    nerModel: boolean;
    embeddings: boolean;
    reranker: boolean;
  };
}

let activeScanCount = 0;
let filesRemaining = 0;
let lastScanAt: string | null = null;

export function setIndexingState(inProgress: boolean, count: number = 0) {
  if (inProgress) {
    activeScanCount++;
  } else {
    activeScanCount = Math.max(0, activeScanCount - 1);
  }
  filesRemaining = count;
  if (activeScanCount === 0 && count === 0) {
    lastScanAt = new Date().toISOString();
  }
}

function hubCacheDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (process.env.HF_HUB_CACHE) return process.env.HF_HUB_CACHE;
  if (process.env.HUGGINGFACE_HUB_CACHE) return process.env.HUGGINGFACE_HUB_CACHE;
  if (process.env.XDG_CACHE_HOME) return path.join(process.env.XDG_CACHE_HOME, 'huggingface', 'hub');
  return path.join(home, '.cache', 'huggingface', 'hub');
}

function resourceReady(resource: 'nerModel' | 'embeddings' | 'reranker'): boolean {
  // Mirror repos backing each lane; presence of any snapshotted file means
  // the backend really has an artifact cached (hf-hub layout).
  const repos: Record<typeof resource, string> = {
    nerModel: 'models/xberg-io--gliner-models',
    embeddings: 'models/xberg-io--embedding-models',
    reranker: 'models/xberg-io--reranker-models',
  };
  const snapshotsDir = path.join(hubCacheDir(), repos[resource], 'snapshots');
  if (!existsSync(snapshotsDir)) return false;
  try {
    return readdirSync(snapshotsDir, { recursive: true, withFileTypes: true }).some((e) => e.isFile());
  } catch {
    return false;
  }
}

/**
 * Returns the current status of workspace scanning, xberg pipeline availability,
 * and global resource readiness.
 */
export function getWorkspaceScanStatus(): WorkspaceScanStatus {
  let xbergAvailable = false;
  try {
    resolveXbergPipelineBinary();
    xbergAvailable = true;
  } catch {
    xbergAvailable = false;
  }

  let basemindAvailable = false;
  try {
    resolveBasemindBinary();
    basemindAvailable = true;
  } catch {
    basemindAvailable = false;
  }

  return {
    redactionActive: xbergAvailable,
    indexing: activeScanCount > 0,
    fileCount: filesRemaining,
    lastScanAt,
    xbergAvailable,
    basemindAvailable,
    resourcesReady: {
      nerModel: resourceReady('nerModel'),
      embeddings: resourceReady('embeddings'),
      reranker: resourceReady('reranker'),
    },
  };
}

/**
 * Scan the .redacted/ shadow file corpus with basemind.
 * Call this after workspacePseudonymize writes shadow files.
 */
export async function workspaceScan(req: WorkspaceScanRequest): Promise<WorkspaceScanResult> {
  const { workspacePath, paths = ['.redacted'], json = true } = req;

  setIndexingState(true, 1);
  const result = await basemindScan({
    root: workspacePath,
    paths,
    json,
  });
  setIndexingState(false, 0);

  return {
    success: result.success,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
  };
}

/**
 * Re-scan specific paths (faster than full scan for incremental updates).
 */
export async function workspaceRescan(req: WorkspaceScanRequest): Promise<WorkspaceScanResult> {
  const { workspacePath, paths = ['.redacted'], json = true } = req;

  setIndexingState(true, paths.length);
  const result = await basemindRescan({
    root: workspacePath,
    paths,
    json,
  });
  setIndexingState(false, 0);

  return {
    success: result.success,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
  };
}
