import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { GTE_REPO } from './basemindPreseed';
import { getLastWorkspace, getRecentFolders } from '../configStore';
import { resolveHubBaseDirs } from '../utils/hubCache';

/** ONNX file inside the GTE repo (mirrors the preseed manifest). */
export const GTE_CUSTOM_MODEL_FILE = 'onnx/model_int8.onnx';

const TIERS = ['code_search', 'documents'] as const;

/** Table presence (not its content) decides: never emit a duplicate section. */
function hasCustomModelTable(doc: unknown, tier: string): boolean {
  if (typeof doc !== 'object' || doc === null) return false;
  const tierTable = (doc as Record<string, unknown>)[tier];
  if (typeof tierTable !== 'object' || tierTable === null) return false;
  const reranker = (tierTable as Record<string, unknown>)['reranker'];
  if (typeof reranker !== 'object' || reranker === null) return false;
  const custom = (reranker as Record<string, unknown>)['custom_model'];
  return typeof custom === 'object' && custom !== null;
}

function customModelBlock(tier: string): string {
  return (
    `[${tier}.reranker.custom_model]\n` +
    `model_id = "${GTE_REPO}"\n` +
    `model_file = "${GTE_CUSTOM_MODEL_FILE}"\n`
  );
}

/**
 * Pure plan: which `basemind.toml` content a workspace needs for the GTE
 * reranker, without touching the filesystem. Creates the missing
 * `custom_model` tier sections, preserves everything else byte-for-byte,
 * never duplicates a section, and leaves malformed TOML untouched.
 */
export function planWorkspaceRerankerToml(existing: string | null): {
  toml: string;
  changed: boolean;
} {
  const base = existing ?? '';
  let doc: unknown;
  try {
    doc = base.trim() === '' ? {} : parseToml(base);
  } catch {
    return { toml: base, changed: false };
  }
  const missing = TIERS.filter((tier) => !hasCustomModelTable(doc, tier));
  if (missing.length === 0) return { toml: base, changed: false };
  const block = missing.map(customModelBlock).join('\n');
  const prefix = base === '' ? '' : base.endsWith('\n\n') ? base : base.endsWith('\n') ? `${base}\n` : `${base}\n\n`;
  return { toml: `${prefix}${block}`, changed: true };
}

const WORKSPACE_TOML = 'basemind.toml';
const LEGACY_TOML = path.join('.basemind', WORKSPACE_TOML);

/**
 * Ensure one workspace resolves the GTE reranker: read its `basemind.toml`
 * (legacy `.basemind/` fallback), merge the missing `custom_model` tiers,
 * write back only on change. Never overwrites, never deletes.
 */
export async function ensureWorkspaceRerankerModel(root: string): Promise<{ written: boolean; path: string }> {
  // Roots come from app config (last/recent workspaces), not the network —
  // but a corrupt entry must never turn into a path traversal. Refuse anything
  // that doesn't normalize to an absolute directory path.
  const clean = path.normalize(root);
  if (!path.isAbsolute(clean)) {
    throw new Error(`refusing to write basemind.toml outside an absolute workspace root: ${root}`);
  }
  const primary = path.join(clean, WORKSPACE_TOML);
  const legacy = path.join(clean, LEGACY_TOML);
  const target = existsSync(primary) ? primary : existsSync(legacy) ? legacy : primary;
  const existing = existsSync(target) ? readFileSync(target, 'utf-8') : null;
  const { toml, changed } = planWorkspaceRerankerToml(existing);
  if (!changed) return { written: false, path: target };
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, toml);
  console.log(`[rerankerWorkspace] GTE custom_model written to ${target}`);
  return { written: true, path: target };
}

/**
 * Ensure every workspace this app opened. Best-effort per root: one
 * unreadable workspace never blocks the others. Called after the reranker
 * weights land (download stage), so activation follows the download.
 */
export async function ensureKnownWorkspacesRerankerModels(): Promise<Array<{ root: string; written: boolean }>> {
  const roots = new Set<string>();
  try {
    const last = await getLastWorkspace();
    if (last) roots.add(last);
    for (const folder of await getRecentFolders()) {
      if (folder?.path) roots.add(folder.path);
    }
  } catch {
    return [];
  }
  const results: Array<{ root: string; written: boolean }> = [];
  for (const root of roots) {
    try {
      const { written } = await ensureWorkspaceRerankerModel(root);
      results.push({ root, written });
    } catch (err) {
      console.warn(`[rerankerWorkspace] ensure failed for ${root}: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ root, written: false });
    }
  }
  return results;
}

const RERANKER_MODELS_DIR = 'models--xberg-io--reranker-models';
const V2M3_PRESET_DIR = 'bge-reranker-v2-m3';

function v2m3PresetDirs(baseDir: string): string[] {
  const snapshots = path.join(baseDir, RERANKER_MODELS_DIR, 'snapshots');
  let revs: string[];
  try {
    revs = readdirSync(snapshots);
  } catch {
    return [];
  }
  return revs
    .map((rev) => path.join(snapshots, rev, V2M3_PRESET_DIR))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory();
      } catch {
        return false;
      }
    });
}

function dirBytes(dir: string): number {
  let total = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(full);
      else total += st.size;
    }
  }
  return total;
}

/** Stale v2-m3 footprint across hub dirs (0 when already migrated/clean). */
export async function getStaleRerankerCacheBytes(baseDirs: string[] = resolveHubBaseDirs()): Promise<number> {
  return baseDirs.reduce((total, base) => total + v2m3PresetDirs(base).reduce((sub, dir) => sub + dirBytes(dir), 0), 0);
}

/** Remove stale v2-m3 preset dirs; returns the freed estimate in bytes. Sibling presets untouched. */
export async function clearStaleRerankerCache(baseDirs: string[] = resolveHubBaseDirs()): Promise<number> {
  let freed = 0;
  for (const base of baseDirs) {
    for (const dir of v2m3PresetDirs(base)) {
      freed += dirBytes(dir);
      try {
        rmSync(dir, { recursive: true, force: true });
        console.log(`[rerankerWorkspace] cleared stale ${dir}`);
      } catch (err) {
        console.warn(`[rerankerWorkspace] clear failed for ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return freed;
}
