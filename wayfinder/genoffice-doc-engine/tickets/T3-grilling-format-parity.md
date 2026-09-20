# T3 — Grilling: format parity gate (fork converters vs trim the matrix)

## Question

genoffice's engines natively edit only docx/xlsx/pptx (plus pdf/md/html).
Against Workstation's `X2T_CONVERTIBLE_FORMATS`
(`shared/utils/converterFormats.ts`), the gaps are large: **no .doc/.ppt/
.odt/.rtf conversion and no .odt/.rtf reading at all** (only text extraction
for .doc/.ppt, used for AI attachments); .xls→xlsx is covered via the Rust
sidecar. The current oo-editors set (`OFFICE_EDITOR_EXTENSIONS`) also opens
.doc/.odt/.rtf/.xls/.ppt/.odp directly.

The standing decision is "format parity with oo-editors" — but parity now
requires a real trade-off:

(a) Fork/port converters into genoffice (doc, ppt, odt, rtf support) —
    heavy; x2t is the OnlyOffice converter genoffice deliberately avoids.
(b) Trim Workstation's matrix to what genoffice covers (docx/xlsx/pptx +
    conversions genoffice's engines do), read-only fallback stays for the
    rest.
(c) Hybrid: genoffice as the editor for what it covers; keep a slim
    converter (x2t subset) only for legacy→modern conversion, then hand
    the converted file to genoffice.

Which is it? What exactly happens when a user opens a .doc or .odt with
genoffice embedded?

## Method

Call the Skill tool for `grilling` and `domain-modeling` (see MAP.md Notes).
Reference `research/genoffice-internals.md` for what the engines actually
cover, and `shared/utils/converterFormats.ts` for the current matrix.

## Acceptance

- A decision on the parity strategy (a/b/c) with the concrete behavior for
  each legacy format spelled out.

## Resolution

**Status: CLOSED** — decision made (2026-09-19).

- **Strategy: reduce the matrix.** genoffice covers docx/xlsx/pptx
  natively + xls→xlsx, csv→xlsx, ods→xlsx (Rust sidecar) and
  pdf/docx/md/html conversions. No converter porting, no slim x2t kept.
- **Legacy formats (.doc/.odt/.rtf/.ppt): xberg extraction to markdown
  at open time.** The UI calls xberg and displays the extracted
  markdown directly in the app; fallback (xberg/basemind unavailable) =
  "open with agent" prompt (agent converts via code execution).
  Validated live: `xberg extract <fixture .docx>` returns markdown
  content; `xberg formats` covers .doc/.odt/.rtf/.ppt/.xls/.pdf/.epub/
  .fb2.
- **Save: stays markdown.** Extraction is lossy — no round-trip to the
  original format; the original file is never modified.
- **xberg is Basemind's core document-tier engine** (submodule dep
  `xberg-io/xberg`, pinned rev; "Document extraction uses xberg 1.1
  chunk content" — submodule CHANGELOG). The same engine is also
  available as the standalone `xberg` CLI (xberg-cli 1.0.12). The
  legacy conversion rides on the engine Basemind's document tier
  already uses — not a separate tool. Workstation already tracks
  availability: `WorkspaceScanStatus.xbergAvailable` /
  `basemindAvailable` (`src/ipc.ts:627-628`) — no new presence check
  needed.
- ProseMirror/Tiptap ruled out as a legacy bridge (editors, not format
  parsers).
- PDF: Workstation keeps its native PDFViewer (genoffice's PDF app
  excluded) — see MAP Out of scope.
- Implementation graduated into [T6](T6-task-xberg-legacy-conversion.md).
