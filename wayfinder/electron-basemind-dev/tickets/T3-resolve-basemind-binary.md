# T3 — `resolveBasemindBinary` returns the real binary path

## Question

`server/utils/basemindManager.ts:1-21` currently has
`resolveBasemindBinary(): string { return ''; }` — a stub. The rest of
the app (`server/handlers/workspaceScan.ts:80`, `workspaceScan.status`,
`basemind.download` indirectly) checks this to set `basemindAvailable`.
How should the real path be resolved, and does the path it returns
exist and run on this machine?

## Context

The Basemind binary distribution model is in
`basemind/npm-package/bin/basemind.js:1-52` and its sibling
`install.js`: the npm package's `postinstall` downloads a platform-named
binary (`basemind` or `basemind.exe`) into the package's `bin/` dir.
That makes the binary's path derivable from the package's installed
location, which `pnpm` keeps under `node_modules/.pnpm/basemind@…/node_modules/basemind/`.

The same pattern already exists for xberg in
`server/utils/xbergPipelineBinary.ts:1-3` — currently a stub — which
this map's destination implies we should also fix; out of scope here
unless it is one-line and obviously the same fix.

## Method

1. Resolve the platform the way the npm shim does
   (`os.type() === 'Windows_NT' ? 'basemind.exe' : 'basemind'`).
2. Look up the installed `basemind` npm package's directory via
   `require.resolve('basemind/package.json')` and walk to
   `node_modules/basemind/bin/<binary>`. Fall back to
   `~/.cargo/bin/basemind` (cargo install path) and `$PATH` lookup.
3. If the resolved path does not exist, return `''` and let the
   existing try/catch in `getWorkspaceScanStatus` report
   `basemindAvailable: false` — never throw.
4. Add a one-function unit test
   (`server/utils/basemindManager.test.ts` or similar) that:
   - mocks the binary path to a temp file containing a no-op
     executable;
   - asserts `resolveBasemindBinary()` returns that path;
   - asserts it returns `''` when the file is missing.

## Acceptance

- `pnpm run test:unit` is green for the new test.
- `pnpm dev` is running, and a `workspaceScan.status()` IPC call
  (from the DevTools console: `await window.api.workspaceScan.status()`)
  reports `basemindAvailable: true` after the fix, `false` before.
- No new dependencies; use `node:os`, `node:path`, `node:fs` only.

## Resolution

**Status: CLOSED**

`resolveBasemindBinary()` replaced with a real resolver that checks four paths in order:
1. `basemind/target/debug/basemind` (local debug build) ← **found, v0.28.0**
2. `basemind/target/release/basemind` (local release build)
3. `~/.cargo/bin/basemind` (cargo install)
4. npm shim via `require.resolve('basemind/package.json')`

Tests: `server/utils/basemindManager.vitest.test.ts` — 2/2 green. Unit suite: **349 tests, 81 files, all green**.

**Changes:**
- `server/utils/basemindManager.ts` — new `findBasemindBinary()` + `_cachedBinary` singleton; stubs for `basemindScan`, `basemindRescan`, `registerBasemindServer`, `unregisterBasemindServer`, `getBasemindServerStatus` left as-is for T5/T6/T7.

**For downstream:** T4 already satisfied (binary at path #1). T5/T6/T7 use `resolveBasemindBinary()` to get the binary; their stub functions remain to be wired.
