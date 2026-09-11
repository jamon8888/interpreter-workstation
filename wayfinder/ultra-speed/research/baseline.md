# Baseline Performance Measurement — Ultra Speed Effort

**Date:** 2026-09-11  
**Build:** Vite 8.2.0, rolldown bundler, `pnpm run build:renderer` (24.71s)

---

## 1. Renderer Bundle Analysis

### Main entry chunk

| Chunk | Raw | Gzip |
|-------|-----|------|
| `index-KRcFyRVD.js` | **6,004 kB** | **1,852 kB** |
| `i18n-BG6JZdUA.js` | 1,224 kB | 306 kB |
| `file-viewer-spreadsheet` | 690 kB | 233 kB |
| `src-CoDQeMuL.js` | 326 kB | 99 kB |
| `proxy-CEuwlG1S.js` | 294 kB | 94 kB |
| `file-viewer-presentation-pptx` | 289 kB | 89 kB |
| `docx-preview` | 271 kB | 77 kB |
| `index.es-CMKuDsxp.js` | 226 kB | 60 kB |

**Total JS assets:** ~11.5 MB raw / ~3.4 MB gzip across 25 chunks.  
**CSS:** `src` (341 kB), `index` (220 kB), `ipc` (41 kB).

The 6 MB `index` chunk is the first-paint blocker. It contains the full app shell + all non-lazy components. The vite warning confirms: "Some chunks are larger than 500 kB after minification."

### Workers (off-main-thread, but downloaded upfront)

| Worker | Size |
|--------|------|
| `pdf.worker` | 1,051 kB |
| `pptx.worker` | 579 kB |

### Key observations

- 4,238 modules transformed — massive module graph.
- `rollup-plugin-visualizer` is not installed. Could add for deeper analysis.
- Source maps exist for all chunks (total ~35 MB), confirming debug builds are sized correctly.

---

## 2. Main Process (`electron/main.ts`) Analysis

### Size

- **2,792 lines** in `electron/main.ts`
- **1,825 lines** in `electron/preload.ts`

### Import structure

- **44 static top-level imports** (lines 1–67)
- **~35 additional static imports** at line 860+ (server, IPC handlers, services)
- **13 dynamic `import()` calls** — already exist for lazy loading

The server imports at line 860–919 are the heaviest block — they pull in the entire Express server, tool manager, config store, IPC handlers, services, and workspace utilities at module load time.

### Heavy imports

| Import | Source | Weight |
|--------|--------|--------|
| `@sentry/electron/main` | `../server/server` → `@sentry/node` | Full Sentry SDK |
| `../server/server` | Express app, tool manager, approval manager, agent tab manager, file watcher | Entire server layer |
| `../server/configStore` | Theme, language, zoom, launch count | Config subsystem |
| `../server/tools/builtin-tools/cua-driver/tools` | CUA driver shutdown | Computer-use driver |
| `../server/thumbnailService` | Thumbnail generation | Image processing |
| `./autoUpdater` | Electron auto-updater | App updater |
| `../apps/interpreter-overlay/electron/service` | Overlay service | Overlay subsystem |
| `./i18n` | Internationalization | Full i18n stack |

### Dynamic imports (already lazy)

13 dynamic `import()` calls found in main.ts, mostly:
- Workspace confirmation modules (`setWorkspaceForFileOpen`, `setWorkspaceForExternalOpen`)
- Telemetry (`trackError`, `trackSessionEnd`, `trackAppLaunch`)
- Voice extension install paths
- Office extension notes

**Gap:** The server import block (lines 860–919) is static and pulls in the entire backend. This is the largest single startup cost — all server modules are loaded at import time, not on first use.

---

## 3. App.tsx Analysis

- **988 lines**
- **35 static component imports** — zero `React.lazy()` wrappers
- **2 lazy components exist** in `EditorArea.tsx`:
  - `RemotionViewer` (conditional, behind feature flag)
  - `MovieViewer` (always lazy)
- **8 context providers** wrapping the entire tree:
  1. `I18nextProvider`
  2. `LowerLeftNoticeProvider`
  3. `ToastProvider`
  4. `AuthProvider`
  5. `ToolServersProvider`
  6. `LayoutProvider`
  7. `HelpProvider`
  8. `CommandOverlayProvider`
- `shouldRenderMainSurfaces` gates rendering of `Sidebar`, `AgentSidebar`, and editor area — but does NOT gate module loading. All 35 component imports are evaluated at startup regardless.

### Strong lazy candidates

- `OnboardingOverlay`, `OnboardingFeedbackToast`, `preloadOnboardingTourVideos`
- `AppUpdateDialog`, `ComputerUseSetupModalHost`, `WindowsNativeToolsSetupNotice`
- `BrowserSplitOfferNotice`, `WorkspaceConfirmationModalHost`
- `MarketingDemoShield`, `MarketingDemoSurfaceRenderer`
- `ExtensionDownloadBar`
- `BrowserContextMenu`, `BrowserSelect`

---

## 4. Preload Analysis

- **1,825 lines**, single file
- **`contextBridge.exposeInMainWorld('electron', {...})`** at line 797
- **~255 IPC method references** (`ipcRenderer.invoke`, `.send`, `.on`, `.once`) across **~179 unique IPC calls**
- **~37 functional categories** visible in the exposed API surface

### Strong lazy candidates (in preload or via app-server)

- **Voice/TTS/STT** — voice synthesis and recognition APIs
- **Office** — document viewer/editing APIs
- **Movie** — video playback APIs
- **Terminal** — terminal/shell integration APIs
- **Codex** — AI code generation APIs
- **PDF** — PDF viewer APIs

---

## 5. Existing Perf Infrastructure

### `electron/utils/perf.ts`

- IPC timing utility with `measureSync`, `measureAsync`, `withTiming`
- Gated by `PERF_BENCHMARK=1` env var
- 50ms slow threshold
- Logs `[PERF] [SLOW]` / `[PERF] [OK]` per handler
- **No startup instrumentation** — only IPC handler timing

### Benchmark tests

- `tests/voice-latency-metrics.spec.ts` — voice latency benchmark pattern using Playwright Electron fixtures
- `tests/voice-streaming-latency.spec.ts` — streaming latency benchmark pattern
- Both use custom audio fixtures and environment variable mocking

### What's missing

- No cold-start / time-to-interactive measurement
- No renderer bundle load time instrumentation
- No preload execution time tracking
- No module load order profiling
- No memory baseline snapshots
- No `electron-builder` package size tracking

---

## 6. Process Patterns

### BrowserWindow creation

- `createWindow()` function (line ~2220) creates a single `BrowserWindow` with `preload.cjs`
- `createWorkstationWindow()` wraps it — supports `background: true` for hidden windows
- Windows can be created from: app startup, menu actions, external open handlers, IPC calls
- **Max concurrent windows:** No hard limit; multiple `BrowserWindow.getAllWindows()` calls exist
- **Hidden windows:** `show: shouldShowWindow` allows background windows; `skipTaskbar` hides from taskbar

### Process spawning

- `child_process` not directly imported in main.ts — spawned via services
- `shutdownCuaDriverProcesses` — CUA driver cleanup
- `utilityProcess` — **not used** (confirmed: zero `utilityProcess` references)
- `ensureShellIntegrationInstalled` — shell integration service
- `ensureBrowserExtensionRelayRunning` — browser extension relay

### Server architecture

- `server/server.ts` (936 lines) — Express app imported statically at line 860
- Runs **in-process** (not as a separate worker)
- Includes tool manager, approval manager, agent tab manager, file watcher
- This is the single heaviest import in the main process

---

## 7. What We Can Measure Now vs. Needs Runtime

### Measurable now (static analysis)

| Metric | Value |
|--------|-------|
| Renderer bundle total | 11.5 MB raw / 3.4 MB gzip |
| Main entry chunk | 6,004 kB raw / 1,852 kB gzip |
| Main process lines | 2,792 |
| Preload lines | 1,825 |
| Static imports in main.ts | ~79 total |
| Dynamic imports in main.ts | 13 |
| App.tsx component imports | 35 (0 lazy) |
| Context providers | 8 |
| IPC methods in preload | ~179 |
| CSS total | 602 kB raw / 95 kB gzip |
| Worker files | 2 (1,630 kB total) |
| Build time | 24.71s |

### Needs runtime (dynamic measurement)

| Metric | How to measure |
|--------|---------------|
| Cold start time (main process → first paint) | `console.time` around `app.whenReady()` → `did-finish-load` |
| Preload execution time | `performance.now()` in preload entry |
| Module load order and time | `--prof` flag on Node.js main process |
| Renderer parse/compile time | Chrome DevTools Performance tab |
| Time to interactive (TTI) | Lighthouse or manual `first-input-delay` |
| Memory baseline | `process.memoryUsage()` at startup |
| IPC handler latency | `PERF_BENCHMARK=1` (exists) |
| Window creation time | Instrument `createWindow()` |
| Server startup time | Instrument Express listen |
| Bundle download time (dev) | Vite HMR metrics |
| Actual gzip effectiveness over network | Real fetch with `content-length` vs `transfer-size` |

---

## Summary of Quick Wins Identified

1. **Lazy-load the server import block** (lines 860–919 in main.ts) — biggest single startup cost
2. **Lazy-render onboarding/marketing components** in App.tsx — 35 static imports, 0 lazy
3. **Code-split `i18n`** — 1,224 kB chunk, likely loadable on demand
4. **Lazy-load file viewer chunks** — spreadsheet (690 kB), pptx (289 kB), docx (271 kB) are already code-split but may load eagerly
5. **Add startup profiling** — zero instrumentation exists for cold start
