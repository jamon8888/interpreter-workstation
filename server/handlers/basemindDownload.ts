import { spawn } from 'node:child_process';
import { resolveBasemindBinary } from '../utils/basemindManager';

export type BasemindDownloadStage = 'ner' | 'embeddings' | 'reranker';

export interface BasemindDownloadProgress {
  stage: BasemindDownloadStage;
  progress: number;
  done: boolean;
  error?: string;
}

function runBasemindCommand(args: string[], description: string): Promise<void> {
  const binary = resolveBasemindBinary();
  if (!binary) {
    throw new Error(`basemind binary not found — resolveBasemindBinary returned empty string`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: 'pipe' });
    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${description} failed${stderr ? `: ${stderr}` : ` (exit ${code})`}`));
    });
    child.on('error', (err) => reject(new Error(`${description} spawn error: ${err.message}`)));
  });
}

/**
 * Download all Basemind global resources sequentially.
 * Yields progress updates per stage.
 *
 * Stage mapping (per UI labels in BasemindSetupScreen):
 *   ner         → basemind lang install  (tree-sitter grammars)
 *   embeddings  → basemind serve --no-watch (starts MCP server, downloads embeddings on first use)
 *   reranker    → (implicitly ready after serve; reranker model fetched on first search call)
 */
export async function* basemindDownload(): AsyncGenerator<BasemindDownloadProgress> {
  const stages: BasemindDownloadStage[] = ['ner', 'embeddings', 'reranker'];

  for (const stage of stages) {
    yield { stage, progress: 0, done: false };
    yield { stage, progress: 10, done: false };

    try {
      if (stage === 'ner') {
        // Download/tree-sitter grammars for language parsing
        await runBasemindCommand(['lang', 'install'], 'basemind lang install');
      } else if (stage === 'embeddings') {
        // Start the MCP server so the daemon is running — embeddings
        // model is fetched on first scan call. --no-watch avoids
        // background indexing noise during setup.
        await runBasemindCommand(['serve', '--no-watch'], 'basemind serve');
      } else {
        // reranker: fetched on first rerank call (first search after indexing).
        // No explicit command needed; the MCP serve started in the previous
        // stage is sufficient. Mark done immediately.
      }
      yield { stage, progress: 100, done: true };
    } catch (err) {
      yield {
        stage,
        progress: 0,
        done: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
