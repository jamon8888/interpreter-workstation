# T4 — Prototype: genoffice embed fork (embed server + selection push)

## Question

T2 mapped the minimal patch (~500–800 lines). Build it as a cheap, rough
prototype in a fork of genoffice and react to it:

- `embed-server.ts` in the shell main — plain node:http, loopback-only,
  serving `/open?filepath=...&lang=...&theme=...`, `/file`, `/save`,
  `/health` (cloned from the proven `McpServerService` skeleton,
  `apps/shell/src/main/mcp/mcp-server.ts`).
- HTTP-backed `window.desktop` shim so the renderers (which depend on
  Electron preload APIs) work inside an iframe.
- Per-family selection push (~60 lines/family) mapping
  `window.__genofficeControl` pull-based selection (docs/sheets/slides) to
  Workstation's `ONLYOFFICE_SELECTION_CHANGED` postMessage shape.
- `?embed=1` / `GENOFFICE_EMBED=1` flag gating the AI panel, AI IPC, and
  Genspark sign-in (precedent: `createSheetsView({includeAiHandlers:false})`).

Then open a real .docx from the prototype in a Workstation window and
confirm: iframe loads, edit works, save round-trips, selection events flow.

## Method

Call the Skill tool for `prototype` (see MAP.md Notes). Reference
`research/genoffice-internals.md` for the sketch and cited paths. Work in a
fork/shallow clone of genoffice outside this repo; Workstation side changes
only if the prototype proves the contract needs adjusting.

## Acceptance

- The prototype serves `/open` in a loopback HTTP server and a .docx opens
  in an iframe with edit + save round-trip working.
- Selection events post to `window.parent` in Workstation's shape.
- A written reaction: what worked, what the patch shape becomes for the
  real fork.

## Resolution

**Status: IN PROGRESS** — claimed 2026-09-19.

(open)
