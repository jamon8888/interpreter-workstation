# T2 — Research: map genoffice internals to the /open + postMessage contract

## Question

In the genspark-ai/genoffice codebase (shallow clone to
`/tmp/opencode/genoffice`), work out what a minimal fork patch looks like so
Workstation's existing document-engine plumbing works unchanged:

- How do genoffice's editor apps open files (entry points, flow from app
  launch to rendered document)?
- What patch exposes an `/open?filepath=...&lang=...&theme=...` URL serving
  the editor in an iframe, matching `src/lib/officeExtensionUrl.ts`?
- Can the editor emit postMessage selection events matching
  `src/lib/officeExtensionSelection.ts` (`selection:changed`)? What shape?
- How separable is the AI panel strip (components, providers, Genspark
  sign-in) — is a build flag / env / code removal enough?
- Do genoffice's engines read legacy formats (doc/odt/rtf/xls/ppt) and what
  export/convert matrix do the engines cover vs the current
  `X2T_CONVERTIBLE_FORMATS` in `shared/utils/converterFormats.ts`?
- How does its readiness/version reporting and clean lifecycle compare to
  the contract in `docs/document-engine.md`?

## Method

1. Shallow clone: `git clone --depth 1 https://github.com/genspark-ai/genoffice /tmp/opencode/genoffice`.
2. Walk the repo: README, docs/, apps/*, packages/* (docx-engine,
   pptx-engine, file-parse, cli), the HTTP MCP server code (127.0.0.1:3093
   drives a visible Word tab — that flow is close to what we need).
3. For each sub-question, capture source-of-truth file paths and short
   verbatim quotes; sketch the minimal patch (files touched, rough diff
   shape) — research only, no code changes to genoffice or Workstation.
4. Save findings as
   `wayfinder/genoffice-doc-engine/research/genoffice-internals.md`.

## Acceptance

- The file answers every sub-question with cited paths.
- A minimal-patch sketch exists for the /open + postMessage surface and
  the AI-panel strip.

## Resolution

(closed) — findings at `research/genoffice-internals.md` (2026-09-19).
Every sub-question answered with cited paths; minimal-patch sketches exist
for the /open + postMessage surface (≈500-800 lines: HTTP embed server
cloned from McpServerService, window.desktop HTTP shim, per-family selection
push) and the AI-panel strip (flag-driven via ?embed=1/GENOFFICE_EMBED,
precedent includeAiHandlers:false). Key risks surfaced: renderers depend on
Electron preload `window.desktop` (iframe needs an HTTP shim); format-parity
gap is large — no .doc/.ppt/.odt/.rtf conversion and no .odt/.rtf reading in
genoffice engines, so X2T_CONVERTIBLE_FORMATS parity needs a decision gate.
