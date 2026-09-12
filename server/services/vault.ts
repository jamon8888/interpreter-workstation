/**
 * PII vault access — reads the caller-persisted encrypted rehydration blob
 * and decrypts it through basemind's `vault` MCP tool.
 *
 * basemind stays stateless here: the encrypted blob lives at
 * `{userData}/vaults/{docId}.enc` and only the decrypted map for the
 * requested document is ever returned to the renderer.
 */

import path from 'node:path';
import fs from 'node:fs';
import { homedir } from 'node:os';

import { ToolManager } from '../tools/toolManager';
import { getOrCreateVaultPassphrase } from './vaultKey';

export function sanitizeVaultDocId(docId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(docId)) {
    throw new Error('[vault] Invalid document id for rehydration lookup');
  }
  return docId;
}

export function resolveUserDataDir(): string {
  const override = process.env.INTERPRETER_USER_DATA_DIR?.trim();
  if (override) return override;
  if (process.versions.electron) {
    const { app } = require('electron') as { app: { getPath(name: 'userData'): string } };
    return app.getPath('userData');
  }
  return path.join(homedir(), '.interpreter');
}

export function resolveVaultBlobPath(docId: string, userDataDir = resolveUserDataDir()): string {
  return path.join(userDataDir, 'vaults', `${sanitizeVaultDocId(docId)}.enc`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Extract the decrypted token→original map from a basemind `vault` tool result. */
export function extractRehydrationMap(result: unknown): Record<string, string> {
  const record = asRecord(result) ?? {};
  const structured = asRecord(record.structuredContent) ?? record;
  const payload = asRecord(structured.result) ?? structured;
  const candidates = [payload.map, payload.rehydration_map, payload];
  for (const candidate of candidates) {
    const map = asRecord(candidate);
    if (!map) continue;
    const entries = Object.entries(map).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    if (entries.length > 0) return Object.fromEntries(entries);
  }
  const content = Array.isArray(record.content) ? record.content : [];
  for (const block of content) {
    const text = asRecord(block)?.text;
    if (typeof text !== 'string') continue;
    try {
      const parsed = JSON.parse(text) as unknown;
      const map = asRecord(parsed) ?? asRecord(asRecord(parsed)?.result);
      if (!map) continue;
      const entries = Object.entries(map).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      );
      if (entries.length > 0) return Object.fromEntries(entries);
    } catch {
      continue;
    }
  }
  return {};
}

/**
 * `encrypt` defaults to the OS-guarded vault key, so a blob written through the
 * default path can only be reopened with that same key. Requiring the caller to
 * supply a passphrase made those blobs undecryptable from the renderer, which
 * has no access to the OS-protected secret. Decryption now mirrors encryption:
 * an explicit passphrase when one was used, the OS key otherwise.
 */
async function decrypt(docId: string, explicitPassphrase?: string): Promise<Record<string, string>> {
  const passphrase = explicitPassphrase || getOrCreateVaultPassphrase();
  if (!passphrase) throw new Error('[vault] No vault key available to decrypt a rehydration map');
  const blobPath = resolveVaultBlobPath(docId);
  let encryptedBlob: string;
  try {
    encryptedBlob = fs.readFileSync(blobPath, 'utf8').trim();
  } catch {
    throw new Error('[vault] No stored rehydration map for this document');
  }
  if (!encryptedBlob) throw new Error('[vault] Stored rehydration map is empty');
  const manager = new ToolManager();
  const raw = await manager.callTool('basemind', 'vault', {
    mode: 'decrypt',
    encrypted_blob: encryptedBlob,
    passphrase,
  });
  const map = extractRehydrationMap(raw);
  if (Object.keys(map).length === 0) {
    throw new Error('[vault] Decryption returned no entries; check the passphrase');
  }
  return map;
}

/** Extract the base64 encrypted blob from a basemind `vault` encrypt result. */
export function extractEncryptedBlob(result: unknown): string {
  const record = asRecord(result) ?? {};
  const structured = asRecord(record.structuredContent) ?? record;
  const payload = asRecord(structured.result) ?? structured;
  const candidates = [payload.encrypted_blob, payload.encryptedBlob, payload.blob, payload.data];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  const content = Array.isArray(record.content) ? record.content : [];
  for (const block of content) {
    const text = asRecord(block)?.text;
    if (typeof text !== 'string') continue;
    const trimmed = text.trim();
    if (trimmed.length > 0 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return trimmed;
    try {
      const blob = extractEncryptedBlob(JSON.parse(trimmed) as unknown);
      if (blob) return blob;
    } catch {
      continue;
    }
  }
  return '';
}

export interface VaultEncryptOptions {
  /** Explicit passphrase; defaults to the OS-guarded vault data-protection key. */
  passphrase?: string;
  /** Injectable ToolManager double for tests. */
  toolManager?: { callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<unknown> };
}

async function encrypt(
  map: Record<string, string>,
  options: VaultEncryptOptions = {},
): Promise<string> {
  const passphrase = options.passphrase ?? getOrCreateVaultPassphrase();
  if (!passphrase) throw new Error('[vault] Passphrase is required to encrypt a rehydration map');
  const manager = options.toolManager ?? new ToolManager();
  const raw = await manager.callTool('basemind', 'vault', {
    mode: 'encrypt',
    map,
    passphrase,
  });
  const blob = extractEncryptedBlob(raw);
  if (!blob) throw new Error('[vault] Encryption returned no blob');
  return blob;
}

/** Write an encrypted blob to `{userData}/vaults/{docId}.enc`; returns the path. */
export function persistEncryptedBlob(docId: string, blob: string, userDataDir = resolveUserDataDir()): string {
  if (!blob) throw new Error('[vault] Cannot persist an empty encrypted blob');
  const blobPath = resolveVaultBlobPath(docId, userDataDir);
  fs.mkdirSync(path.dirname(blobPath), { recursive: true });
  fs.writeFileSync(blobPath, blob, 'utf8');
  return blobPath;
}

export const vaultManager = { decrypt, encrypt, persistEncryptedBlob };
