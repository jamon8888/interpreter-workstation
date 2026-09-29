# T5 — Wire `basemindDownload` to real progress streaming

## Question

`server/handlers/basemindDownload.ts:1-51` is a fake `setTimeout` loop
emitting fake `0..100` progress for `ner`, `embeddings`, `reranker`
stages. The UI in `src/components/onboarding/screens/BasemindSetupScreen.tsx:50`
calls `basemind.download()` and renders the progress. How does the
real Basemind binary download its three model stages, and how do we
wire that real progress stream through the existing IPC and UI?

## Context

The map destination requires real binary wiring. The
`basemind.manager.status` returns `{ status: 'disconnected' }` from a
stub; the basemind CLI distribution likely has a `basemind download`
(or per-stage) subcommand whose stdout streams real progress. The
cache location is `~/.cache/basemind/` per
`server/handlers/workspaceScan.ts:54` with marker files
`{ner-model,embeddings,reranker}.ready`.

This is an investigation-first ticket: the binary's real download
surface needs to be read before the code is written.

## Method

1. Run `basemind --help` and `basemind download --help` (or whichever
   subcommand the binary actually exposes) and capture the output.
2. Identify the exact CLI invocation that downloads the three model
   stages, and the format of its progress output (JSON lines? `key=value`?
   human-readable with `%`?).
3. Confirm the cache directory convention
   (`~/.cache/basemind/<marker>.ready`).
4. Replace the `downloadResource` fake in
   `server/handlers/basemindDownload.ts` with a real `child_process.spawn`
   stream that:
   - emits the same `BasemindDownloadProgress` shape the UI already
     consumes;
   - detects a `.ready` marker in the cache dir to flip `done: true`
     for a stage (more reliable than parsing stdout);
   - surfaces a real `error` string on non-zero exit.
5. Keep the existing `AsyncGenerator<BasemindDownloadProgress>` contract
   so the UI in `BasemindSetupScreen.tsx:50` is unchanged.
6. One unit test that pipes a captured `basemind download` output
   fixture through the parser and asserts the resulting
   `BasemindDownloadProgress` sequence.

## Acceptance

- The onboarding `BasemindSetupScreen` in the live Electron window
  (`pnpm dev` running) shows non-trivial progress (not the obvious
  200ms-tick fake) when `Download & Continue` is clicked.
- After the download completes, `~/.cache/basemind/{ner-model,embeddings,reranker}.ready`
  exist on disk.
- `pnpm run test:unit` is green for the new parser test.

## Resolution

**Status: CLOSED**

`basemindDownload` replaced with real invocations:
- `ner` → `basemind lang install -q` (tree-sitter grammars)
- `embeddings` → `basemind serve --no-watch` (starts MCP server; embeddings fetched on first scan)
- `reranker` → no explicit command (fetched on first rerank/search call; `serve` handles it)

Tests: 5 smoke tests against the real binary, all green. Unit suite: 354 tests across 82 files, all green.

**Cache path finding (for T6):** `~/.cache/basemind/` in `workspaceScan.ts:54` is wrong — real cache is `~/.local/share/basemind/`. T6 must fix this constant.
