import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { resolveBasemindBinary } from '../utils/basemindManager';
import { isModelResourceReady, type ModelResource } from '../utils/hubCache';

const execFileAsync = promisify(execFile);

export type BasemindDownloadStage = 'embeddings' | 'reranker' | 'nerModel';

export interface BasemindDownloadProgress {
  stage: BasemindDownloadStage;
  progress: number;
  done: boolean;
  error?: string;
}

const STAGES: Array<{ stage: BasemindDownloadStage; resource: ModelResource }> = [
  { stage: 'embeddings', resource: 'embeddings' },
  { stage: 'reranker', resource: 'reranker' },
  { stage: 'nerModel', resource: 'nerModel' },
];

const WARMUP_TIMEOUT_MS = 5 * 60_000;
const WARMUP_QUERY = 'quarterly report renewable energy';

/**
 * A tiny, throwaway workspace basemind is allowed to index for the sole
 * purpose of forcing its lazy model loaders to run. Seeded once with content
 * that exercises every lane a warmup call needs: an HTML "document" (for the
 * embeddings/NER document pipeline — plain .txt isn't a recognized document
 * MIME type and falls back to code parsing) and a source file (for `code
 * semantic`, which the reranker warmup runs through).
 */
async function ensureWarmupWorkspace(): Promise<string> {
  const dir = path.join(tmpdir(), 'basemind-model-warmup');
  const gitDir = path.join(dir, '.git');
  const alreadyInitialized = existsSync(gitDir);
  mkdirSync(dir, { recursive: true });
  const docPath = path.join(dir, 'warmup.html');
  writeFileSync(
    docPath,
    '<html><body><p>Contact Jane Doe at jane.doe@example.com about the quarterly '
    + 'report on renewable energy adoption in rural communities.</p></body></html>\n',
  );
  const codePath = path.join(dir, 'warmup.js');
  writeFileSync(
    codePath,
    '// Sums renewable energy output for a quarterly report.\n'
    + 'function sumQuarterlyReport(values) {\n'
    + '  return values.reduce((total, value) => total + value, 0);\n'
    + '}\n'
    + 'module.exports = { sumQuarterlyReport };\n',
  );

  // basemind's `code` domain (used by the reranker warmup) enumerates files
  // via git and returns an empty corpus outside one — `memory documents`
  // (the embeddings warmup) doesn't need this, but code semantic does.
  if (!alreadyInitialized) {
    const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 'basemind-warmup', GIT_AUTHOR_EMAIL: 'basemind-warmup@local', GIT_COMMITTER_NAME: 'basemind-warmup', GIT_COMMITTER_EMAIL: 'basemind-warmup@local' };
    await execFileAsync('git', ['init', '-q'], { cwd: dir });
    await execFileAsync('git', ['add', '-A'], { cwd: dir });
    await execFileAsync('git', ['commit', '-q', '-m', 'warmup'], { cwd: dir, env: gitEnv });
  }
  return dir;
}

function stageArgs(stage: BasemindDownloadStage, workspace: string): string[] {
  switch (stage) {
    case 'embeddings':
      return ['memory', 'documents', WARMUP_QUERY, '--root', workspace, '--limit', '1'];
    case 'reranker':
      return [
        'code', 'semantic', WARMUP_QUERY,
        '--root', workspace,
        '--limit', '1',
        '--rerank',
        '--rerank-preset', 'bge-reranker-v2-m3',
      ];
    case 'nerModel':
      return [
        'scan', '--root', workspace,
        '--documents-enabled', 'true',
        '--documents-ner-enabled', 'true',
        '--documents-redaction-enabled', 'true',
        '-q',
      ];
  }
}

/**
 * Run a one-shot basemind CLI command whose only purpose is to exercise the
 * lazy loader for one model family, so its first-use Hugging Face hub
 * download actually happens. basemind has no dedicated "download models"
 * command (confirmed: no models/warmup/pull subcommand exists), so this
 * piggybacks on the real commands documented to trigger it — `code semantic
 * --rerank`'s own help text states verbatim "first call downloads a model".
 * `BASEMIND_ALLOW_ANY_ROOT` is scoped to this one invocation via env — the
 * warmup workspace is a plain throwaway git repo, not a real project, and
 * would otherwise be refused as an accidentally-inherited scan root.
 */
async function runWarmup(binary: string, stage: BasemindDownloadStage, workspace: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await execFileAsync(binary, stageArgs(stage, workspace), {
      env: { ...process.env, BASEMIND_ALLOW_ANY_ROOT: '1' },
      timeout: WARMUP_TIMEOUT_MS,
    });
    return { ok: true };
  } catch (err) {
    const stderr = err && typeof err === 'object' && 'stderr' in err ? String((err as { stderr?: unknown }).stderr ?? '') : '';
    const tail = stderr.trim().split('\n').slice(-3).join(' ').slice(0, 300);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: tail || message };
  }
}

/**
 * Trigger (or confirm) each Basemind global resource, one stage at a time.
 * Pass `onlyStage` to run just that stage — the onboarding UI calls this once
 * per stage, and re-running all three on every call would re-spawn already
 * satisfied, multi-hundred-MB warmup commands for no reason.
 */
export async function* basemindDownload(onlyStage?: BasemindDownloadStage): AsyncGenerator<BasemindDownloadProgress> {
  const binary = resolveBasemindBinary();

  for (const { stage, resource } of STAGES) {
    if (onlyStage !== undefined && stage !== onlyStage) continue;

    yield { stage, progress: 0, done: false };

    if (isModelResourceReady(resource)) {
      yield { stage, progress: 100, done: true };
      continue;
    }

    if (!binary) {
      yield { stage, progress: 0, done: false, error: 'basemind binary not found' };
      continue;
    }

    const workspace = await ensureWarmupWorkspace();
    const result = await runWarmup(binary, stage, workspace);

    // The warmup command downloads the model, then immediately exercises it
    // (embeds/reranks/detects on the sample doc). A machine-local failure in
    // that second step (e.g. an ONNX Runtime load error) must not be reported
    // as a download failure when the artifact landed in the hub cache anyway.
    if (isModelResourceReady(resource)) {
      yield { stage, progress: 100, done: true };
    } else {
      yield {
        stage,
        progress: 0,
        done: false,
        error: result.error ?? 'warmup command completed but no model artifact was found in the Hugging Face hub cache afterward',
      };
    }
  }
}
