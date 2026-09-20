# Map: genoffice as Workstation's document viewer+editor

## Destination

genoffice (genspark-ai/genoffice, Apache-2.0) embedded as Workstation's rich
document viewer+editor, replacing oo-editors: a fork of genoffice exposes the
`/open?filepath=...` + postMessage contract so the existing document-engine
plumbing (`docs/document-engine.md`) works; format parity with oo-editors
(Docs/Sheets/Slides + legacy formats); genoffice's AI panel stripped in
embedded use; same release-repo install model with the Rust xlsx sidecar cost
weighed; oo-editors removed from Workstation after genoffice ships.

## Notes

- Domain: Electron workstation client of the OIX app-server; document-engine
  integration. The current engine is oo-editors (OnlyOffice/x2t, separate repo
  `openinterpreter/oo-editors`): local HTTP server on port 38123, iframe via
  `src/components/OfficeExtensionViewer.tsx`, install/lifecycle in
  `electron/services/office-extension*.ts`, IPC channels
  `office-extension:{convert,download,status,ensure-running,check-installed,install,install-progress,uninstall,healthcheck}`.
- Key files: `docs/document-engine.md` (neutral engine contract),
  `src/lib/officeExtensionUrl.ts` (open URL),
  `src/lib/officeExtensionSelection.ts` (postMessage selection),
  `src/components/OfficeReadOnlyViewer.tsx` (read-only fallback),
  `shared/utils/converterFormats.ts` (format source of truth),
  `distribution/product.official.json` (documentEngine release repo).
- xberg facts (researched 2026-09-19): xberg is Basemind's core
  document-tier engine (submodule dep `xberg-io/xberg`, pinned rev —
  drives document extraction PDF/Office/OCR, language detection, NER,
  redaction). Also available standalone as the `xberg` CLI
  (xberg-cli 1.0.12), extracting .doc/.odt/.rtf/.ppt/.xls/.pdf/.epub/
  .fb2 to markdown content (validated live on a .docx fixture).
  Workstation already tracks availability:
  `WorkspaceScanStatus.xbergAvailable` / `basemindAvailable`
  (`src/ipc.ts:627-628`).
- genoffice facts (researched 2026-09-18): standalone Electron app, six
  editors (Docs, Sheets, Slides, PDF, Markdown, HTML); opens/saves native
  docx/xlsx/pptx with byte-preserving edits; Rust sidecar for the xlsx
  engine; Node ≥22.12, npm workspaces; reuse surfaces are CLI / MCP
  (stdio + local HTTP at 127.0.0.1:3093) / agent skill / standalone app —
  no iframe or embed component today. 7.1k stars, very active.
- Skills every session should consult: `ponytail` (default mode),
  `superpowers:brainstorming` for creative tickets,
  `superpowers:systematic-debugging` for bugs,
  `superpowers:verification-before-completion` before closing tickets,
  `docs/agent-ipc.md` and `docs/agent-paths.md` before IPC/preload work.
- Standing decisions (grilling round 1):
  - Embedded editor, not conversion-only or MCP-driven-tab model.
  - Fork genoffice to the `/open` + postMessage contract rather than
    adapting Workstation to genoffice as-is.
  - Format parity with oo-editors; genoffice extras only if cheap.
  - Strip genoffice's AI panel for embedded use (Open Interpreter is the
    runtime core; no hosted accounts in community distribution).
  - Same release-repo install model; Rust sidecar (prebuilt vs
    build-from-source) weighed in research.
  - Remove oo-editors after genoffice ships — not before, not kept
    selectable.
- Tracker: local markdown at `wayfinder/genoffice-doc-engine/` (GitHub
  tracker is read-only for the current token: pull-only permissions).
  Tickets are files; the map is the index.

## Blocking

```
T1 (research)  ── closed ✓ (perf-benchmark.md, 2026-09-19)
T2 (research)  ── closed ✓ (genoffice-internals.md, 2026-09-19)
T3 (grilling)  ── closed ✓ (matrix trimmed; xberg legacy conversion)
T4 (prototype) ── open
T5 (task)      ── open
T6 (task)      ── open

Frontier (open, unblocked, unclaimed): T4, T5, T6
```

## Decisions so far

<!-- index only: one line per closed ticket, then the link. -->

- [T3-grilling-format-parity](tickets/T3-grilling-format-parity.md):
  matrix trimmed — genoffice covers docx/xlsx/pptx + xls/csv/ods→xlsx and
  pdf/docx/md/html; legacy .doc/.odt/.rtf/.ppt open via xberg extraction
  to markdown at open time (gated on the existing `xbergAvailable`
  signal, src/ipc.ts:627; fallback agent prompt; save stays markdown,
  lossy, original untouched); no converter porting, no slim x2t kept.
  xberg is Basemind's core document-tier engine, not a separate tool.
  ProseMirror/Tiptap ruled out as a legacy bridge (editors, not
  parsers). → T6.
- [T2-research-genoffice-internals](research/genoffice-internals.md):
  minimal fork patch feasible (~500-800 lines: HTTP embed server cloned
  from McpServerService, window.desktop shim, per-family selection push);
  AI panel strip via ?embed=1 flag, not code removal (deleting ai/ dirs
  would break MCP session tools). Format parity was the open risk →
  graduated into T3.
- [T1-research-perf-benchmark](research/perf-benchmark.md): no perf data
  exists for oo-editors (0 issues, no benchmarks); genoffice ships
  runnable benchmarks and documented pathologies; measurement needs npm
  install + Rust build (genoffice) and release-repo install (oo-editors)
  → graduated into T5.

## Not yet specified

<!-- in-scope fog; graduates to tickets as the frontier advances. -->

- Rust sidecar handling in the Workstation install zip (prebuilt binary
  vs build-from-source) — T2 found genoffice's own handling
  (`XLSX_SIDECAR_PATH` / packaged `native/xlsx-sidecar`), but the
  Workstation-side packaging decision hangs on T4's prototype outcome.
- Release-repo publish flow for the genoffice build — hangs on T4.
- Workstation-side swap integration (replace office-extension services,
  OfficeExtensionViewer routing, product.json) — graduates once T4
  proves the fork contract.
- Grilling on the integration spec details once T4 resolves.

## Out of scope

<!-- destination-adjacent work ruled out of this map. -->

- genoffice's PDF app, Markdown and HTML editors — Workstation already
  ships a full native PDF editor (`src/components/PDFViewer.tsx`,
  pdfjs-dist: annotations, form-fill, save, agent selection events);
  genoffice's PDF path adds nothing there (genoffice's pdf→docx
  conversion could be revisited separately if wanted). ProseMirror/
  Tiptap were also ruled out as a bridge for legacy formats — they are
  editors, not format parsers; the format bridge is the T3 trade-off.
- genoffice's AI panel, Genspark sign-in, BYO-key AI in embedded use —
  stripped per standing decisions.
- Keeping oo-editors as a selectable engine per distribution.
- Adapting Workstation's install/lifecycle layer to genoffice as-is —
  the fork-to-contract decision covers this.
- genoffice's standalone-app packaging (dmg/exe/deb/rpm/AppImage,
  signing) — Workstation consumes a build via its own install model.
- Product website (separate repository; never built here).
