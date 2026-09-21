# T2 findings — genoffice internals mapped to the /open + postMessage contract

Researched 2026-09-19 against a shallow clone of `genspark-ai/genoffice` at
`/tmp/opencode/genoffice` (research only; no code changed in either repo).
Workstation contract sources: `docs/document-engine.md`,
`src/lib/officeExtensionUrl.ts`, `src/lib/officeExtensionSelection.ts`,
`shared/utils/converterFormats.ts`.

Repo shape: seven Electron apps (`apps/{docs,sheets,slides,pdf,markdown,html,shell}`)
sharing pure-TypeScript engine packages plus a Rust xlsx sidecar. All quotes
below are verbatim.

---

## 1. How the editor apps open files

**Flow (docs app):** shell owns tabs as `WebContentsView` children of one
BrowserWindow.

- `apps/shell/src/main/tab-manager.ts:251` — `openDocsTab(openPath?)` calls
  `createDocsView(openPath)`, adds the view, activates the tab.
- `apps/docs/src/main/docs-main.ts:4835` — `createDocsView` creates a
  sandboxed `WebContentsView` (preload, `contextIsolation: true`,
  `sandbox: true`) and loads
  `rendererUrl(runtime.rendererUrl, 'docs', { mode: 'tab' })`.
- Renderers are served from a privileged custom scheme, **not HTTP**:
  `packages/electron-utils/src/renderer-scheme.ts:5` —
  "Origin the built renderers are served from
  (`genoffice-app://<module>/index.html`)." `rendererUrl()` (line 36) already
  appends arbitrary query params to either the dev-server URL or the scheme
  URL — useful for the fork (see §2).
- The file is read **main-process side over IPC, not by URL**. The renderer
  calls `openDocxPath(path)` → `ipcMain.handle('docs:open-path', ...)` →
  `loadDocx()` (`apps/docs/src/main/docs-main.ts:3319`), which reads the file,
  hashes the original by sha256, archives it, and returns raw bytes:
  `apps/docs/src/shared/ipc.ts:1` — `OpenFileResult { path, name,
  "data: ArrayBuffer" ("raw docx bytes"), "hash" ("sha256 of the original
  file; original archived under this hash") }`.
- Parsing is the engine's: "docx-engine parses word/document.xml into a block
  tree, each block anchored to its original XML" (README.md:439-441); save
  splices dirty blocks back so "untouched blocks keep their bytes"
  (README.md:442-444, CONTRIBUTING.md:57-70).
- Legacy entry points: argv (`apps/docs/src/shared/open-file.ts:1` —
  `findDocxPath(argv)` matches `/\.docx$/i` only), macOS `open-file` and
  `second-instance` (`apps/docs/src/main/docs-main.ts:4895-4904`), and the
  CLI control socket (`cmd: 'open'` with optional goto-target,
  `packages/cli/src/control-protocol.ts`; handler in
  `apps/shell/src/main/control-handlers.ts:34`).
- Sheets/Slides/PDF/Markdown/HTML follow the same shape
  (`openSheetsTab`/`openSlidesTab`/`openPdfTab`/`openMarkdownTab`/`openHtmlTab`
  in tab-manager.ts:273-371; sheets pre-warms a spare view because "booting
  Univer is the bulk of a workbook's open time", tab-manager.ts:85-88).

## 2. What exposes `/open?filepath=...&lang=...&theme=...`

**Nothing today.** There is no HTTP server serving the renderers and no
`/open` route. The only HTTP surface is the MCP server:
`apps/shell/src/main/mcp/mcp-server.ts:49` — `DEFAULT_MCP_PORT = 3093`, and
`route()` (line 140) handles only `/health`, `/mcp`, `/sse`, `/messages`.
MCP tool `open` exists (`open-documents-tools`) but routes to a *tab inside
the running shell window* — not iframe content.

**Hard constraint:** the renderer depends on the Electron preload API
`window.desktop` (~100 methods, `apps/docs/src/shared/ipc.ts:250-492`) for
file I/O, save, dialogs, settings, AI, export, print. Workstation loads the
editor in an **iframe** (`src/components/OfficeExtensionViewer.tsx`); without
`nodeIntegrationInSubFrames`, Electron preloads do not run in iframes, so
`window.desktop` is undefined there — and the renderer uses non-optional
access in places (e.g. `apps/docs/src/renderer/App.tsx:963`
`window.desktop.onViewImage?.(...)` throws if `window.desktop` is undefined).
An embeddable build therefore needs an HTTP-backed `window.desktop` shim, not
just a new route.

**Viable minimal patch (option "serve the renderer over HTTP"):**

- New `apps/shell/src/main/embed-server.ts` — clone the proven shape of
  `McpServerService` (plain `node:http`, loopback-only listen
  `server.listen(this.port, '127.0.0.1')` mcp-server.ts:431, Host/Origin
  guards lines 337-368, EADDRINUSE retry, generation-guarded clean
  start/stop lines 376-483). Routes:
  - `GET /open?filepath=...&lang=...&theme=...` → serve the matching editor's
    built `index.html` (reuse `resolveRendererFile` from
    `packages/electron-utils/src/renderer-protocol.ts:18-27` plus the
    `rendererUrl()` query helper, renderer-scheme.ts:38-46) with the params
    forwarded; `t` cache-buster already supported Workstation-side
    (`officeExtensionUrl.ts:22-24`).
  - `GET /file?path=...` → raw bytes (equivalent of `loadDocx`'s read;
    Workstation has already permissioned the path — same trust model as
    oo-editors' server).
  - `POST /save?path=...` → write bytes (equivalent of `docs:save-to`,
    `saveDocxTo` ipc.ts:360-362). **Path traversal protection:** The embed server must validate that the `path` parameter resolves within the workspace root before writing. Reject paths containing `..` or symlinks that escape the workspace boundary.
  - `GET /health` → status + version (see §6).
- New `apps/docs/src/renderer/embed-shim.ts` (~100 lines): when `?embed=1`,
  install `window.desktop` as an HTTP-backed shim — `openDocx`/`openDocxPath`
  fetch `/file`, `saveDocx*` POST `/save`, `getLanguage`/`getTheme` from
  query params, no-op stubs for everything else the renderer touches. Same
  injection point pattern as `installMcpBridge`
  (`apps/docs/src/renderer/mcp-bridge.ts:214-244`).
- Engine packages untouched.

**Files touched:** embed-server.ts (new), embed-shim.ts (new per app or one
shared), small edits to each App.tsx (embed flag + shim install) and
docs-main.ts/shell index.ts (server start/stop on app lifecycle).
Roughly 500-700 lines. No engine changes.

## 3. postMessage selection events

**No push-based selection exists.** Selection is *pull-based* today: each
renderer registers `window.__genofficeControl` and the shell evaluates it via
the debugger channel — "Renderers register `window.__genofficeControl`; the
shell evaluates it through the debugger channel, so no preload surface grows"
(`apps/shell/src/main/control-handlers.ts:29-33`). The wire shapes:

- docs (`apps/docs/src/renderer/control.ts:23-38`, Tiptap):
  `result: { blocks: [first, last], text, collapsed }`
- sheets (`apps/sheets/src/renderer/control.ts:34-52`, Univer):
  `result: { sheet, range: "A1 notation", values | cells }` or
  `{ none: true, sheet }`
- slides: `{ slide, elements }`; pdf: `{ page, text }`
  (`packages/cli/src/commands/selection.ts:25-44` summarizes all four).

**Fork patch:** add a small push module per family that listens to
Tiptap's editor `selectionUpdate` / Univer's selection-change events and maps
to Workstation's message:

```
{ type: 'ONLYOFFICE_SELECTION_CHANGED', filePath, filename, doctype,
  timestamp, selection: {kind:'cell'|'text'|'image'|'object'|'empty', ...} }
```

(src/lib/officeExtensionSelection.ts:23-30). Mapping is direct:

| genoffice source | Workstation payload |
|---|---|
| docs `{blocks, text, collapsed}` | `{kind:'text', text}` (`text:''` when collapsed) |
| sheets `{sheet, range, values}` / `{none}` | `{kind:'cell', range, text}` / `{kind:'empty'}` |
| slides `{slide, elements}` | `{kind:'object', objects:[{type,id}]}` |
| pdf `{page, text}` | `{kind:'text', text}` |

Delivery: `window.parent.postMessage(msg, OO_EDITORS_ORIGIN)` — Workstation validates
`event.origin !== OO_EDITORS_ORIGIN` and listens on `window` 'message'
(`src/components/OfficeExtensionViewer.tsx:272-280`). The origin constant is
the configured port, so it matches whatever port the fork server binds.
**Security note:** Use the specific origin constant (`OO_EDITORS_ORIGIN`) rather than `'*'` as the target origin to prevent leaking selection data to unintended recipients.
~50-80 lines per family, plus a few wiring lines in each App.tsx. All
selection data needed already exists renderer-side; no engine changes.

## 4. AI-panel separability

**Components.** Every app embeds its own AI panel. Docs:
`apps/docs/src/renderer/ai/AiPanel.tsx` (1,834 lines; the `ai/` directory is
~11.7k lines including the agent's tool executors `ai/tools.ts`, 1,938
lines). Mounted unconditionally in `apps/docs/src/renderer/App.tsx:5784`
inside `ai-dock` with a `showAi` collapse state ("always mounted: collapse
must not drop state or in-flight runs"). Sheets has `AiChatPanel.tsx`;
slides/markdown/html/pdf similar.

**Coupling caveat.** The MCP visible-session bridge reuses the AI agent's own
executors: "The executors are the built-in agent's own (`executeTool`), so
external edits inherit the same parsing, atomicity, formatting rules"
(`apps/docs/src/renderer/mcp-bridge.ts:16-19`). Deleting the `ai/` directory
outright would break the MCP session tools and the shell's AI IPC. For
embedded use both are disabled anyway, but a strip must remove coherently.

**Genspark sign-in.** Shell-side: `ai:gsk-login` IPC
(`apps/docs/src/main/docs-main.ts:2909`), account menu, Settings AI pane;
packages `ai-provider` + `ai-search` ("Genspark auth + web/image search
tools", CONTRIBUTING.md, Engine packages section).

**Verdict: a mode flag / env is enough; code removal is riskier than it
looks.** Precedent for flag-driven AI exclusion already exists —
`createSheetsView({ includeAiHandlers: false })` skips AI IPC registration
(`apps/sheets/src/main/sheets-main.ts:2052,2066`; used by the spare view,
tab-manager.ts:115). Recommended: the `/open` route sets `?embed=1`; each
App.tsx skips the AiPanel mount and AI IPC when set; the embed server start
also sets `GENOFFICE_EMBED=1` in its own process to hide shell-level AI
(sign-in menu, Settings AI section). ~50-150 lines total; keeps upstream
merge-ability, unlike deleting ~15k lines across six apps.

## 5. Legacy formats and the convert matrix

**Native editing/rendering is docx/xlsx/pptx (+pdf/md/html) only.** README
FAQ: "GenOffice opens and saves native `.docx`, `.xlsx` and `.pptx` files"
(README.md:493). No .doc/.odt/.rtf/.xls/.ppt editor or renderer exists.

**Text extraction only, for AI attachments** — `packages/file-parse`:
"text extraction for AI attachments (office formats, text formats)"
(CONTRIBUTING.md, Engine packages). Supported legacy reads:
- `.doc`: `docToText` — "Extract readable body and text-box content from a
  legacy Word 97-2003 file" via `word-extractor`
  (`packages/file-parse/src/doc.ts:8-10`).
- `.ppt`: `pptToText` — "Extract one readable text section per slide from a
  legacy PowerPoint 97-2003 file" via CFB (`ppt.ts:30`).
- `.xlsx`/`.xlsm` (`parse.ts:61-63`). **No `.odt`/`.rtf` anywhere** (repo
  grep: only AI-panel attachment-icon lists and Zotero RTF marks).

**Convert matrix** (`packages/cli/src/commands/convert.ts:15-44`):
- Node routes: `pdf→[docx,pptx,xlsx]; csv→[xlsx]; xls→[xlsx]; xlsb→[xlsx];
  ods→[xlsx]; md→[docx,html]; docx→[md]; xlsx→[csv]; xlsm→[csv]`
- App routes (hidden headless-export renderer): `csv/xls/md/docx/xlsx/xlsm/
  pptx→[pdf]; docx→[html]; html,htm→[pdf,docx]`
- `.xls` conversion runs through the **Rust sidecar**:
  `convertLegacyWorkbook` → `withSidecar` → `client.convertWorkbook`
  (`packages/cli/src/formats/xlsx.ts:233-240`); sidecar located via
  `XLSX_SIDECAR_PATH` env, packaged resources `native/xlsx-sidecar`, or
  `apps/sheets/native/xlsx-engine/target/release`
  (`packages/cli/src/resources.ts:60-71`).

**vs Workstation `X2T_CONVERTIBLE_FORMATS`** (`shared/utils/converterFormats.ts:15-37`):

| Workstation expects | genoffice fork covers | Gap |
|---|---|---|
| `.doc`→docx/pdf/odt/rtf/txt/html/epub/fb2 | — (text extraction only) | **full gap** |
| `.odt`, `.rtf` first-class in/out | — | **full gap** |
| `.docx`→pdf/odt/rtf/txt/html/epub/fb2 | pdf, html, md (txt via md) | missing odt/rtf/epub/fb2 |
| `.xls`→xlsx/pdf/ods/csv | xlsx, pdf | missing ods/csv |
| `.ods`→xlsx/pdf/csv | xlsx | missing pdf/csv |
| `.ppt`→pptx/pdf/odp | — (text extraction only) | **full gap** |
| `.pptx`→pdf/odp | pdf | missing odp |
| `.epub`, `.fb2`, `.fods`, `.fodp`, `.htm`, `.txt`, `.html` | html→pdf/docx; md→docx/html/pdf | no epub/fb2/fods/fodp; htm→pdf/docx ok |

Bottom line: the fork covers the OOXML/PDF/MD/HTML core and xls→xlsx (Rust
sidecar) but has **no .doc/.ppt/.odt/.rtf conversion and no .odt/.rtf
reading at all**. Closing the parity gap means either adding converters in
the fork (large — binary Word 97/PPT 97 render→convert does not exist in the
codebase) or Workstation trims `X2T_CONVERTIBLE_FORMATS`/routes legacy files
elsewhere. This is the largest risk item on the map and should gate the
"format parity" decision.

## 6. Readiness/version reporting and lifecycle vs `docs/document-engine.md`

Contract requires: "opening supported documents in an embedded editor;
exporting to a requested format; reporting readiness and version information;
clean startup and shutdown under the app lifecycle"
(`docs/document-engine.md:30-37`).

- **Readiness/version:** the MCP server already answers
  `GET /health` → `{ status:'ok', server:'GenOffice', transport,
  port }` (`mcp-server.ts:146-153`); version flows in the MCP initialize
  handshake (`version: this.version`, mcp-server.ts:99) and `get_app_info`
  (`app-mcp.ts:26`). A fork's embed server adds `version` to `/health` in one
  line. oo-editors compared: Workstation parses its stdout line
  `[oo-editors:STARTUP] server running at http://localhost:38123/ version=1.0.37`
  and pings `GET /healthcheck` (`electron/services/office-extension-exit.test.ts:30,85`).
- **Lifecycle:** `McpServerService` demonstrates the clean pattern the embed
  server can copy: generation-guarded start/stop, socket destroy, loopback
  bind, `stopSync()` "Best-effort synchronous teardown for app shutdown"
  (`mcp-server.ts:376-483`). The open-documents registry is "Rewritten on
  every tab change, emptied at startup, removed on quit" with a pid guard
  (`apps/shell/src/main/open-documents.ts:4-10`). Single-instance lock
  (`docs-main.ts:4889`). The server "only exists while the app runs"
  (mcp-server.ts:12) — matching Workstation's `ensure-running` install
  model.
- **Export:** exists as surfaces (CLI `convert`, headless-export renderer
  mode, `docs:consume-headless-export` IPC) but not as a single HTTP
  endpoint; the fork's embed server would add `POST /export?path=...&format=...`
  mapping onto the same engines (app-route conversions for pdf/html, sidecar
  for xls-family, `convertPdf` for pdf→docx/pptx/xlsx).

---

## 7. Minimal fork patch sketches (research only — no code written)

### (a) `/open` + postMessage surface

```
apps/shell/src/main/embed-server.ts        [new ~250 lines]
  - clone McpServerService skeleton: node:http, loopback-only,
    Host/Origin guards, EADDRINUSE retry, generation-guarded stop
  - GET /open?filepath&lang&theme[&t]  → serve built renderer index.html
    (resolveRendererFile + query params) with ?embed=1 appended
  - GET /file?path      → read bytes (Workstation pre-permissioned path)
  - POST /save?path     → write bytes (saveDocxTo equivalent)
  - POST /export        → route to convert engines (later ticket)
  - GET /health         → { status, version }
apps/docs/src/renderer/embed-shim.ts       [new ~100 lines, per family]
  - if ?embed=1: install window.desktop HTTP shim (open/save/lang/theme,
    no-op stubs otherwise); App.tsx wires it before first render
apps/{docs,sheets,slides}/src/renderer/embed-selection.ts [new ~60 lines each]
  - Tiptap selectionUpdate / Univer selection events →
    ONLYOFFICE_SELECTION_CHANGED payload → window.parent.postMessage
apps/*/src/renderer/App.tsx                [+3-6 lines each]
  - embed flag: skip AiPanel, skip AI IPC, no recent-files/export chrome
shell index.ts / docs-main.ts               [+10 lines]
  - start/stop embed server on app lifecycle
```
Total ≈ 500-800 lines. Engine packages untouched. Largest unknowns: (1) the
`window.desktop` shim must cover every non-optional access the renderer makes
on the open path (App.tsx:963 is one; a stub object neutralizes them);
(2) docs dirty-tracking/save flows assume dialogs — embed mode autosaves or
uses `/save` directly.

### (b) AI-panel strip

```
Preferred: flag-driven (keeps upstream merge-ability)
  - /open route appends ?embed=1; each App.tsx gates AiPanel mount +
    ai IPC on it (precedent: includeAiHandlers: false, sheets-main.ts:2052)
  - embed server sets GENOFFICE_EMBED=1: shell hides sign-in/account menu
    + Settings AI section
  - ~50-150 lines; ai/ executors stay (MCP bridge still imports them)
Code removal alternative: delete ai/ dirs + ai-provider/ai-search + shell
  sign-in (~15k+ lines across six apps) — possible (Apache-2.0 permits) but
  breaks the MCP session tools that share the executors and every future
  upstream merge. Not recommended.
```

## Open items for the next tickets

- Format-parity gap (§5) is the decision-gate: fork converters vs trimming
  `X2T_CONVERTIBLE_FORMATS` vs routing legacy formats elsewhere.
- Rust sidecar provisioning in the Workstation install zip: sidecar is
  located via `XLSX_SIDECAR_PATH` env or packaged `native/xlsx-sidecar`
  (`packages/cli/src/resources.ts:60-71`); prebuilt binary vs
  build-from-source hangs on T1/T2 packaging analysis.
- `/export` HTTP endpoint design hangs on the format-parity decision.
- Benchmark protocol (T1) can now name the concrete surfaces: embed-server
  `/open` → renderer boot → first bytes via `/file` (docs) or Univer boot
  (sheets, which pre-warms a spare view to hide Univer boot cost).
