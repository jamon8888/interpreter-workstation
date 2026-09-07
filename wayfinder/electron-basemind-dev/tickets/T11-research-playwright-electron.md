# T11 — Research: Playwright 1.56.1 Electron (fallback for visual verification)

## Question

Even though this map's destination is manual visual debugging, we
want a quick, headless-or-headed Playwright-Electron path so the
tickets can prove a feature works without driving a window by hand.
What is the canonical way in Playwright 1.56.1 to: (a) launch an
Electron app via `_electron.launch({ args: ['.'], env: { … } })`;
(b) get a `Page` from the first `BrowserWindow`; (c) assert on IPC
responses via the DevTools protocol; (d) run that against the
unpackaged app (`pnpm start`, `dist-electron/electron/main.cjs`) and
against the dev loop (`pnpm dev`)? `docs/playwright-electron-notes.md`
already warns about hidden threads and selectors; confirm those
notes are still accurate for 1.56.1.

## Method

1. `context7_resolve_library_id` for "playwright" and pick the
   highest-reputation match.
2. `context7_query_docs` four times, one per sub-question.
3. Capture: the `_electron.launch` API, the `app.firstWindow()` /
   `electronApplication.evaluate()` patterns, the CDP access, and
   the `executablePath` vs `args` trade-offs.
4. Save findings on a throwaway `research/playwright-electron` branch
   as `research/playwright-electron.md`.
5. Diff the findings against `docs/playwright-electron-notes.md`.

## Acceptance

- The four sub-questions are answered with version-stamped citations.
- A copy of the file lives at
  `wayfinder/electron-basemind-dev/research/playwright-electron.md`
  and a pointer is recorded in this ticket's resolution.

## Resolution

**Status: CLOSED** — research complete.

Findings at `../research/playwright-electron.md`.

| Sub-Q | Answer |
|--------|--------|
| (a) `electron.launch` | `electron.launch({ args: ['.'], env: {...}, cwd })` — `args` and `env` forwarded as documented |
| (b) firstWindow + evaluate | `firstWindow()` returns `Page`; `evaluate(fn, arg)` runs in main with `require('electron')` destructured as first arg |
| (c) CDP access | `electronApp.context().newCDPSession(page)`; do NOT use `chromium.connectOverCDP` (collides with Playwright pipe) |
| (d) unpackaged path | `args: ['.']` + repo-root `cwd` is canonical (matches `scripts/playwright-electron-repl.cjs`); `executablePath` only for custom-rebuild smokes |

**Diff vs `docs/playwright-electron-notes.md`**: notes are **current** for Playwright 1.56.1 — no stale warnings.
