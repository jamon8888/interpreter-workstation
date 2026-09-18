import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, createWriteStream, existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { resolveHubBaseDirs } from '../utils/hubCache';

export interface PreseedFile {
  /** Repo-relative path, e.g. `models/gliner_small-v2.5/span/fp32/model.onnx`. */
  path: string;
  /** Expected SHA-256 of the complete file (xberg verifies the same manifest). */
  sha256: string;
  /** Expected size in bytes (resume + completeness check without hashing). */
  size: number;
}

interface PreseedHeaders {
  get(name: string): string | null;
}

interface PreseedResponse {
  ok: boolean;
  status: number;
  headers: PreseedHeaders;
  body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | null;
}

export type PreseedFetchFn = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<PreseedResponse>;

/** Hugging Face repository holding xberg-managed GLiNER ONNX exports. */
export const GLINER_REPO = 'xberg-io/gliner-models';
/** Pinned revision xberg resolves (see xberg GlineBackend GLINER_MODELS_REVISION). */
export const GLINER_REV = 'afb0faaa3c8e7d0de7796bd37e625026ff635fe0';
/**
 * gliner_small-v2.5 artifacts (the model the onboarding downloads: ~673 MB).
 * SHAs mirror xberg's checked-in gliner-models.sha256 manifest — trust
 * attaches to the manifest, so a tampered upstream file fails verification
 * here instead of feeding wrong weights into inference. When xberg bumps
 * GLINER_MODELS_REVISION or the fleet, update GLINER_REV + these entries
 * from xberg-io/gliner-models at that revision (same file paths).
 */
export const GLINER_FILES: PreseedFile[] = [
  {
    path: 'models/gliner_small-v2.5/span/fp32/model.onnx',
    sha256: '4b137f355fe2fc1d7b359934eeb26f9b3bf3810afcb2bfd86d39b24e167309d5',
    size: 664_780_382,
  },
  {
    path: 'models/gliner_small-v2.5/span/fp32/tokenizer.json',
    sha256: '91cf35efa9ec3549c6c52a415cdd7531fd172858d7d9eecef720bc4a3f1f8699',
    size: 8_649_232,
  },
];

const DEFAULT_FILE_TIMEOUT_MS = 120 * 60_000;

function repoDirName(repo: string): string {
  return `models--${repo.replace('/', '--')}`;
}

function fileUrl(repo: string, rev: string, filePath: string): string {
  return `https://huggingface.co/${repo}/resolve/${rev}/${filePath}`;
}

async function* streamBody(body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  if (Symbol.asyncIterator in Object(body)) {
    yield* body as AsyncIterable<Uint8Array>;
    return;
  }
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function downloadFile(
  url: string,
  destIncomplete: string,
  startByte: number,
  fetchFn: PreseedFetchFn,
  timeoutMs: number,
): Promise<void> {
  const attempt = async (from: number): Promise<void> => {
    const headers: Record<string, string> = {};
    if (from > 0) headers['Range'] = `bytes=${from}-`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { headers, signal: controller.signal });
      // A 200 to a ranged request means the server ignored Range: this body
      // already starts at byte zero, so overwrite the partial file with it
      // instead of abandoning the response for a second download.
      const writeFrom = from > 0 && res.status === 200 ? 0 : from;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      if (!res.body) throw new Error(`empty body for ${url}`);
      await new Promise<void>((resolve, reject) => {
        const out = createWriteStream(destIncomplete, { flags: writeFrom > 0 ? 'a' : 'w' });
        out.on('error', reject);
        out.on('finish', resolve);
        (async () => {
          try {
            for await (const chunk of streamBody(res.body!)) {
              if (!out.write(chunk)) await new Promise<void>((r) => out.once('drain', r));
            }
            out.end();
          } catch (err) {
            out.destroy();
            reject(err);
          }
        })();
      });
    } finally {
      clearTimeout(timer);
    }
  };
  await attempt(startByte);
}

export interface PreseedOptions {
  baseDir?: string;
  fetchFn?: PreseedFetchFn;
  repo?: string;
  rev?: string;
  files?: PreseedFile[];
  fileTimeoutMs?: number;
}

/**
 * Pre-seed the GLiNER NER model into the Hugging Face hub cache layout
 * (blobs/<sha256> + refs/main + snapshots/<rev>/<path> symlinks) that
 * xberg's lazy loader resolves. Needed because no basemind one-shot CLI
 * command exercises the NER backend — `scan` never initializes it and
 * `redact` uses the pattern engine — so the scan-based warmup can never
 * trigger the download; NER otherwise only arrives via the persistent
 * daemon's document lane on first real use.
 */
export async function preseedNerModel(opts: PreseedOptions = {}): Promise<{ ok: boolean; error?: string }> {
  const baseDir = opts.baseDir ?? resolveHubBaseDirs()[0];
  const repo = opts.repo ?? GLINER_REPO;
  const rev = opts.rev ?? GLINER_REV;
  const files = opts.files ?? GLINER_FILES;
  const fetchFn = opts.fetchFn ?? (fetch as unknown as PreseedFetchFn);
  const timeoutMs = opts.fileTimeoutMs ?? DEFAULT_FILE_TIMEOUT_MS;

  const repoDir = path.join(baseDir, repoDirName(repo));
  mkdirSync(path.join(repoDir, 'blobs'), { recursive: true });
  mkdirSync(path.join(repoDir, 'refs'), { recursive: true });

  for (const file of files) {
    const blobPath = path.join(repoDir, 'blobs', file.sha256);
    const incompletePath = `${blobPath}.incomplete`;
    try {
      let complete = false;
      if (existsSync(blobPath)) {
        try {
          complete = statSync(blobPath).size === file.size && (await sha256File(blobPath)) === file.sha256;
        } catch {
          complete = false;
        }
        if (!complete) rmSync(blobPath, { force: true });
      }
      if (!complete) {
        let startByte = 0;
        if (existsSync(incompletePath)) {
          try {
            const size = statSync(incompletePath).size;
            startByte = size < file.size ? size : 0;
            if (startByte === 0) rmSync(incompletePath, { force: true });
          } catch {
            startByte = 0;
          }
        }
        await downloadFile(fileUrl(repo, rev, file.path), incompletePath, startByte, fetchFn, timeoutMs);
        const digest = await sha256File(incompletePath);
        if (digest !== file.sha256) {
          rmSync(incompletePath, { force: true });
          return { ok: false, error: `sha256 mismatch for ${file.path} (xberg would reject these weights)` };
        }
        renameSync(incompletePath, blobPath);
      }
      // refs/main pins the revision; snapshot entries symlink to the blob,
      // mirroring exactly what hf-hub clients write. Windows without symlink
      // privileges raises EPERM: fall back to a hardlink, then a plain copy —
      // content is identical either way, only space efficiency differs.
      mkdirSync(path.join(repoDir, 'snapshots', rev, path.dirname(file.path)), { recursive: true });
      const snapshotFile = path.join(repoDir, 'snapshots', rev, file.path);
      try {
        rmSync(snapshotFile, { force: true });
      } catch {
        // intentionally empty
      }
      try {
        symlinkSync(path.relative(path.dirname(snapshotFile), blobPath), snapshotFile);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code !== 'EPERM' && code !== 'EACCES') throw err;
        try {
          linkSync(blobPath, snapshotFile);
        } catch {
          copyFileSync(blobPath, snapshotFile);
        }
      }
      writeFileSync(path.join(repoDir, 'refs', 'main'), rev);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `${file.path}: ${message}` };
    }
  }
  return { ok: true };
}
