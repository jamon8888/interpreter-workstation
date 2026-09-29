import { describe, expect, test, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planWorkspaceRerankerToml } from './rerankerWorkspace';

const GTE_ID = 'onnx-community/gte-multilingual-reranker-base';
const GTE_FILE = 'onnx/model_int8.onnx';

describe('planWorkspaceRerankerToml', () => {
  test('creates both custom_model sections from an empty workspace', () => {
    const { toml, changed } = planWorkspaceRerankerToml(null);
    expect(changed).toBe(true);
    for (const section of ['code_search', 'documents']) {
      expect(toml).toContain(`[${section}.reranker.custom_model]`);
    }
    expect(toml).toContain(GTE_ID);
    expect(toml).toContain(GTE_FILE);
  });

  test('never touches existing custom_model sections (byte-identical)', () => {
    const existing = [
      '[code_search.reranker.custom_model]',
      'model_id = "my-org/my-reranker"',
      '',
      '[documents.reranker.custom_model]',
      'model_id = "my-org/my-reranker"',
      '',
    ].join('\n');
    const { toml, changed } = planWorkspaceRerankerToml(existing);
    expect(changed).toBe(false);
    expect(toml).toBe(existing);
    expect(toml).not.toContain(GTE_ID);
  });

  test('is idempotent', () => {
    const once = planWorkspaceRerankerToml(null);
    expect(once.changed).toBe(true);
    const twice = planWorkspaceRerankerToml(once.toml);
    expect(twice.changed).toBe(false);
    expect(twice.toml).toBe(once.toml);
  });

  test('preserves unrelated sections and comments', () => {
    const existing = '# my workspace\n[code_search]\nembed = false\n';
    const { toml, changed } = planWorkspaceRerankerToml(existing);
    expect(changed).toBe(true);
    expect(toml).toContain('# my workspace');
    expect(toml).toContain('[code_search]');
    expect(toml).toContain('embed = false');
    expect(toml).toContain('[documents.reranker.custom_model]');
  });

  test('leaves malformed TOML untouched rather than corrupting it', () => {
    const broken = '[unclosed section\nkey = ';
    const { toml, changed } = planWorkspaceRerankerToml(broken);
    expect(changed).toBe(false);
    expect(toml).toBe(broken);
  });

  test('adds only the missing tier when one custom_model exists', () => {
    const existing = '[code_search.reranker.custom_model]\nmodel_id = "my-org/my-reranker"\n';
    const { toml, changed } = planWorkspaceRerankerToml(existing);
    expect(changed).toBe(true);
    expect(toml).toContain('my-org/my-reranker');
    expect(toml).toContain('[documents.reranker.custom_model]');
    expect(toml).toContain(GTE_ID);
  });
});

describe('ensureWorkspaceRerankerModel (fs)', () => {
  let tmpRoots: string[] = [];
  function makeRoot(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'ws-rerank-'));
    tmpRoots.push(dir);
    return dir;
  }
  afterEach(() => {
    for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
    tmpRoots = [];
  });

  test('creates basemind.toml with both GTE sections when absent', async () => {
    const { ensureWorkspaceRerankerModel } = await import('./rerankerWorkspace');
    const root = makeRoot();
    const result = await ensureWorkspaceRerankerModel(root);
    expect(result.written).toBe(true);
    const content = readFileSync(path.join(root, 'basemind.toml'), 'utf-8');
    expect(content).toContain('[code_search.reranker.custom_model]');
    expect(content).toContain('[documents.reranker.custom_model]');
    expect(content).toContain('onnx-community/gte-multilingual-reranker-base');
  });

  test('second call is a byte-identical no-op', async () => {
    const { ensureWorkspaceRerankerModel } = await import('./rerankerWorkspace');
    const root = makeRoot();
    await ensureWorkspaceRerankerModel(root);
    const before = readFileSync(path.join(root, 'basemind.toml'), 'utf-8');
    const result = await ensureWorkspaceRerankerModel(root);
    expect(result.written).toBe(false);
    expect(readFileSync(path.join(root, 'basemind.toml'), 'utf-8')).toBe(before);
  });

  test('merges into an existing user file without touching the rest', async () => {
    const { ensureWorkspaceRerankerModel } = await import('./rerankerWorkspace');
    const root = makeRoot();
    const userToml = '# mine\n[code_search]\nembed = true\n';
    writeFileSync(path.join(root, 'basemind.toml'), userToml);
    const result = await ensureWorkspaceRerankerModel(root);
    expect(result.written).toBe(true);
    const content = readFileSync(path.join(root, 'basemind.toml'), 'utf-8');
    expect(content).toContain('# mine');
    expect(content).toContain('embed = true');
    expect(content).toContain('[documents.reranker.custom_model]');
  });

  test('leaves a fully-configured workspace alone', async () => {
    const { ensureWorkspaceRerankerModel } = await import('./rerankerWorkspace');
    const root = makeRoot();
    const userToml = '[code_search.reranker.custom_model]\nmodel_id = "my-org/mine"\n\n[documents.reranker.custom_model]\nmodel_id = "my-org/mine"\n';
    writeFileSync(path.join(root, 'basemind.toml'), userToml);
    const result = await ensureWorkspaceRerankerModel(root);
    expect(result.written).toBe(false);
    expect(readFileSync(path.join(root, 'basemind.toml'), 'utf-8')).toBe(userToml);
  });
});

describe('stale v2-m3 cache (fs fixtures)', () => {
  let tmpDirs: string[] = [];
  function makeHub(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'hub-stale-'));
    tmpDirs.push(dir);
    return dir;
  }
  function seedPreset(baseDir: string, preset: string, bytes: number): void {
    const file = path.join(baseDir, 'models--xberg-io--reranker-models', 'snapshots', 'rev1', preset, 'model.onnx');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.alloc(bytes, 7));
  }
  afterEach(() => {
    for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
  });

  test('measures the stale v2-m3 footprint, 0 when absent', async () => {
    const { getStaleRerankerCacheBytes } = await import('./rerankerWorkspace');
    const hub = makeHub();
    expect(await getStaleRerankerCacheBytes([hub])).toBe(0);
    seedPreset(hub, 'bge-reranker-v2-m3', 1024);
    expect(await getStaleRerankerCacheBytes([hub])).toBeGreaterThanOrEqual(1024);
  });

  test('clear removes only the v2-m3 preset dir', async () => {
    const { clearStaleRerankerCache, getStaleRerankerCacheBytes } = await import('./rerankerWorkspace');
    const hub = makeHub();
    seedPreset(hub, 'bge-reranker-v2-m3', 1024);
    seedPreset(hub, 'bge-reranker-base', 512);
    const cleared = await clearStaleRerankerCache([hub]);
    expect(cleared).toBeGreaterThanOrEqual(1024);
    expect(await getStaleRerankerCacheBytes([hub])).toBe(0);
    expect(existsSync(path.join(hub, 'models--xberg-io--reranker-models', 'snapshots', 'rev1', 'bge-reranker-base', 'model.onnx'))).toBe(true);
  });
});
