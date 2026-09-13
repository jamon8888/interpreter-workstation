import { isModelResourceReady, type ModelResource } from '../utils/hubCache';

export type BasemindDownloadStage = 'ner' | 'embeddings' | 'reranker';

export interface BasemindDownloadProgress {
  stage: BasemindDownloadStage;
  progress: number;
  done: boolean;
  error?: string;
}

const STAGES: Array<{ stage: BasemindDownloadStage; resource: ModelResource }> = [
  { stage: 'ner', resource: 'nerModel' },
  { stage: 'embeddings', resource: 'embeddings' },
  { stage: 'reranker', resource: 'reranker' },
];

/**
 * Basemind has no CLI download command: models download lazily inside
 * basemind processes on first feature use. This reports the truth —
 * an already-cached stage succeeds immediately, a missing stage fails with
 * that explanation instead of faking progress (theater never ships).
 */
export async function* basemindDownload(): AsyncGenerator<BasemindDownloadProgress> {
  for (const { stage, resource } of STAGES) {
    yield { stage, progress: 0, done: false };
    if (isModelResourceReady(resource)) {
      yield { stage, progress: 100, done: true };
    } else {
      yield {
        stage,
        progress: 0,
        done: false,
        error: 'basemind has no CLI download command; models download lazily on first feature use',
      };
    }
  }
}
