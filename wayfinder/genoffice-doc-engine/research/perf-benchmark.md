# T1 — Research: oo-editors vs genoffice performance

Resolved 2026-09-18. Evidence sources: local machine checks, genoffice repo
(shallow clone at `/tmp/opencode/genoffice`, HEAD `316ded6` from 2026-09-18),
Workstation repo (`docs/document-engine.md`, `electron/services/office-extension*.ts`).
No performance reports exist for `openinterpreter/oo-editors` (repo has 0 issues)
and the Workstation integration has no perf TODOs.

## Sub-questions

### 1. What is known about oo-editors/x2t performance?

**Nothing measured.** OnlyOffice/x2t upstream publishes no perf numbers for the
standalone x2t converter, and `openinterpreter/oo-editors` has zero issues.

**Qualitative/known characteristics** (from OnlyOffice lineage and the
Workstation integration code):

- **Startup cost is structural and paid per document session.** The engine
  starts lazily on first editable-document open (by design,
  `docs/document-engine.md` "clean startup and shutdown"; Hacienda spec
  requirement 10: "engine start lazily only when I open an editable document,
  so everyday startup stays fast"). Each start spawns an
  `ELECTRON_RUN_AS_NODE` child process that loads a large minified
  `server.js` (multi-MB) plus sdkjs/theme assets; Workstation already had to
  work around EADDRINUSE retries, EACCES/EPERM spawn failures, and
  Sentry-in-userData loading (see `office-extension-port.test.ts`,
  `office-extension-startup.ts`). Nothing quantifies the wall-clock cost of
  this path today.
- **Open latency is conversion-based.** Opening a document routes through x2t
  conversion (`office-extension:{convert}`) — a fresh x2t child process per
  conversion — and the viewer is an iframe pointed at
  `http://localhost:38123/open?filepath=...`. Two process hops (server + x2t)
  plus iframe load sit between the user's click and visible content. Not
  measured.
- **Memory footprint: three runtimes live at once** (Electron main + the
  Electron-as-node server + each x2t conversion child, plus the iframe's
  renderer share). Not measured.
- **Conversion speed: unknown.** Logs capture `x2t exited with code 0` and
  byte counts (`sending 10382 bytes` in test fixtures) but nothing times it.

### 2. What does genoffice document or claim about its own performance?

**No published benchmark numbers** (README and docs/ make no perf claims;
nothing in `reports/` is committed). But genoffice **ships real perf
infrastructure and has paid down real perf debt**, which is strong qualitative
evidence about where its costs and design targets are:

- **Sheets: streaming architecture for large workbooks.**
  `apps/sheets/README.md:50` documents the design: the Rust sidecar indexes
  worksheet XML into temporary row chunks while Univer holds only the current
  viewport and buffer; large worksheets are never loaded into memory; saves
  verify a whole-file SHA-256 and rewrite only edited entries.
  `docs/sheets/docs/compatibility.md:80` states the resulting ceiling
  explicitly: **"total workbook size is unbounded — only an individual entry
  being patched must be ≤256MB uncompressed; edits to larger entries fail
  closed."**
- **Shipped xlsx benchmarks** (in-repo, runnable):
  - `apps/sheets/scripts/benchmark-large-xlsx.ts` (gate:
    `npm run benchmark:large -- workbook.xlsx`) measures **open
    milliseconds, first-viewport milliseconds, full-index milliseconds, and
    peak sidecar RSS** (sampled via `ps` every 100ms) against any passed
    fixture, with an indexing-completion timeout.
  - `apps/sheets/scripts/benchmark-xlsx.ts` — open/convert elapsed ms.
  - `apps/sheets/scripts/bench-recalc-resident.ts` — cold (file import) vs
    warm (resident model) recalc at `BENCH_ROWS` (default 50,000) rows.
- **Shipped long-document editing perf patches** (code comments document the
  pathology they fixed):
  - `apps/docs/src/renderer/editor/prosemirror-perf.ts`: ProseMirror
    DecorationSet/Fragment scanning cost **"hundreds of ms per keystroke on a
    10k-paragraph document"** — fixed with binary-search patches, unit-tested
    (`apps/docs/tests/prosemirror-perf.test.ts`) at block counts up to 1000
    and decoration counts >1000.
  - `apps/docs/src/renderer/editor/top-level-pos.ts`: **"tens of seconds on a
    long converted PDF"** for blocks² position scans.
  - `apps/docs/src/renderer/editor/decoration-extensions.ts`: tens of ms per
    keystroke on a 10k-paragraph file.
  - `apps/sheets/src/renderer/load-perf-patches.ts`: Univer header-arrow
    rebuild per streamed-load chunk on filtered sheets with ~1000 hidden
    runs — coalesced.
  - `packages/pptx-engine/src/index.ts:740`: deflating already-compressed
    opaque blobs "burns seconds" — avoided.
- **Implication for the Workstation embedded path:** genoffice's Sheets and
  Docs already target exactly the failure modes an embedded viewer hits
  (large files, long documents, streamed loads). The perf patches are
  renderer-level (prosemirror/Univer), so they carry over into an iframe or
  embed component unchanged. The xlsx sidecar is the one component with a
  native-binary install cost (its benchmarks need `npm run native:build`).

### 3. Can either engine be measured locally right now?

**No — both require a task ticket.** Local checks performed 2026-09-18:

- oo-editors is **not installed**: no `~/.config/interpreter/oo-editors`
  (the `installDirectoryName` from `distribution/product.official.json`),
  no userData office-extension dirs, and **port 38123 is not listening**
  (`curl http://localhost:38123/` → connection refused within a 3s timeout).
  Installing it requires downloading a release asset from the
  `openinterpreter/oo-editors` release repo — a network-heavy setup the
  ticket rules out; whether the current token can pull from it is unknown
  (the GitHub tracker is pull-only, so releases may work, but this was not
  attempted beyond the healthcheck).
- genoffice is **cloned** (`/tmp/opencode/genoffice`, fresh as of today) but
  **not runnable**: it needs a full `npm install` across ~25 workspaces with
  a large lockfile, Node ≥22.12, and its meaningful xlsx benchmark
  additionally requires `npm run native:build` (Rust release build) — all
  explicitly ruled out for this ticket. Its Vite dev servers also start
  per-app, so startup measurement without install is not possible.

**Conclusion: measurement is a later task ticket.** The protocol below is
written so that ticket can execute it directly. The clone at
`/tmp/opencode/genoffice` can be refreshed rather than re-created.

## Benchmark protocol (for a later task ticket)

One machine, one run, same fixtures through both engines' real Workstation
paths — oo-editors via the actual iframe flow, genoffice via the forked
`/open` + postMessage flow (or its dev server as a pre-fork baseline).

### Metrics (per engine, per fixture)

1. **Cold open latency** (ms): first frame paint after opening a document in
   a fresh session. Includes engine startup when the session starts the
   engine (oo-editors: `ELECTRON_RUN_AS_NODE` server spawn → healthcheck →
   iframe load; genoffice: dev-server/app start → document open).
2. **Warm open latency** (ms): second open of the same document with the
   engine already running. Isolates document load from engine startup.
3. **Engine startup latency** (ms, reported separately): time from spawn to
   healthcheck-passing (oo-editors: measured from `office-extension.ts`
   startup logs; genoffice: app/dev-server ready time).
4. **Peak RSS** (KB): sampled every 100ms during the session —
   oo-editors: server + x2t child + Electron renderer; genoffice: app
   process + sidecar (genoffice's `benchmark-large-xlsx.ts` already samples
   sidecar RSS this way — reuse that code).
5. **Conversion speed** (ms): oo-editors `office-extension:convert`
   wall-clock; genoffice equivalent (open-to-IR or the sidecar open call).
6. **Save round-trip** (ms, docx/xlsx/pptx with a byte-preserving edit) —
   optional second-tier metric; genoffice's SHA-256 fail-closed save and
   x2t's round-trip are not required for the go/no-go, but cheap to time.

### Test corpus

Build or source docx/xlsx/pptx at three sizes per format; keep them in
`fixtures/` of the performing repo:

- **Small:** a trivially empty/minimal document (1 sheet / 1 page, <100KB).
- **Medium:** realistic document (e.g. ~1,000 rows × 20 columns xlsx with
  formulas and styles; ~50-page docx; ~30-slide pptx).
- **Large:** the stress case (≥100,000 rows xlsx — matches genoffice's
  `bench-recalc-resident.ts` default of 50,000 rows and its unbounded-size
  claim; ≥10,000-paragraph docx — matches genoffice's stated prosemirror
  target; slide-heavy pptx).

`genoffice`'s own scripts can generate fixtures: `bench-recalc-resident.ts`
builds an xlsx with `BENCH_ROWS` rows + a SUM column via JSZip (reusable
verbatim for the medium/large xlsx).

### Thresholds (pass/fail for "genoffice replaces oo-editors")

No upstream numbers exist, so set absolute thresholds, not relative ones:

- Cold open (including engine startup) ≤ **5s** on the medium corpus.
- Warm open ≤ **1.5s** on the medium corpus; ≤ **3s** on the large xlsx.
- Peak RSS during a medium-document session ≤ **1.5GB** total renderer+engine.
- Large xlsx (100k rows): first viewport ≤ **1s**, full index ≤ **60s**
  (genoffice's own benchmark timeout is 120 readRange attempts; anything in
  that order of magnitude is acceptable for an unbounded-size engine).
- No engine crash, hang, or fail-closed error across the full corpus run.

Fail = any threshold missed on any fixture. A tie or marginal miss on both
engines defaults to keeping oo-editors per the map's "remove oo-editors after
genoffice ships" decision — genoffice must measurably hold before removal.

## Summary

- **Neither engine is measurably known fast or slow.** oo-editors/x2t has zero
  perf data anywhere; genoffice publishes no numbers but ships runnable
  benchmarks (xlsx open/viewport/index/RSS, recalc at 50k rows) and has
  fixed documented per-keystroke pathologies (hundreds of ms on 10k-paragraph
  docs; tens of seconds on long PDFs), plus a documented streaming-xlsx
  architecture with unbounded workbook size (≤256MB per entry patch).
- **Measurement needs a task ticket.** oo-editors is not installed here
  (port 38123 dead, no install dir), and genoffice is cloned but needs a
  full npm install + Rust build for its real benchmarks. The protocol above
  is executable by that ticket as written.
