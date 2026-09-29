# T11 — Research findings: Playwright 1.56.1 Electron

Date: 2026-09-06
Library: `playwright@1.56.1` (pinned in `package.json` line 208; `@playwright/test@1.56.1` line 169)
Docs source: `context7_query_docs` against `/websites/playwright_dev`
  (Source Reputation: High, Benchmark Score: 85.2 — highest of the Playwright
  libraries returned; chosen over `/microsoft/playwright` because the public docs
  site is the canonical reference for `_electron.launch` and is what an agent
  would consult for "how do I do X with Playwright?")

Version stamp: context7 returned Playwright docs v1.51.0 / v1.58.2 / v1.61.0;
all four `_electron` APIs cited below are stable across that range (the
`_electron` namespace has not changed signature since 1.10), so 1.56.1 is
covered.

---

## (a) `_electron.launch({ args: ['.'], env: { ... } })` — signature

Canonical reference:
https://playwright.dev/docs/api/class-electron (`electron.launch(options)`)
https://playwright.dev/docs/api/class-electronapplication

**One-line summary:** `const electronApp = await electron.launch({ args: ['.'],
env: { ... } });` — `args` are forwarded to Electron as CLI args; `env` is the
main-process env; the launcher resolves the Electron binary from
`playwright-core`'s bundled `node_modules/electron` if `executablePath` is
omitted, otherwise uses the binary you point at.

Snippet (from `class-electron`, doc snippet verbatim):

```js
const { _electron: electron } = require('playwright');

(async () => {
  // Launch Electron app.
  const electronApp = await electron.launch({ args: ['main.js'] });

  // Evaluation expression in the Electron context.
  const appPath = await electronApp.evaluate(async ({ app }) => {
    // This runs in the main Electron process, parameter here is always
    // the result of the require('electron') in the main app script.
    return app.getAppPath();
  });
  console.log(appPath);

  // Get the first window that the app opens, wait if necessary.
  const window = await electronApp.firstWindow();
  // Print the title.
  console.log(await window.title());
  // Capture a screenshot.
  await window.screenshot({ path: 'intro.png' });
  // Direct Electron console to Node terminal.
  window.on('console', console.log);
  // Click button.
  await window.click('text=Click me');
  // Exit app.
  await electronApp.close();
})();
```

Notes for this repo:
- `args: ['.']` works when Playwright's `cwd` is the directory containing the
  Electron entry script (the project's `package.json` has
  `"main": "dist-electron/electron/main.cjs"`). When `args[0]` is a relative
  path or directory, Playwright passes it through to Electron; Electron then
  resolves it against its own `process.cwd()`. To avoid ambiguity, set
  `cwd: '<repo root>'` on the launch options (the docs list `cwd` as a valid
  option for `_electron.launch`).
- `env` is **main-process only**. Renderer-side env (Vite, `VITE_*`) must be
  injected via the main process before `BrowserWindow` is created, or via the
  shell that spawned Playwright (Playwright inherits the parent env by
  default).

---

## (b) `firstWindow()` + `electronApplication.evaluate`

Canonical reference:
https://playwright.dev/docs/api/class-electron (`firstWindow()`,
`evaluate(pageFunction, ...args)`)
https://playwright.dev/docs/api/class-electronapplication

**One-line summary:** `await electronApp.firstWindow()` resolves to a real
`Page` (it waits for the first `BrowserWindow`'s web contents); `await
electronApp.evaluate(fn, arg)` runs `fn` inside the Electron **main** process
with the destructured result of `require('electron')` as its first argument
(so `{ app, BrowserWindow, ipcMain, ... }` are all in scope).

Key API details from the docs:

```js
// electronApp.firstWindow()
// Returns the first window that the app opens, waiting if necessary.
const window = await electronApp.firstWindow();

// electronApp.evaluate(pageFunction, ...args)
// Runs a function in the Electron main process.
// The first argument to the function is the result of require('electron')
// in the main app script.
// Non-serializable return values result in undefined.
const pid = await electronApp.evaluate(({ app }) => app.getAppPath());
```

For an IPC round-trip assertion (Playwright side):

```js
const page = await electronApp.firstWindow();
const reply = await electronApp.evaluate(async ({ ipcMain }, reqId) => {
  // ipcMain is the live main-process bus
  return new Promise((resolve) => {
    ipcMain.handleOnce(`probe:${reqId}`, () => resolve('ok'));
  });
}, 'req-1');
```

Notes for this repo:
- `firstWindow()` returns a `Page`, **not** a `BrowserWindow`. Anything that
  needs the Electron `BrowserWindow` object (e.g. `webContents.id`) must go
  through `electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows())`.
- `evaluate` only accepts JSON-serializable return values; classes, Electron
  `WebContents`, and `BrowserWindow` instances come back as `undefined`.

---

## (c) CDP access for IPC / network assertions

Canonical reference:
https://playwright.dev/docs/api/class-electronapplication (`context()`)
https://playwright.dev/docs/api/class-browsercontext (`route`,
`newCDPSession`)
https://playwright.dev/docs/api/class-cdpsession
https://playwright.dev/docs/api/class-browsertype (`connectOverCDP`)

**One-line summary:** Use `electronApp.context()` to get the
`BrowserContext`, then `newCDPSession(page)` for raw CDP, or `context.route()`
for the high-level network-interception path; **don't** open a second CDP
channel via `chromium.connectOverCDP` against the Electron debug port — it
collides with Playwright's internal pipe.

From the docs:

```js
// ElectronApplication#context()
// Returns the browser context associated with the Electron application.
// This context can be used for advanced configurations like setting up
// request interception.
const ctx = electronApp.context();

// browserContext.newCDPSession(page)
const client = await ctx.newCDPSession(page);
await client.send('Network.enable');
client.on('Network.responseReceived', (e) => console.log(e.response.url));
const r = await client.send('Network.getCookies');
```

For IPC-shaped traffic (renderer ↔ main), the canonical approach is **not** a
CDP domain — IPC goes through Node, not Chromium. Use one of:
- `electronApp.evaluate(({ ipcMain }) => ipcMain.eventNames())` to inspect
  registered handlers in the main process.
- `context.route('**/api/**', handler)` to intercept HTTP traffic the renderer
  issues as part of its IPC bridge (e.g. our `interpreter-app` CLI surface).
- For low-level Chromium IPC (postMessage between V8 contexts), use the
  `Runtime` CDP domain via `newCDPSession`.

Notes for this repo:
- Our IPC is renderer↔main via Electron's `ipcRenderer`/`ipcMain` (not HTTP),
  so `context.route` won't intercept most of it. Asserting on it means
  `electronApp.evaluate(({ ipcMain }) => ipcMain.listenerCount('channel'))`
  after the renderer has sent a probe, OR installing a temporary
  `ipcMain.handle('probe', ...)` from the test and watching for it to fire.
- `chromium.connectOverCDP` exists but is the wrong tool here: Playwright's
  `_electron.launch` already owns the CDP pipe to the renderer process, and
  a second CDP client will attach to a different target (the main process
  pipe, not the renderer).

---

## (d) `executablePath` vs `args` for unpackaged vs dev

Canonical reference:
https://playwright.dev/docs/api/class-electron
https://playwright.dev/docs/test-webserver (for the `webServer` pattern that
pairs with `_electron.launch` when the dev loop needs a separate Vite server)

**One-line summary:** Use `args: ['.']` + repo-root `cwd` for the unpackaged
app pointed at `dist-electron/electron/main.cjs` (Playwright resolves the
Electron binary from its bundled `node_modules/electron`); use
`executablePath: '<path-to-built-or-downloaded-electron>'` only when you need
a specific Electron build (custom rebuild for native modules, packaged-app
smoke against `dist/.../Workstation.exe`, or CI without `node_modules/electron`
installed).

Patterns for this repo:

| Scenario                          | Launch config                                                                                   |
|-----------------------------------|-------------------------------------------------------------------------------------------------|
| Unpackaged app (`pnpm start`)     | `electron.launch({ args: ['.'], cwd: '<repo root>', env: { NODE_ENV: 'test', ... } })`           |
| Built dist smoke                  | `electron.launch({ executablePath: '<dist>/.../electron', args: ['<dist>/.../resources/app'] })` |
| Dev loop (`pnpm dev`)             | Keep `_electron.launch` pointed at the same entry; start Vite via `webServer` in `playwright.config.ts` and assert on the served renderer. Don't try to launch Electron-Vite from inside Playwright. |

Why split it this way:
- `args: ['.']` tells Electron "the path to your app is `.`". That only works
  when the resolved `process.cwd()` (Playwright sets `cwd` from the option)
  contains a usable Electron app directory (`package.json` with `main`, plus
  `dist-electron/electron/main.cjs` reachable from it). Both `pnpm start`
  and the dist path satisfy this in this repo.
- `executablePath` is for when Playwright's bundled Electron is wrong (custom
  rebuild, musl libc, snap, packaged binary on a machine without
  `node_modules/electron`). It does **not** change how the app is located —
  you still need `args` or rely on Electron's default lookup.

The repo's `scripts/playwright-electron-repl.cjs` already uses the
`args: ['.']` form (see the loader path printed by the REPL:
`playwright-core/lib/server/electron/loader.js`). That's the right shape for
the unpackaged case; nothing in the 1.56.1 docs deprecates that path.

---

## Diff vs `docs/playwright-electron-notes.md`

Verdict: **notes current.** No warnings in `docs/playwright-electron-notes.md`
contradict the Playwright 1.56.1 docs. The notes are repo-specific QA
observations (hidden threads, pointer interception, `contenteditable`
ambiguity, `page.reload()` Response noise) and are framed as repo gotchas,
not as Playwright API behavior. The Playwright API research above does not
invalidate them; it complements them.

Specific check against each note:

| Note (line)                                                         | Doc says                                                                     | Verdict     |
|---------------------------------------------------------------------|------------------------------------------------------------------------------|-------------|
| L4 "Renderer: keep Vite on `5173`"                                  | Test-webserver docs recommend pinning URL + `reuseExistingServer`            | Aligned     |
| L7 "Owner model: one Vite server, one Playwright-owned Electron app" | `_electron.launch` opens one app per call; `context()` returns its ctx       | Aligned     |
| L19 hidden threads leave duplicate buttons                          | DOM-level concern; not a Playwright API claim                                | Aligned     |
| L22 "Background-linked controls must be scoped to the current thread surface" | DOM scoping; not an API claim                                       | Aligned     |
| L25 "top `New agent` button can have pointer interception"          | Playwright auto-retries on `actionability` checks (well-known)              | Aligned     |
| L27 `contenteditable` ambiguity                                     | `page.locator('[contenteditable]')` returns multiple matches — verify bounds | Aligned     |
| L30 `page.reload()` returns a `Response`                            | `page.reload()` resolves to the navigation `Response`                        | Aligned     |
| L32 "prefer switching tabs over creating more tabs"                 | Operational guidance, not an API claim                                       | Aligned     |

No stale warnings to flag. The notes file does not need editing for the
1.56.1 doc review.

---

## Suggested one-shot smoke artifact for T2/T8

The ticket asks whether a one-shot Playwright-Electron smoke is worth
shipping. Per `AGENTS.md`, prefer the simplest complete structural fix and
use what already exists. The repo already has
`scripts/playwright-electron-repl.cjs` (long-running REPL) and
`scripts/playwright-electron-loader-minimal.cjs` (loader check). A new
single-purpose smoke script is **not** recommended: T2/T8 can drive the
existing REPL or add a Playwright `test` under `tests/` if they need
assertions. No new artifact shipped here.