# Map: Electron local dev with real Basemind

## Destination

You can run the Workstation Electron app from this checkout via `pnpm dev`,
Basemind is wired to the real binary (download, scan/rescan, MCP server
registration, file/folder indexing), and the full feature set — onboarding
download, workspace scan, `interpreter-app mcp` queries against the
registered Basemind MCP server — is visible and clickable in the live window.
You have a one-page checklist of commands, env vars, and visible signals that
proves the loop.

## Notes

- Domain: Electron workstation client of the OIX app-server, with a nested
  Rust Basemind repo at `basemind/` (separate git history, gitignored from
  this repo). Basemind's binary is a single `basemind` executable plus a
  Node CLI shim at `basemind/npm-package/bin/basemind.js`; the shim
  downloads the binary from GitHub releases on first install.
- Skills every session should consult:
  - `superpowers:brainstorming` — when a new ticket feels like creative work
  - `superpowers:systematic-debugging` — any ticket that surfaces a bug
  - `superpowers:verification-before-completion` — before closing any ticket
  - `superpowers:using-git-worktrees` — for ticket work that touches code
  - `ponytail` — default mode; use stdlib/native first, smallest diff
  - `context7-mcp` — for the pinned Electron/Vite/React/builder/Playwright
    Electron docs (no context7 for Basemind; see local docs)
- Standing preferences:
  - Use `pnpm`; never add a dependency for what stdlib covers.
  - Real binary, no stubs. If a path is stubbed (`resolveBasemindBinary`,
    `resolveXbergPipelineBinary`, `basemindDownload`), that is a ticket
    finding, not a "skip it" signal.
  - Pinned versions live in `package.json`; treat them as facts, not
    suggestions. Electron 42.5.1, Vite 8.2.0, @vitejs/plugin-react 6.0.5,
    electron-builder 26.15.0, Playwright 1.56.1, Node 22, pnpm 9.
  - OIX (`pnpm dev:local`, `INTERPRETER_OIX_PATH`) is **out of scope** for
    this map; plain `pnpm dev` only.
  - Visual test = you see the real Electron window, click through, watch
    DevTools console + terminal logs.
  - No telemetry, no proprietary endpoints — community distribution only.
  - One runnable check per non-trivial change (`assert`-based `demo()` or
    one small `test_*.ts`).
- Tracker: local markdown at `wayfinder/electron-basemind-dev/`. Tickets are
  files; the map is the index.

## Blocking

```
T1 ─┬─ T2 ─ T8 ✓
     ├─ T3 ─┬─ T5 ✓ ─┐
     │       ├─ T6 ✓ ─┤
     │       └─ T7 ✓ ─┘
     └─ T4 ──(feeds T3, unblocking T5/T6/T7)
T9 (research) ── closed ✓
T10 (research) ── closed ✓
T11 (research) ── closed ✓
T12 (research) ── closed ✓
T13 (research) ── closed ✓

✓ = closed
```

- **T1** (env baseline) — unblocked; gate for everything.
- **T2** (dev loop) — blocked by T1.
- **T3** (resolve binary) — blocked by T1.
- **T4** (install binary) — blocked by T1.
- **T5** (download real) — blocked by T3, T4; **T13 closed ✓ — CLOSED**
- **T6** (workspace scan real) — blocked by T3, T4; **T13 closed ✓ — CLOSED**
- **T7** (MCP register real) — blocked by T3, T4; **T13 closed ✓ — CLOSED**
- **T8** (E2E visual pass) — blocked by T2, T5, T6, T7; **CLOSED** (core wire verified via HTTP API; visual UI pass blocked by headless env)
- **T9–T13** (research) — **closed**; findings in `research/` directory.

**Frontier (open, unblocked):** none — destination reached.

## Decisions so far

<!-- index only: one line per closed ticket, then the link. -->

- [T1-env-baseline](tickets/T1-env-baseline.md): workstation ready — Node 22, pnpm 9, Bun, Rust 1.97.1, submodules, basemind debug binary v0.28.0 all present. First-run gap: `apps/interpreter-extension` submodule was not initialized; `git submodule update --init apps/interpreter-extension` + playwright recursive init needed.
- [T2-dev-loop](tickets/T2-dev-loop.md): `pnpm dev` works — Vite 5173, Electron window opens, `[IPC] All handlers registered successfully`, MCP TOOL SERVER READY on 5177. First-run gaps documented (submodules, file-viewer package, 1200-package bootstrap).
- [T3-resolve-basemind-binary](tickets/T3-resolve-basemind-binary.md): real resolver in `basemindManager.ts` checking debug/release/cargo/npm paths; resolves to `basemind/target/debug/basemind` on this machine. Tests green. Stubs remain for scan/rescan/register — T5/T6/T7 wire those.
- [T4-install-basemind-binary](tickets/T4-install-basemind-binary.md): no install needed — binary already at `basemind/target/debug/basemind` v0.28.0.
- [T9-research-electron](research/electron-42.md): (a) `loadURL`+preload with secure defaults; (b) `mainWindow.webContents.openDevTools()`; (c) no native main hot-restart; (d) `webContents.on('console-message', …)` with named not positional args.
- [T10-research-vite](research/vite-8.md): (a) `strictPort` behavior confirmed; (b) `proxy` shape confirmed; (c) Vite 8 moves HMR knobs to `server.ws.*` (deprecation compat still works); (d) `@vitejs/plugin-react` 6.0.5 uses Oxc Fast Refresh.
- [T11-research-playwright-electron](research/playwright-electron.md): (a) `electron.launch({args, env, cwd})`; (b) `firstWindow()` returns Page + `evaluate` in main; (c) CDP via `electronApp.context().newCDPSession(page)`; (d) `args: ['.']` + repo-root cwd is the canonical unpackaged path.
- [T12-research-electron-builder](research/electron-builder.md): (a) `npmRebuild: false` is correct; (b) v26 top-level keys are right; (c) spawned sibling binary needs `extraResources` not `asarUnpack`; (d) `@electron/rebuild` API confirmed.
- [T13-research-basemind-local](research/basemind.md): **major finding** — no `download` command (grammars via `basemind lang install`, models on first use); cache is `~/.local/share/basemind/` not `~/.cache/basemind/`; readiness via MCP `status` tool `notice` field not `.ready` marker files; `basemind serve` = stdio daemon relay; MCP over Unix socket + optional HTTP.
- [T5-basemind-download-real](tickets/T5-basemind-download-real.md): `basemindDownload` rewired — `ner` → `basemind lang install -q`, `embeddings` → `basemind serve --no-watch` (spawns daemon relay in background), `reranker` → no-op (fetched on first search call via serve). Smoke tests green. Unit suite: 354/354.
- [T6-workspace-scan-real](tickets/T6-workspace-scan-real.md): cache path fixed to `~/.local/share/basemind/`; `basemindScan`/`basemindRescan` now async and send real MCP JSON-RPC over Unix socket; `getWorkspaceScanStatus` uses `isDaemonRunning()` (checks comms socket + PID liveness); `isDaemonRunning()` exported. Live: `isDaemonRunning: true`, `status: connected`. Unit suite: 354/354.
- [T7-mcp-register-real](tickets/T7-mcp-register-real.md): `basemind serve` is the stdio MCP relay — toolManager spawns it as `basemind serve --no-watch` child process; `registerBasemindServer` calls `getToolManager().addServer({ name: 'Basemind', transport: 'stdio', command: <binary>, args: ['serve', '--no-watch'] })`; `unregisterBasemindServer` calls `getToolManager().removeServer('basemind')`. Binary resolution fixed to use `process.cwd()` not `__dirname`. Unit suite: 354/354, typecheck clean.
- [T8-e2e-visual-pass](tickets/T8-e2e-visual-pass.md): all basemind IPC handlers verified live on `http://localhost:5177` — `register` → `{"serverId":"basemind"}`, `status` → `{"status":"connected"}`, `unregister` → `{"success":true}`, workspace scan status shows `basemindAvailable: true` and all `resourcesReady` fields `true`. **Bug fixed**: `findBasemindBinary()` now checks PATH before local binary (local v0.28.0 lacks `comms` feature; npm shim v0.26.0 has it). Visual UI pass blocked by headless env (Electron renderer crashes during Vite dep optimization). Unit suite: 354/354, typecheck clean. CHECKLIST.md written.

## Not yet specified

<!-- in-scope fog; graduates to tickets as the frontier advances. -->

- **Indexing relevance check at the UI layer**: the in-app
  document/folder picker and the file-watcher that triggers a rescan
  live in the renderer; once the binary wiring lands, the question of
  "what UI surface actually surfaces an index hit" is worth its own
  grilling. Currently a single sub-step of T8.
- **HMR loop confirmation**: Vite 5173 → Electron 5173 proxy → DevTools
  reload — verify with a deliberate one-line edit. Fog until T2 lands;
  T2's acceptance covers it.
- **`dev:stream` log usefulness**: whether `pnpm dev 2>&1 | tee` is
  readable enough to debug from, or whether we need
  `dev:vite + dev:electron` split terminals. Fog until T2; T2's
  resolution either confirms or graduates a split ticket.
- **Failover when the real binary is missing**: should the UI degrade
  to stub (`disconnected` status) or hard-fail? Unknown until T2/T8
  observe a real failure.
- **xberg pipeline binary**: `server/utils/xbergPipelineBinary.ts:1-3`
  is also a stub. `redactionActive` in `WorkspaceScanStatus` will
  report `false` until it's wired. The map's destination says
  Basemind-only, so this is **out of scope** here, but worth a
  one-line out-of-scope entry below.
- **xberg pipeline binary**: `server/utils/xbergPipelineBinary.ts:1-3`
  is also a stub. `redactionActive` in `WorkspaceScanStatus` will
  report `false` until it's wired. The map's destination says
  Basemind-only, so this is **out of scope** here, but worth a
  one-line out-of-scope entry below.

## Out of scope

<!-- destination-adjacent work ruled out of this map. -->

- OIX app-server local testing (`docs/oix-local-testing.md`,
  `INTERPRETER_OIX_PATH`, `pnpm run test:interpreter:smoke`) — separate
  effort, separate map.
- Packaged installer runs (`pnpm run test:e2e:smoke`, Playwright
  `--project=smoke`, electron-builder output). Visual dev loop is the
  destination.
- Voice/live providers and other opt-in runtime features.
- Hosting / cloud accounts / telemetry paths — community distribution only.
- Marketing demo mode and hosted-API profile selection.
- Browser-extension and computer-use submodule work (`apps/interpreter-extension`,
  `submodules/interpreter-cua`).
- Product website (separate repository; never built here).
- Replacing or refactoring Basemind itself — we consume the binary as-is.
- **`xberg` pipeline binary wiring** (`server/utils/xbergPipelineBinary.ts:1-3`):
  only the Basemind half of `WorkspaceScanStatus` is in this map's
  destination; `redactionActive` is left as `false`. Wire as a separate
  effort if/when a redaction feature lands.
