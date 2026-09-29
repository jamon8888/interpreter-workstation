# T9 — Research: Electron 42.5.1 docs (dev loop, DevTools, HMR-friendly main)

## Question

What is the canonical way in Electron 42.5.1 to: (a) load a Vite dev
server URL (`http://localhost:5173`) in the renderer with
`webPreferences.contextIsolation: true` and `nodeIntegration: false`;
(b) open DevTools from the main process; (c) make the main process
reload-on-change for the renderer part of the HMR loop (while
preserving main-process state where possible); (d) read renderer
console messages back to the main-process terminal? All four are
needed for the visual debug surface this map depends on.

## Method

1. Use `context7_resolve_library_id` for "electron" (Electron, not
   Electron Fiddle / Electron Forge / etc.) and pick the
   highest-reputation match.
2. `context7_query_docs` four times, one per sub-question above, all
   against the same resolved library ID.
3. Capture: the exact `BrowserWindow` options, the
   `webContents.openDevTools()` call, the recommended pattern for
   hot-restart of the main process, and the
   `webContents.on('console-message', …)` event.
4. Save findings on a throwaway `research/basemind-electron-docs`
   branch as `research/electron-42.md` (single file, version
   pinned).

## Acceptance

- The four sub-questions are answered with version-stamped citations.
- A copy of the file lives at
  `wayfinder/electron-basemind-dev/research/electron-42.md` and a
  pointer is recorded in this ticket's resolution.

## Resolution

**Status: CLOSED** — research complete.

Findings at `../research/electron-42.md`.

| Sub-Q | Answer |
|--------|--------|
| (a) load URL safely | `loadURL('http://localhost:5173')` + `preload`; `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` are secure defaults since Electron 12 |
| (b) open DevTools from main | `mainWindow.webContents.openDevTools()` — on `webContents`, not `BrowserWindow` |
| (c) main hot-restart | No native API; use `windowStatePersistence` + `webContents.reload()` or a `tsx watch` wrapper |
| (d) console messages to main | `webContents.on('console-message', ({ level, message, lineNumber, sourceId, frame }) => …)` — named args, not positional |

No fallback to electronjs.org needed; `/electron/electron` covered all four sub-questions.
