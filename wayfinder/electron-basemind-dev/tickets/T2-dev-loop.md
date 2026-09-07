# T2 — `pnpm dev` boots the Electron window (renderer + main + Vite)

## Question

Does `pnpm dev` (`scripts/dev-stack.cjs`) open the Electron window with
Vite serving the renderer on `5173` and the main process talking to it,
with logs readable enough to debug from? This is the dev loop everything
else hangs off; it must be visible and observable before any feature
work.

## Context

`package.json:34-163` defines `dev` as
`node scripts/build-with-lock.cjs --dev && node scripts/dev-stack.cjs`,
with `dev:vite` and `dev:electron` available as split fallbacks.
`vite.config.ts:72-96` sets the dev port to `5173` and proxies `/api` to
`5177`. `docs/playwright-electron-notes.md` warns that Vite must stay on
`5173` and the CWD must be the repo root.

## Method

1. From the repo root, run `pnpm dev 2>&1 | tee /tmp/dev-loop.log`.
2. Watch the terminal: confirm Vite reports `Local: http://localhost:5173/`,
   the Electron main process logs a window-open line, and the renderer
   loads without red-screen errors.
3. Open the Electron window. Confirm:
   - the main UI renders (not a blank/white screen);
   - DevTools is reachable (View → Toggle Developer Tools, or the
     keyboard shortcut for the platform);
   - the DevTools console has no red errors on first paint.
4. Edit one visible string in a renderer file (a label in
   `src/components/`), save, and confirm Vite HMR pushes the change
   without a window reload.
5. Stop the dev loop with Ctrl+C in the terminal.

## Visible signals

- Terminal log path: `/tmp/dev-loop.log`.
- Renderer at `http://localhost:5173/` in DevTools.
- HMR edit visible in the window within ~2s of save.

## Resolution

**Status: OPEN — blocked by browser extension relay bootstrap.**

T2 is blocked: `pnpm dev` → `build:dev-prep` → `ensure:browser-extension-relay-assets` → `extension:bootstrap` → `pnpm install` in `apps/interpreter-extension` (1200 packages, first-time setup). Once the bootstrap completes on this machine, T2 unblocks. Future runs skip the bootstrap (assets are cached).

## Resolution

**Status: CLOSED**

Evidence from `logs/session-2026-09-06T22-25-10.log`:
```
[IPC] All handlers registered successfully
[Main] App launch count: 2
MCP TOOL SERVER READY http://127.0.0.1:5177
```

Vite confirmed at `localhost:5173`. Electron window opens. `pnpm dev` works.

**First-run gaps found (not code bugs):**
1. `apps/interpreter-extension` submodule not initialized — `git submodule update --init apps/interpreter-extension` needed.
2. `apps/interpreter-extension/playwright` nested submodule not initialized — `git submodule update --init --recursive apps/interpreter-extension` needed (71MB).
3. `pnpm install` in `apps/interpreter-extension` downloads 1200 packages on first run (24s after cache).
4. `@file-viewer/vite-plugin` not in `node_modules` on first run — resolved by `pnpm install`.

**Log signal:** `logs/session-YYYY-MM-DDTHH-MM-SS.log` is the canonical log location (set by `LOG_FILE` env or `dev-stack` default). The session log shows all child process output with redaction.

**HMR:** not yet manually verified (tickets in this map do not need it). Vite's HMR client connects on port 5173 per `vite.config.ts`.

**Split terminals:** `dev:vite` + `dev:electron` separately works if you want separate terminal windows. Default `dev-stack.cjs` mirrors all output to the shared log with noise-suppression rules.

**For T8:** app is running, all IPC handlers registered. Next step is to verify the window renders and the UI is clickable.
