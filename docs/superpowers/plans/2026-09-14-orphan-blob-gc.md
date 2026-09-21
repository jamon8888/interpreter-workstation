# Orphan Blob GC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up orphaned vault `.enc` files — both eagerly (in `trashThread`) and lazily (at first vault access per session).

**Architecture:** Two-pronged cleanup: (1) delete the blob file inside `trashThread()` so newly trashed threads don't accumulate orphans, (2) scan the vault directory at first vault access of each session and delete `.enc` files whose thread ID has no living thread. One-shot per session via module-level flag. Toast notification when orphans are cleaned.

**Tech Stack:** TypeScript, bun:test, Node.js fs, existing vault infrastructure

**Spec:** `#168` — Orphan blob GC

## Context: The Orphan Problem

Only thread blobs exist (`thread-{threadKey}.enc` in `{userData}/vaults/`). `trashThread()` deletes the in-memory rehydration map and tombstones the key, but never removes the `.enc` file from disk. Over time, orphaned blobs accumulate.

## Global Constraints

- Thread blob pattern: `thread-{threadKey}.enc` (via `threadVaultDocId()` in `src/lib/pii/vaultScope.ts`)
- Vault directory: `{userData}/vaults/` (via `resolveVaultBlobPath()`)
- Valid doc ID regex: `/^[A-Za-z0-9_-]{1,128}$/` (via `sanitizeVaultDocId()`)
- Tests use `bun:test` with `mkdtempSync` temp dirs and `process.env.INTERPRETER_USER_DATA_DIR`
- `tsc --noEmit` must pass; unit tests must be green

---

### Task 1: Add `deleteVaultBlob` and `listVaultBlobDocIds` to vault.ts

**Files:**
- Modify: `server/services/vault.ts`
- Test: `server/services/vault.test.ts`

**Interfaces:**
- Consumes: `resolveVaultBlobPath(docId, userDataDir?)`, `sanitizeVaultDocId(docId)`
- Produces: `deleteVaultBlob(docId, userDataDir?)`, `listVaultBlobDocIds(userDataDir?)`

- [ ] **Step 1: Write failing tests**

```ts
describe('deleteVaultBlob', () => {
  test('removes the .enc file for a valid doc id', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vault-gc-'));
    const blobPath = join(dir, 'vaults', 'thread-abc.enc');
    mkdirSync(join(dir, 'vaults'), { recursive: true });
    writeFileSync(blobPath, 'encrypted');
    deleteVaultBlob('thread-abc', dir);
    expect(existsSync(blobPath)).toBe(false);
    rmSync(dir, { recursive: true });
  });

  test('is a no-op when the blob does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vault-gc-'));
    mkdirSync(join(dir, 'vaults'), { recursive: true });
    expect(() => deleteVaultBlob('thread-nonexistent', dir)).not.toThrow();
    rmSync(dir, { recursive: true });
  });

  test('rejects invalid doc ids', () => {
    expect(() => deleteVaultBlob('../escape', '/tmp')).toThrow();
  });
});

describe('listVaultBlobDocIds', () => {
  test('returns doc ids from .enc files in the vaults directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vault-gc-'));
    const vaultsDir = join(dir, 'vaults');
    mkdirSync(vaultsDir, { recursive: true });
    writeFileSync(join(vaultsDir, 'thread-aaa.enc'), 'a');
    writeFileSync(join(vaultsDir, 'thread-bbb.enc'), 'b');
    writeFileSync(join(vaultsDir, '.vault-key.enc'), 'k');
    writeFileSync(join(vaultsDir, 'not-a-blob.txt'), 'x');
    const ids = listVaultBlobDocIds(dir);
    expect(ids.sort()).toEqual(['thread-aaa', 'thread-bbb']);
    rmSync(dir, { recursive: true });
  });

  test('returns empty array when vaults directory does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vault-gc-'));
    expect(listVaultBlobDocIds(dir)).toEqual([]);
    rmSync(dir, { recursive: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test server/services/vault.test.ts`
Expected: FAIL — `deleteVaultBlob` and `listVaultBlobDocIds` not defined

- [ ] **Step 3: Implement the functions**

In `server/services/vault.ts`, add:

```ts
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

export function deleteVaultBlob(docId: string, userDataDir?: string): void {
  const safeId = sanitizeVaultDocId(docId);
  const blobPath = resolveVaultBlobPath(safeId, userDataDir);
  if (existsSync(blobPath)) {
    rmSync(blobPath);
  }
}

export function listVaultBlobDocIds(userDataDir?: string): string[] {
  const vaultsDir = resolveVaultBlobPath('', userDataDir).replace(/\/[^/]*$/, '');
  if (!existsSync(vaultsDir)) return [];
  return readdirSync(vaultsDir)
    .filter((f) => f.endsWith('.enc') && f !== '.vault-key.enc')
    .map((f) => f.slice(0, -4)); // strip .enc
}
```

Note: `resolveVaultBlobPath('docId', dir)` returns `{dir}/vaults/docId.enc`. To get the vaults directory, strip the filename from an empty-docId path. Alternatively, compute `join(resolveUserDataDir(userDataDir), 'vaults')`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test server/services/vault.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/vault.ts server/services/vault.test.ts
git commit -s -m "feat(vault): add deleteVaultBlob and listVaultBlobDocIds helpers"
```

---

### Task 2: Delete blob in `trashThread()`

**Files:**
- Modify: `server/handlers/agentThreads.ts`
- Modify: `server/handlers/agent.delete-all.test.ts` (or relevant test file)

**Interfaces:**
- Consumes: `deleteVaultBlob(threadVaultDocId(threadId))` from Task 1
- Produces: modified `trashThread()` that deletes the blob after in-memory cleanup

- [ ] **Step 1: Write failing test**

In the existing `trashThread` tests, add a case that verifies the blob file is deleted:

```ts
test('trashThread deletes the vault blob file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trash-blob-'));
  process.env.INTERPRETER_USER_DATA_DIR = dir;
  const vaultsDir = join(dir, 'vaults');
  mkdirSync(vaultsDir, { recursive: true });
  const blobPath = join(vaultsDir, 'thread-test123.enc');
  writeFileSync(blobPath, 'encrypted');

  // ... set up mock service with archiveThread, readThread, etc.
  await trashThread('test123', { service: mockService, trashFileImpl: mockTrash });

  expect(existsSync(blobPath)).toBe(false);
  delete process.env.INTERPRETER_USER_DATA_DIR;
  rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/handlers/agent.delete-all.test.ts` (or whichever file has trashThread tests)
Expected: FAIL — blob file still exists

- [ ] **Step 3: Implement the change**

In `trashThread()`, after `deleteRuntimeRehydrationMap(threadId)`, add:

```ts
import { deleteVaultBlob } from '../services/vault';
import { threadVaultDocId } from '../../src/lib/pii/vaultScope';

// After deleteRuntimeRehydrationMap(threadId):
deleteVaultBlob(threadVaultDocId(threadId));
```

This runs in two places: line 78 (no path) and line 87 (successful trash). Both should delete the blob.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test server/handlers/agent.delete-all.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/handlers/agentThreads.ts server/handlers/agent.delete-all.test.ts
git commit -s -m "feat(threads): delete vault blob on thread trash"
```

---

### Task 3: Add lazy orphan GC at first vault access

**Files:**
- Create: `server/services/vaultGc.ts`
- Create: `server/services/vaultGc.test.ts`
- Modify: `server/services/vault.ts` (hook the GC)

**Interfaces:**
- Consumes: `listVaultBlobDocIds()`, `deleteVaultBlob()` from Task 1; `listAllThreadIds()` from agentThreads; `broadcastEvent()` from broadcast
- Produces: `runOrphanBlobGcOnce(options?)` — returns `{ cleaned: number }`

- [ ] **Step 1: Write failing tests**

```ts
// server/services/vaultGc.test.ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOrphanBlobGcOnce, resetGcFlagForTests } from './vaultGc';

describe('runOrphanBlobGcOnce', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gc-'));
    process.env.INTERPRETER_USER_DATA_DIR = dir;
    // Reset the GC flag so each test starts fresh.
    // Import and call the reset function from vaultGc if exported,
    // or directly set gcRanThisSession to false via a test-only export.
    resetGcFlagForTests();
  });

  afterEach(() => {
    delete process.env.INTERPRETER_USER_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  test('deletes blob files whose thread ID is not in the active list', () => {
    const vaultsDir = join(dir, 'vaults');
    mkdirSync(vaultsDir, { recursive: true });
    writeFileSync(join(vaultsDir, 'thread-orphan.enc'), 'orphan');
    writeFileSync(join(vaultsDir, 'thread-active.enc'), 'active');

    const result = runOrphanBlobGcOnce({
      activeThreadIds: ['active'],
      userDataDir: dir,
    });

    expect(result.cleaned).toBe(1);
    expect(existsSync(join(vaultsDir, 'thread-orphan.enc'))).toBe(false);
    expect(existsSync(join(vaultsDir, 'thread-active.enc'))).toBe(true);
  });

  test('returns cleaned: 0 when no orphans exist', () => {
    const vaultsDir = join(dir, 'vaults');
    mkdirSync(vaultsDir, { recursive: true });
    writeFileSync(join(vaultsDir, 'thread-active.enc'), 'active');

    const result = runOrphanBlobGcOnce({
      activeThreadIds: ['active'],
      userDataDir: dir,
    });

    expect(result.cleaned).toBe(0);
  });

  test('only runs once per session (module-level flag)', () => {
    const vaultsDir = join(dir, 'vaults');
    mkdirSync(vaultsDir, { recursive: true });
    writeFileSync(join(vaultsDir, 'thread-orphan.enc'), 'orphan');

    const first = runOrphanBlobGcOnce({ activeThreadIds: [], userDataDir: dir });
    expect(first.cleaned).toBe(1);

    // Recreate the file — second call should be a no-op
    writeFileSync(join(vaultsDir, 'thread-orphan2.enc'), 'orphan2');
    const second = runOrphanBlobGcOnce({ activeThreadIds: [], userDataDir: dir });
    expect(second.cleaned).toBe(0);
  });

  test('never deletes .vault-key.enc', () => {
    const vaultsDir = join(dir, 'vaults');
    mkdirSync(vaultsDir, { recursive: true });
    writeFileSync(join(vaultsDir, '.vault-key.enc'), 'key');

    const result = runOrphanBlobGcOnce({ activeThreadIds: [], userDataDir: dir });
    expect(result.cleaned).toBe(0);
    expect(existsSync(join(vaultsDir, '.vault-key.enc'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test server/services/vaultGc.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the GC module**

```ts
// server/services/vaultGc.ts
import { listVaultBlobDocIds, deleteVaultBlob } from './vault';

let gcRanThisSession = false;

export function resetGcFlagForTests(): void {
  gcRanThisSession = false;
}

export function runOrphanBlobGcOnce(options: {
  activeThreadIds: string[];
  userDataDir?: string;
}): { cleaned: number } {
  if (gcRanThisSession) return { cleaned: 0 };
  gcRanThisSession = true;

  const { activeThreadIds, userDataDir } = options;
  const activeSet = new Set(activeThreadIds);
  const allDocIds = listVaultBlobDocIds(userDataDir);

  let cleaned = 0;
  for (const docId of allDocIds) {
    // Only clean thread blobs
    if (!docId.startsWith('thread-')) continue;
    const threadId = docId.slice('thread-'.length);
    if (!activeSet.has(threadId)) {
      deleteVaultBlob(docId, userDataDir);
      cleaned++;
    }
  }

  return { cleaned };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test server/services/vaultGc.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/vaultGc.ts server/services/vaultGc.test.ts
git commit -s -m "feat(vault): add lazy orphan blob GC"
```

---

### Task 4: Hook GC into vault access and broadcast toast

**Files:**
- Modify: `server/services/vault.ts` (call GC on first decrypt/persist)
- Modify: `server/handlers/broadcast.ts` (no change needed — just import)

**Interfaces:**
- Consumes: `runOrphanBlobGcOnce()` from Task 3; `broadcastEvent()` from broadcast
- Produces: GC runs automatically on first vault access; toast broadcast when orphans cleaned

- [ ] **Step 1: Add GC hook to vaultManager**

In `server/services/vault.ts`, import and call the GC lazily:

```ts
import { runOrphanBlobGcOnce, resetGcFlagForTests } from './vaultGc';
import { broadcastEvent } from '../handlers/broadcast';
import { listAllThreadIds } from '../handlers/agentThreads';

let gcTriggered = false;

async function triggerOrphanGcIfFirstAccess(): Promise<void> {
  if (gcTriggered) return;
  gcTriggered = true;
  try {
    const { listThreads } = await import('../handlers/codex-generated-types/index');
    // Use the codex service to list active threads
    const { getCodexService } = await import('../../src/lib/codex/service');
    const service = getCodexService();
    const threadIds = await listAllThreadIds(service, { limit: 1000 });
    const { cleaned } = runOrphanBlobGcOnce({ activeThreadIds: threadIds });
    if (cleaned > 0) {
      broadcastEvent('vault:orphan-blobs-cleaned', { count: cleaned });
    }
  } catch {
    // GC failure is non-fatal; swallow silently
  }
}
```

Then call `triggerOrphanGcIfFirstAccess()` at the start of `vaultManager.decrypt()` and `vaultManager.persistEncryptedBlob()`.

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add server/services/vault.ts
git commit -s -m "feat(vault): trigger orphan GC on first vault access"
```

---

### Task 5: Add renderer-side toast for orphan cleanup

**Files:**
- Modify: `src/ipc.ts` (add listener for `vault:orphan-blobs-cleaned`)
- Modify: relevant toast hook or component

**Interfaces:**
- Consumes: SSE event `vault:orphan-blobs-cleaned` with `{ count: number }`
- Produces: toast `N orphan blobs cleaned`

- [ ] **Step 1: Add event listener**

In `src/ipc.ts` or the appropriate SSE listener setup, add:

```ts
// Listen for vault orphan GC events
ipcRenderer.on('vault:orphan-blobs-cleaned', (_event, data) => {
  if (data.count > 0) {
    showToast(`${data.count} orphan blob${data.count === 1 ? '' : 's'} cleaned`, 'info');
  }
});
```

Or via SSE pattern if the app uses that path.

- [ ] **Step 2: Verify no regressions**

Run: `pnpm typecheck && pnpm run test:unit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/ipc.ts
git commit -s -m "feat(ui): show toast when orphan vault blobs are cleaned"
```

---

### Task 6: Wire `deleteAllThreads` blob cleanup

**Files:**
- Modify: `server/handlers/agentThreads.ts`

**Interfaces:**
- Consumes: `deleteVaultBlob()` from Task 1
- Produces: `deleteAllThreads()` also deletes vault blobs

- [ ] **Step 1: Verify `deleteAllThreads` path**

`deleteAllThreads()` calls `trashThread()` for each thread (line 152-154). Since `trashThread()` now deletes blobs (Task 2), `deleteAllThreads` is already covered. No code change needed.

- [ ] **Step 2: Add test coverage**

Verify in the test file that `deleteAllThreads` results in blob deletion.

- [ ] **Step 3: Commit (if test added)**

```bash
git add server/handlers/agent.delete-all.test.ts
git commit -s -m "test(threads): verify deleteAllThreads cleans vault blobs"
```

---

## Verification

After all tasks:

```bash
pnpm typecheck
bun test server/services/vault.test.ts
bun test server/services/vaultGc.test.ts
bun test server/handlers/agent.delete-all.test.ts
```

All must pass. Then run the full test suite:

```bash
bun test
```
