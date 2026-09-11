/**
 * Vault data-protection key — one random 32-byte key per app-data directory,
 * guarded by the OS credential store via Electron safeStorage.
 *
 * The key file under `{userData}/vaults/` only ever holds OS-encrypted bytes,
 * never plaintext. Where the OS store is unavailable, every entry point throws
 * a clear degraded error instead of silently skipping persistence.
 */

import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { resolveUserDataDir } from './vault';

export interface OsSecureStore {
  isEncryptionAvailable(): boolean;
  encryptString(plaintext: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

let osSecureStoreForTests: OsSecureStore | null | undefined;

export function __setOsSecureStoreForTests(store: OsSecureStore | null): void {
  osSecureStoreForTests = store;
}

export function __resetOsSecureStoreForTests(): void {
  osSecureStoreForTests = undefined;
}

/** Lazily resolve Electron safeStorage; null when the OS store is unavailable. */
export function getOsSecureStore(): OsSecureStore | null {
  if (osSecureStoreForTests !== undefined) return osSecureStoreForTests;
  if (!process.versions.electron) return null;
  // Lazy load electron so browser mode can still typecheck.
  const electron = require('electron') as { safeStorage?: OsSecureStore };
  const store = electron.safeStorage;
  if (!store || typeof store.isEncryptionAvailable !== 'function') return null;
  if (!store.isEncryptionAvailable()) return null;
  return store;
}

export const VAULT_DEGRADED_MESSAGE =
  '[vault] OS credential store is unavailable, so vault persistence is disabled. ' +
  'Nothing was stored or recovered with the vault key; ' +
  'restart with the OS keychain available to enable encrypted persistence.';

export function resolveVaultKeyPath(userDataDir = resolveUserDataDir()): string {
  return path.join(userDataDir, 'vaults', '.vault-key.enc');
}

function requireOsSecureStore(override?: OsSecureStore | null): OsSecureStore {
  const store = override !== undefined ? override : getOsSecureStore();
  if (!store) throw new Error(VAULT_DEGRADED_MESSAGE);
  return store;
}

export function getOrCreateVaultPassphrase(overrides?: {
  osStore?: OsSecureStore | null;
  userDataDir?: string;
}): string {
  const store = requireOsSecureStore(overrides?.osStore);
  const keyPath = resolveVaultKeyPath(overrides?.userDataDir ?? resolveUserDataDir());
  let stored: Buffer | null = null;
  try {
    stored = fs.readFileSync(keyPath);
  } catch {
    stored = null;
  }
  if (stored && stored.length > 0) {
    try {
      return store.decryptString(stored);
    } catch {
      throw new Error(
        '[vault] Stored vault key cannot be unlocked with the OS credential store; ' +
          'it may belong to another user or machine.',
      );
    }
  }
  const passphrase = randomBytes(32).toString('base64');
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  // ponytail: 0600 narrows file access; secrecy itself comes from OS encryption, not the mode bit.
  fs.writeFileSync(keyPath, store.encryptString(passphrase), { mode: 0o600 });
  return passphrase;
}
