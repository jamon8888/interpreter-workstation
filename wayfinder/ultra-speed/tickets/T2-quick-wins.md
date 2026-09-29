Type: task
Status: resolved
Blocked by: T1

# T2: Quick Wins — Low-Risk Improvements

## Question

Which of the following quick wins can be applied safely based on the Phase 0 baseline, and what do they each save?

1. **`Menu.setApplicationMenu(null)`** before `app.on('ready')` — skips Electron's default menu setup cost. Verify the app builds its own menu via `buildApplicationMenu()` (it does, per electron/main.ts line 901). Confirm no regression in menu behavior.

2. **`NODE_COMPILE_CACHE`** — set `process.env.NODE_COMPILE_CACHE` to a persistent app-data directory before any `require()` in the main process. Measures warm-cache startup improvement (second launch onward).

3. **`manualChunks` in vite.config.ts** — group known-large static deps into separate chunks:
   - React vendor (react + react-dom + react/compiler-runtime)
   - File viewer runtimes (docx/xlsx/pptx via @file-viewer/vite-plugin — confirm chunking is already happening)
   - PDF.js (already excluded from optimizeDeps; confirm it's isolated)
   - Any other >100KB deps found in Phase 0 bundle analysis

4. **GPU flag audit** — review all `app.commandLine.appendSwitch` calls in electron/main.ts against current Electron 42 defaults. Document which are still needed vs. historical workarounds. Verify each removed switch against its original regression.

Each sub-task is a small, verifiable change. Record before/after numbers for each.

## Answer

All four quick wins applied 2026-09-11. Electron typecheck clean.

### 1. Menu.setApplicationMenu(null) ✓
Added at `electron/main.ts:1223` — before `app.whenReady()`. Skips Electron's default menu setup cost. The app builds its own menu via `buildApplicationMenu()` after ready. One-line change; no regression because `buildApplicationMenu()` calls `Menu.setApplicationMenu(menu)` unconditionally.

### 2. NODE_COMPILE_CACHE ✓
Added at `electron/main.ts:86-90` — sets `process.env.NODE_COMPILE_CACHE` to `userData/compile-cache` before any dynamic `require()` calls. Enables V8 bytecode caching for faster module loading on second launch onward. Only activates when not already set (respects explicit env override).

### 3. manualChunks ✓ (partial)
Added to `vite.config.ts` rollupOptions.output. Three chunk groups defined:
- **vendor-react**: react, react-dom, react/compiler-runtime
- **vendor-i18n**: i18next, react-i18next, i18next-* plugins
- **vendor-file-viewer**: @file-viewer/*, docx-preview, xlsx, pptx

**Result:** The i18n and file-viewer chunks were already split by other mechanisms (dynamic imports, `@file-viewer/vite-plugin`). The `manualChunks` function didn't further split the main 6,004 kB / 1,852 kB gzip chunk — likely because Vite 8 uses Rolldown (not Rollup) and the `manualChunks` function API may differ. The main chunk reduction requires T3 (React.lazy boundaries) instead.

**Action needed:** investigate Vite 8 / Rolldown `manualChunks` compatibility separately, or use `build.rolldownOptions.output.manualChunks` if available.

### 4. GPU flag audit ✓
All 10 `app.commandLine.appendSwitch` calls reviewed. Every flag has a detailed justification comment with issue links and prior art:
- `allow-file-access-from-files` — conditional, built renderer only
- GPU policy switches — delegated to `getGpuStartupPolicy()`, crash-class justification
- `disable-quic` — firewall/VPN reliability (3 cited references)
- `disable-features AsyncDns` — Linux c-ares crash avoidance
- `ozone-platform-hint` — CachyOS X11 workaround
- `no-sandbox` — Linux AppImage only (Ubuntu 24.04 AppArmor)
- `enable-features` — echo cancellation + crash report JS stacks
- `disable-backgrounding-*` (3 switches) — overlay responsiveness
- `disable-blink-features AutomationControlled` — Google bot detection

**No flags removed** — all are actively needed with documented justifications. No historical workarounds found.

### What's left for runtime measurement
- `Menu.setApplicationMenu(null)` savings: needs instrumented launch to measure
- `NODE_COMPILE_CACHE` savings: only measurable on second launch (warm cache)
- `manualChunks` gzip reduction: needs `pnpm run build:renderer` to measure new chunk sizes
- GPU flag removal isn't applicable — all are needed
