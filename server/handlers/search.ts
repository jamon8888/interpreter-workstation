import { resolve } from 'node:path';
import { basemindCommsDir, isDaemonRunning, mcpRequest } from '../utils/basemindManager';

export interface SearchHit {
  path: string;
  chunkId: string;
  symbol: string;
  kind: string;
  lang: string;
  lineStart: number;
  lineEnd: number;
  byteStart: number;
  byteEnd: number;
  distance?: number;
  score?: number;
  rerankScore?: number;
  matchedLanes: string[];
  keywordRank?: number;
  vectorRank?: number;
  exactRank?: number;
}

export interface SearchCodeParams {
  query: string;
  limit?: number;
  maxTokens?: number;
  format?: string;
  lane?: string;
  rerankerEnabled?: boolean;
  rerankerPreset?: string;
  rerankerTopK?: number;
}

export interface SearchCodeResponse {
  query: string;
  budgeted: boolean;
  hits: SearchHit[];
  degradedLanes: string[];
  degradedReason?: string;
  elapsedUs: number;
}

function mapSearchHit(hit: unknown): SearchHit {
  const h = hit as Record<string, unknown>;
  return {
    path: String(h.path ?? ''),
    chunkId: String(h.chunk_id ?? ''),
    symbol: String(h.symbol ?? ''),
    kind: String(h.kind ?? ''),
    lang: String(h.lang ?? ''),
    lineStart: Number(h.line_start ?? 0),
    lineEnd: Number(h.line_end ?? 0),
    byteStart: Number(h.byte_start ?? 0),
    byteEnd: Number(h.byte_end ?? 0),
    distance: h.distance !== undefined && h.distance !== null ? Number(h.distance) : undefined,
    score: h.score !== undefined && h.score !== null ? Number(h.score) : undefined,
    rerankScore: h.rerank_score !== undefined && h.rerank_score !== null ? Number(h.rerank_score) : undefined,
    matchedLanes: Array.isArray(h.matched_lanes) ? h.matched_lanes.map(String) : [],
    keywordRank: h.keyword_rank !== undefined && h.keyword_rank !== null ? Number(h.keyword_rank) : undefined,
    vectorRank: h.vector_rank !== undefined && h.vector_rank !== null ? Number(h.vector_rank) : undefined,
    exactRank: h.exact_rank !== undefined && h.exact_rank !== null ? Number(h.exact_rank) : undefined,
  };
}

export async function basemindSearchCode(params: {
  query: string;
  limit?: number;
  maxTokens?: number;
  format?: string;
  lane?: string;
  rerankerEnabled?: boolean;
  rerankerPreset?: string;
  rerankerTopK?: number;
}): Promise<{
  query: string;
  budgeted: boolean;
  hits: Array<{
    path: string;
    chunkId: string;
    symbol: string;
    kind: string;
    lang: string;
    lineStart: number;
    lineEnd: number;
    byteStart: number;
    byteEnd: number;
    distance?: number;
    score?: number;
    rerankScore?: number;
    matchedLanes: string[];
    keywordRank?: number;
    vectorRank?: number;
    exactRank?: number;
  }>;
  degradedLanes: string[];
  degradedReason?: string;
  elapsedUs: number;
}> {
  if (!isDaemonRunning()) {
    throw new Error('basemind daemon not running');
  }

  const args: Record<string, unknown> = {
    query: params.query,
  };

  if (params.limit !== undefined) args.limit = params.limit;
  if (params.maxTokens !== undefined) args.max_tokens = params.maxTokens;
  if (params.format !== undefined) args.format = params.format;
  if (params.lane !== undefined) args.lane = params.lane;
  if (params.rerankerEnabled !== undefined) args.reranker_enabled = params.rerankerEnabled;
  if (params.rerankerPreset !== undefined) args.reranker_preset = params.rerankerPreset;
  if (params.rerankerTopK !== undefined) args.reranker_top_k = params.rerankerTopK;

  const result = await mcpRequest('tools/call', {
    name: 'code',
    arguments: {
      mode: 'semantic',
      ...args,
    },
  });

  const response = result as {
    query: string;
    budgeted: boolean;
    hits: Array<Record<string, unknown>>;
    degraded_lanes: string[];
    degraded_reason?: string;
    elapsed_us: number;
  };

  return {
    query: response.query,
    budgeted: response.budgeted,
    hits: response.hits.map(mapSearchHit),
    degradedLanes: response.degraded_lanes,
    degradedReason: response.degraded_reason,
    elapsedUs: response.elapsed_us,
  };
}