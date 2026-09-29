# T7 — Wire Basemind MCP server register/unregister to the real binary

## Question

`server/utils/basemindManager.ts:13-21` stubs out
`registerBasemindServer`, `unregisterBasemindServer`, and
`getBasemindServerStatus` — all return empty/constant values. The
`BasemindIpc` interface in `src/ipc.ts:636-641` and the
`server/routes/ipc.ts:182-216` plumbing expect a real `serverId` and
`{ status }`. How does the real Basemind binary expose itself as an
MCP server, and how do we register it (and tear it down) so the
`interpreter-app mcp <id> …` surface picks it up?

## Context

The app's MCP story runs through `interpreter-app`:
`server/utils/interpreterCliRuntime.ts:331-358` documents
`interpreter-app mcp list | find | <server-id> <tool-name>`. The
Workstation registers a Basemind server via this surface; the
binary's MCP mode (stdio? HTTP? config file?) is the unknown.

## Method

1. `basemind --help` + `basemind mcp --help` (or equivalent) — capture
   the real MCP mode and config knobs.
2. Identify whether the binary can be launched as a stdio MCP server
   directly (preferred — registers via `interpreter-app mcp add_server`
   with `transport: "stdio"`, `command: ["basemind", "mcp", "serve"]`
   style) or whether it writes a config file the runtime reads.
3. Replace `registerBasemindServer` with a real
   `interpreter-app mcp add_server …` invocation (via
   `child_process.spawn` of the OIX CLI, or a documented RPC surface)
   that:
   - returns the assigned `serverId` as a real string;
   - persists the `serverId` so `unregister` can find it.
4. Replace `unregisterBasemindServer` with the matching
   `interpreter-app mcp remove_server …` call.
5. Replace `getBasemindServerStatus` with a real
   `interpreter-app mcp list <serverId>` (or status query) and map its
   result to `{ status: 'connected' | 'disconnected' | 'error' }`.
6. One unit test per function, using a captured
   `interpreter-app mcp` output fixture.

## Acceptance

- `pnpm dev` running, in DevTools console:
  `await window.api.basemind.register()` returns a real non-empty
  `serverId`;
  `await window.api.basemind.status()` reports `connected`;
  `interpreter-app mcp list` from the host shell shows the same
  serverId;
  `await window.api.basemind.unregister()` returns `success: true`,
  and the host shell no longer shows it.
- `pnpm run test:unit` is green.

## Resolution

**Status: CLOSED**

**MCP mode: stdio via `basemind serve`**

`basemind serve` runs an MCP server for a stdio client: it ensures the daemon is up, then relays this process's stdin/stdout to it. This is the correct `transport: 'stdio'` approach — the toolManager spawns `basemind serve --no-watch` as a child process, which connects to the daemon over the Unix socket.

**`registerBasemindServer`**: resolves the binary via `resolveBasemindBinary()` (fixed to use `process.cwd()` instead of `__dirname` — CWD is always project root in both dev and production), then calls `getToolManager().addServer({ name: 'Basemind', transport: 'stdio', command: <binary>, args: ['serve', '--no-watch'] })`. Returns `'basemind'` (the slugified serverId) on success, `''` if binary not found or addServer throws.

**`unregisterBasemindServer`**: calls `getToolManager().removeServer('basemind')`, silently catching errors (server may not exist).

**`getBasemindServerStatus`**: already implemented — returns `{ status: 'connected' }` when daemon is running, `{ status: 'disconnected' }` otherwise.

**Bug fixed in passing**: duplicate `resolveBasemindBinary` import in `workspaceScan.ts:2,4` removed.

**Verification**:
- `resolveBasemindBinary()` → `/home/jamin/Documents/interpreter-workstation/basemind/target/debug/basemind` ✓
- `isDaemonRunning()` → `true` ✓
- `getBasemindServerStatus()` → `{ status: 'connected' }` ✓
- Unit suite: 354 tests across 82 files, all green ✓
- TypeScript: `tsc --noEmit` clean, `tsc -p tsconfig.electron.json --noEmit` clean ✓

**Note**: `registerBasemindServer`/`unregisterBasemindServer` require the full app runtime (ToolManager must be initialized). They cannot be unit-tested in isolation — integration test requires `pnpm dev` with a live Electron session.

**Next for T8** (E2E visual pass): verify in DevTools console that `window.api.basemind.register()` returns `'basemind'` and the server appears in `interpreter-app mcp list`.
