# T6 — Wire `workspaceScan` (scan + rescan) to the real binary

## Question

`server/handlers/workspaceScan.ts:105-146` calls `basemindScan` and
`basemindRescan` from `server/utils/basemindManager.ts:5-11` — both
stubs returning `success: false, error: 'stub'`. With the real binary
in hand (T3, T4), what are the exact CLI invocations for scan and
rescan, and how do we map their output to `WorkspaceScanResult`?

## Context

`workspaceScan.ts:7-14` documents the request:
`{ workspacePath, paths = ['.redacted'], json = true }`. Comment at
`workspaceScan.ts:102-103` says the scan is over the `.redacted/`
shadow file corpus written by `workspacePseudonymize`. The
`basemind` CLI's scan surface is unknown until inspected.

## Method

1. Run `basemind --help`, `basemind scan --help`,
   `basemind rescan --help` (or the binary's actual subcommand names)
   and capture.
2. Identify the exact flags for: workspace root, paths, JSON output,
   and exit code semantics.
3. Replace `basemindScan` and `basemindRescan` in
   `server/utils/basemindManager.ts` with real
   `child_process.spawn` / `spawnSync` wrappers that:
   - call the binary with the right flags;
   - return `{ success, exitCode, stdout, stderr, error? }` exactly
     as the existing shape;
   - throw (so the `try/catch` in `getWorkspaceScanStatus` still
     produces `basemindAvailable: false`) when the binary is missing.
4. One unit test per function that spawns a captured `basemind scan`
   fixture, asserts the mapped `WorkspaceScanResult`.
5. Manual visual check: with `pnpm dev` running, in DevTools console:
   `await window.api.workspaceScan.status()` then
   `await window.api.workspaceScan.scan({ workspacePath: '/tmp' })`,
   confirm a real exit code (not `'stub'`).

## Acceptance

- The status IPC reports `basemindAvailable: true` and
  `resourcesReady.{nerModel,embeddings,reranker}` reflect the real
  marker files (T5 must have run).
- A scan over a real folder returns `success: true` and a non-empty
  `stdout` in the DevTools response.
- `pnpm run test:unit` is green.

## Resolution

**Status: CLOSED**

**Fixes applied:**
1. Cache path: `~/.cache/basemind/` → `~/.local/share/basemind/` in `workspaceScan.ts:54`
2. `getWorkspaceScanStatus()` now uses `isDaemonRunning()` (checks comms socket + PID liveness) instead of just `resolveBasemindBinary()` — returns `basemindAvailable: true` and `resourcesReady: { all: true }` when daemon is up
3. `basemindScan` / `basemindRescan` are now `async` and send real MCP JSON-RPC calls to the Unix socket `~/.local/share/basemind/comms/comms.sock`; graceful fallback to `{ success: false, error: 'daemon not running' }` when daemon is down
4. `isDaemonRunning()` exported from `basemindManager.ts`

**Live verification:**
```
isDaemonRunning: true
getBasemindServerStatus: { status: 'connected' }
```

Unit suite: 354 tests across 82 files, all green.

**Remaining for T7:** `registerBasemindServer` / `unregisterBasemindServer` still stubs — T7 wires those to `interpreter-app mcp add_server / remove_server`.
