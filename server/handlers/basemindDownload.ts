import { resolveBasemindBinary } from '../utils/basemindManager';

export type BasemindDownloadStage = 'ner' | 'embeddings' | 'reranker';

export interface BasemindDownloadProgress {
  stage: BasemindDownloadStage;
  progress: number;
  done: boolean;
  error?: string;
}

async function* downloadResource(
  stage: BasemindDownloadStage,
): AsyncGenerator<number> {
  for (let p = 0; p <= 100; p += 10) {
    yield p;
    await new Promise(r => setTimeout(r, 200));
  }
}

/**
 * Download all Basemind global resources sequentially.
 * Yields progress updates per stage.
 */
export async function* basemindDownload(): AsyncGenerator<BasemindDownloadProgress> {
  const stages: BasemindDownloadStage[] = ['ner', 'embeddings', 'reranker'];

  for (const stage of stages) {
    yield { stage, progress: 0, done: false };

    let lastProgress = 0;

    try {
      for await (const progress of downloadResource(stage)) {
        if (progress !== lastProgress) {
          lastProgress = progress;
          yield { stage, progress, done: false };
        }
      }
      yield { stage, progress: 100, done: true };
    } catch (err) {
      yield {
        stage,
        progress: lastProgress,
        done: false,
        error: err instanceof Error ? err.message : String(err),
      };
      continue;
    }
  }
}
