# Electron 42.5.1 — dev loop, DevTools, HMR-friendly main

Pinned for the basemind visual debug surface. Source: official `electron/electron`
repo on GitHub (`/electron/electron` context7 ID, High reputation). All
citations reference `docs/tutorial/security.md`, `docs/breaking-changes.md`,
`docs/api/webview-tag.md`, `docs/tutorial/application-debugging.md`,
`docs/tutorial/window-state-persistence.md`, and `docs/api/structures/web-preferences.md`.

---

## (a) Loading a Vite dev server URL safely

`contextIsolation` has defaulted to `true` since Electron 12 (and was made the
default in Electron 5 alongside `nodeIntegration: false`), so the canonical
"safe" config no longer needs to spell those two out — they are the defaults.
The pattern in `docs/tutorial/security.md` shows `preload` + `loadURL` as the
recommended shape:

```js
// Good (electron/electron docs/tutorial/security.md)
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(app.getAppPath(), 'preload.js')
  }
})
mainWindow.loadURL('https://example.com')
```

For a local Vite dev server the only change is the URL — `loadURL` accepts
`http://localhost:5173` directly, and the same defaults (`contextIsolation:
true`, `nodeIntegration: false`, `sandbox: true`) apply. `docs/api/structures/web-preferences.md`
notes that `sandbox` defaults to `true` and is auto-disabled only when
`nodeIntegration` is explicitly enabled.

One-line summary: **Use `loadURL('http://localhost:5173')` with a `preload`
script — the secure defaults (`contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`) are already in place since Electron 12, so do not override them.**

---

## (b) Opening DevTools from the main process

`openDevTools()` is called on the `webContents` of the window, not the
`BrowserWindow` itself. `docs/tutorial/application-debugging.md` (Renderer
Process section) explicitly recommends:

> You can open them programmatically by calling the `openDevTools()` API on
> the `webContents` of the instance.

For a fresh `BrowserWindow` the call is `mainWindow.webContents.openDevTools()`.
The `webview-tag` docs (`docs/api/webview-tag.md`) and the `BrowserWindow`
wiki entry both confirm the API name; the wiki body describes the call as
"Opens the developer tools for the window."

One-line summary: **Call `mainWindow.webContents.openDevTools()` — there is no
options arg the docs call out, and the API is documented on `webContents`, not
on `BrowserWindow` directly.**

---

## (c) Main-process hot-restart while preserving state

The Electron repo's official docs do **not** document a built-in main-process
hot-restart pattern. The closest references are:

- `docs/tutorial/window-state-persistence.md` documents `windowStatePersistence:
  true` on `BrowserWindow` for **window** state (size/position) — that is the
  only "preserve state" mechanism the docs ship, and it is for the window, not
  for arbitrary main-process state.
- `lib/browser/api/web-contents.ts` shows the `did-stop-loading` event used as a
  "loading has settled" hook inside `executeJavaScript` — useful for sequencing
  IPC, not for hot-restart.
- `docs/api/power-monitor.md` is explicitly noted to make no recommendation
  about reloading windows on resume, which is a good signal that Electron
  itself stays out of the restart-loop business.

In practice this is delegated to community tooling (`electron-reload`,
`electronmon`, or Vite's own `--watch` for the main entry). The ticket's
"preserve main-process state where possible" clause is best served by:

1. Spawn the main entry under a watcher (`tsx watch`, `nodemon --watch`, or
   Vite's main-process `build --watch` from `electron-vite`).
2. Persist any state you need across restarts via `windowStatePersistence` or
   your own store — Electron will not do this for you.
3. Reload the renderer with `webContents.reload()` (or `mainWindow.reload()`)
   once the main entry comes back up; do not call `app.quit()`/`app.relaunch()`
   for sub-second HMR.

One-line summary: **Electron itself ships no main-process hot-restart API —
combine `tsx watch` / Vite's main build `--watch` with `windowStatePersistence`
for window state and `webContents.reload()` for the renderer; treat main
restart as a community-tool concern, not an Electron one.**

---

## (d) Reading renderer console messages back to main

`webContents.on('console-message', ...)` is the documented hook. The payload
shape changed — `docs/breaking-changes.md` and `lib/browser/api/web-contents.ts`
both note that the old positional-args form is deprecated; current code uses
the destructured `Event<WebContentsConsoleMessageEventParams>` object:

```js
// Current (electron/electron docs/breaking-changes.md)
webContents.on('console-message', ({ level, message, lineNumber, sourceId, frame }) => {})

// Deprecated
webContents.on('console-message', (event, level, message, line, sourceId) => {})
```

`level` is now a string (`'info' | 'warning' | 'error' | 'debug'`); older
code receiving the integer form will mis-render log levels.

One-line summary: **Subscribe to `webContents.on('console-message', ({ level,
message, lineNumber, sourceId, frame }) => ...)` and forward via IPC to the
main terminal — the positional-args signature is deprecated and `level` is a
string, not an integer.**

---

## Version note

Citations are to the `main` branch of `electron/electron` as of the context7
index used for this ticket. Electron 42 inherits all of the defaults above:
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, the
destructured `console-message` event, and the absence of any first-party
main-process hot-restart API. No fallback to electronjs.org was needed —
context7's `/electron/electron` index covered all four sub-questions.