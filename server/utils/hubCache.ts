import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export type ModelResource = 'nerModel' | 'embeddings' | 'reranker';

export const MODEL_RESOURCE_REPOS: Record<ModelResource, string[]> = {
  nerModel: [
    'models--xberg-io--gliner-pii-models',
    'models--knowledgator--gliner-pii-edge-v1.0',
    'models--xberg-io--gliner-models',
  ],
  embeddings: ['models--xberg-io--embedding-models'],
  reranker: ['models--xberg-io--reranker-models'],
};

/**
 * Resolve the Hugging Face hub cache directory basemind downloads models into.
 * Empirically confirmed (2026-09-15, real `basemind memory documents` run):
 * with no override, xberg/hf-hub falls back to the standard hf-hub default,
 * ~/.cache/huggingface/hub — basemind does NOT redirect it to its own XDG
 * data home. The hub-specific HF cache env vars still win when set (test and
 * distribution overrides), then INTERPRETER_USER_DATA_DIR, then that default.
 */
export function resolveHubBaseDir(): string {
  return (
    process.env.HF_HUB_CACHE?.trim() ||
    process.env.HUGGINGFACE_HUB_CACHE?.trim() ||
    (process.env.INTERPRETER_USER_DATA_DIR?.trim()
      ? path.join(process.env.INTERPRETER_USER_DATA_DIR.trim(), 'basemind-hub')
      : '') ||
    path.join(homedir(), '.cache', 'huggingface', 'hub')
  );
}

const MAX_ARTIFACT_SEARCH_DEPTH = 4;

/**
 * Recursively look for a `.onnx` file under `dir`, up to `depth` levels down.
 * A real download landed at
 * snapshots/<rev>/<preset-name>/model.onnx — one level deeper than a plain
 * <repo>/snapshots/<rev>/model.onnx guess, so this can't stop at a fixed
 * depth. hf-hub links blobs from the snapshot dir, so symlinks count.
 */
function hasOnnxFile(dir: string, depth: number): boolean {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.name.endsWith('.onnx')) return true;
  }
  if (depth <= 0) return false;
  for (const entry of entries) {
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      if (hasOnnxFile(path.join(dir, entry.name), depth - 1)) return true;
    }
  }
  return false;
}

/** True when the repo directory (root or nested under snapshots/<rev>/...) has a cached .onnx artifact. */
export function hubRepoHasArtifact(baseDir: string, repoDir: string): boolean {
  const dir = path.join(baseDir, repoDir);
  if (!existsSync(dir)) return false;
  return hasOnnxFile(dir, MAX_ARTIFACT_SEARCH_DEPTH);
}

/** True when the resource's model weights are cached in the hub. */
export function isModelResourceReady(resource: ModelResource): boolean {
  const baseDir = resolveHubBaseDir();
  return MODEL_RESOURCE_REPOS[resource].some((repo) => hubRepoHasArtifact(baseDir, repo));
}
