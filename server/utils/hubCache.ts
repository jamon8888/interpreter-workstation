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
 * basemind overrides hf-hub's default to ~/.local/share/basemind/hub, so the
 * hub-specific HF cache env vars win (test and distribution overrides), then
 * the hub override used by the PII-ready probe, and finally basemind's XDG
 * data home.
 */
export function resolveHubBaseDir(): string {
  return (
    process.env.HF_HUB_CACHE?.trim() ||
    process.env.HUGGINGFACE_HUB_CACHE?.trim() ||
    (process.env.INTERPRETER_USER_DATA_DIR?.trim()
      ? path.join(process.env.INTERPRETER_USER_DATA_DIR.trim(), 'basemind-hub')
      : '') ||
    path.join(homedir(), '.local', 'share', 'basemind', 'hub')
  );
}

/**
 * The hub stores weights at <repo>/snapshots/<revision>/model.onnx, so a
 * downloaded model has no .onnx directly under the repo directory. Check the
 * repo root and one snapshot level down; hf-hub links blobs from the snapshot
 * dir, so symlinks count as cached artifacts.
 */
export function hubRepoHasArtifact(baseDir: string, repoDir: string): boolean {
  const dir = path.join(baseDir, repoDir);
  if (!existsSync(dir)) return false;
  try {
    if (readdirSync(dir).some((entry) => entry.endsWith('.onnx'))) return true;
    const snapshots = path.join(dir, 'snapshots');
    if (!existsSync(snapshots)) return false;
    return readdirSync(snapshots).some((revision) => {
      const revisionDir = path.join(snapshots, revision);
      try {
        return readdirSync(revisionDir).some((entry) => entry.endsWith('.onnx'));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/** True when the resource's model weights are cached in the hub. */
export function isModelResourceReady(resource: ModelResource): boolean {
  const baseDir = resolveHubBaseDir();
  return MODEL_RESOURCE_REPOS[resource].some((repo) => hubRepoHasArtifact(baseDir, repo));
}
