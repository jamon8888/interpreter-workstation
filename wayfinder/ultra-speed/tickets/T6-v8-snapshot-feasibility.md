Type: research
Status: resolved
Blocked by: T1
Resolved: 2026-09-11
Verdict: not recommended

# T6: V8 Startup Snapshot Feasibility

## Question

Is a V8 startup snapshot for the main process worth implementing in this codebase?

## Answer: Not Recommended

### Why

1. **Built-in snapshot already active.** Electron 42.3.3+ (we're on 42.5.1) automatically includes a Node.js startup snapshot that reduces main-process init from ~80-200ms to ~20-40ms. Zero-config, already working.

2. **Custom snapshots disable the built-in one.** Using `electron-mksnapshot` + the `loadBrowserProcessSpecificV8Snapshot` fuse disables the automatic Node startup snapshot. You trade a free ~80-160ms win for uncertain additional gain.

3. **Custom tooling is stale.** `electron-link` (static analysis for snapshots) hasn't been updated since ~2020. No guarantees with ESM, dynamic imports, or modern Node APIs.

4. **Most main-process code is non-snapshotable:**
   - 7 Node built-ins (native C++ bindings)
   - Electron APIs (app, BrowserWindow, etc.)
   - `@sentry/electron/main` (heavy side effects at import)
   - `electron-updater` (auto-update polling at module level)
   - `i18next` (allocates state at import)
   - 7 top-level side effects in main.ts (fixPath, Sentry.init, etc.)
   - Only 17 local utility modules are snapshotable

5. **Build pipeline integration is non-trivial:**
   - Must upgrade to Electron ≥42.9.3 (custom snapshots broken in 42.0-42.9.2)
   - Must install `electron-mksnapshot@42.x` + `@electron/fuses`
   - Must create snapshot entry point + post-esbuild build step
   - Must flip fuse in electron-builder config
   - Must refactor 7 top-level side effects to deferred
   - Must regenerate snapshot on every dependency change

6. **Binary size increase:** ~5-11MB for the snapshot blob.

### What to do instead

- Rely on the built-in Node.js startup snapshot (already active)
- Continue the existing optimization path: code splitting (T3 ✓), preload split (T4 ✓), utilityProcess migration (T5 ✓)
- The dynamic import pattern already used for server modules is the correct approach for heavy dependencies

### Sources

- Electron 42.3.3 release notes (built-in snapshot)
- PR #52872 (custom snapshot fix in 42.9.3)
- electron-mksnapshot v42.9.2
- electron-link v0.6.0 (stale, ~2020)
- @electron/fuses v1.6.0
- Codebase audit of `electron/main.ts` imports (35 static + 6 dynamic)
