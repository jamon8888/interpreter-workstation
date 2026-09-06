# Map: Privacy Redaction conversational web app

## Destination

A deployed Next.js web app where the user has a conversational loop with MiniMax 2.7 (via Vercel AI SDK + AI Elements). The chat lives on the left; a 50% artifact panel on the right shows the file finder + CodeMirror editor. Raw files are never sent to the LLM — the Basemind Rust fork (via `/api/redact` serverless function) handles text extraction and NER redaction before any text reaches the LLM. MiniMax 2.7 is the free conversational partner; Basemind handles all PII detection.

## Notes

- Domain: Greenfield Next.js (App Router) deployed to Vercel. Conversational UI is the primary interface; every action is driven by LLM messages that trigger UI state changes. The Basemind Rust fork CLI is wrapped in a Next.js serverless function (`/api/redact`) for text extraction and NER/redaction.
- Skills every session should consult:
  - `superpowers:brainstorming` — before any creative/architectural decision
  - `superpowers:verification-before-completion` — before closing any ticket
  - `ponytail` — default mode; use stdlib/native first, smallest diff
  - `context7-mcp` — for Next.js, Vercel AI SDK, shadcn/ui, Tailwind, Vercel Edge Functions
  - `rust-skills` — for Basemind Rust fork questions (NER pipeline, Vercel Edge deployment)
- Standing preferences:
  - Use `pnpm`; never add a dependency for what stdlib covers.
  - Files NEVER reach the LLM unredacted — Basemind (Vercel Edge) redacts first.
  - MiniMax 2.7 is the free conversational partner via `@ai-sdk/minimax`.
  - The conversational flow IS the app — no traditional navigation, just AI messages that trigger UI.
  - Rehydration maps: browser-only, Zustand + `sessionStorage`. Never included in ZIP downloads.
  - Loading animations signal "processing via Basemind serverless function" and "redacting PII".
  - Tracker: local markdown at `wayfinder/privacy-redaction-app/`.
- Tracker: local markdown at `wayfinder/privacy-redaction-app/`. Tickets are files; the map is the index.

## Conversational Flow (destination behavior)

1. AI greets user with an upload widget (drag-drop + file picker)
2. User uploads files/folder → sent to `/api/redact` (Basemind CLI via serverless function) → loading animation ("redacting PII via Basemind")
3. AI says "I've redacted 47 items across 12 files. You can undo any redaction by clicking it in the editor. These mappings stay in your browser — close the tab and they're gone." → 50% artifact sidebar appears with file finder + CodeMirror
4. User edits markdown files, adds custom PII redactions; clicks `[EMAIL_0]` to restore original inline
5. AI asks "do you want to download a full ZIP ready for ChatGPT/Claude/Gemini without any personal info? Note: no rehydration map is included — close the tab and the reversibility is gone."
6. User downloads ZIP (client-side jszip — redacted files only, no map)
7. AI asks "upload new files or start over?" → shows upload widget again

## Decisions so far

<!-- index only: one line per closed ticket, then the link. -->

- [R1: Vercel AI Elements](tickets/R1-research-vercel-ai-elements.md): `@ai-elements/react` is the package; split-pane via conditional flex + `resizable-panels`; Panel is a drawer not 50/50 native.
- [R2: GLiNER2 transformers.js](tickets/R2-research-gliner2-transformersjs.md): **SUPERSEDED** — GLiNER2 client-side WASM blocked (no ONNX export). **Basemind Rust fork** is the NER engine instead; deployed as Vercel Edge Function. See T1.
- [R3: MiniMax M3](tickets/R3-research-minimax-m3-vercel-ai.md): `@ai-sdk/minimax`, model `minimax-m3`. **SUPERSEDED** — user confirmed MiniMax 2.7 is free. Use `@ai-sdk/minimax` with model `minimax-2.7` instead. See T2.
- [R4: CodeMirror + extend-hq/ui](tickets/R4-research-codemirror-extend-ui.md): extend-hq/ui is a DOC/PDF/XLSX viewer, NOT markdown. Use `@uiw/react-codemirror` + `react-markdown` instead.
- [R5: File System Access API](tickets/R5-research-file-system-access-api.md): Chrome/Edge full API; Safari/Firefox fallback to `webkitdirectory`. File tree reading via `showDirectoryPicker()`. Binary file text extraction handled by Basemind's `xberg/documents` pipeline (PDF, Office, images via OCR).
- [R6: jszip + privacy animation](tickets/R6-research-jszip-privacy-animation.md): `generateAsync` + `saveAs`; ShieldCheck icon + "Files never leave your device" messaging; per-file progress via `onUpdate`.
- [R7: Basemind NER + Edge](tickets/R7-research-basemind-ner-edge.md): MCP server only (stdio JSON-RPC, no HTTP). ONNX model via `xberg/ner-onnx`. Redaction stores SHA-256 hashes, not raw values. No Vercel Edge wrapper exists. Fork at `github.com/jamon8888/basemind`. Binary formats need `documents` feature (not yet wired).
- [T1: Basemind NER interface](tickets/T1-decision-basemind-ner-interface.md): No HTTP API — Basemind is MCP/CLI only. Wrap its CLI in a Next.js API route (`/api/redact`). Redaction tokens are `[TYPE_N]` (reversible) or `[REDACTED]` (irreversible). Vercel **serverless** runtime (native binary, not WASM edge). Binary file text extraction also goes through Basemind via its `xberg/documents` pipeline — NOT client-side libraries. Supports `custom_patterns` per-request.
- [T2: Free model decision](tickets/T2-decision-free-model.md): **MiniMax 2.7** confirmed free. Use `@ai-sdk/minimax` with model `minimax-2.7`. Anthropic-compatible API, works with AI Elements.
- [T3: Tech stack + project structure](tickets/T3-decision-tech-stack.md): Standalone `privacy-redaction-app` repo. Next.js 15 App Router + Vercel. `@ai-elements/react` + `useChat`. shadcn/ui + Tailwind. `@uiw/react-codemirror` + `react-markdown`. Zustand for file/editing state. jszip + FileSaver.js. Basemind CLI via `/api/redact` serverless route.
- [T4: Build /api/redact route](tickets/T4-build-api-redact-route.md): **BLOCKER** — `basemind scan` requires git repo context. No `basemind redact` CLI command exists. Must add `basemind redact` to the Basemind fork first (new Rust CLI command calling the existing PII pipeline). T7 is the critical path.

## Blocking

- T7 (implement `basemind redact` in Basemind fork) — unblocked; the critical path.
- T5 (wire binary extraction) — blocked by T7 (needs the `basemind redact` command).

**Frontier (open and unblocked):** T7.

## Not yet specified

<!-- in-scope fog; graduates to tickets as the frontier advances. -->

- **Large folder handling**: What happens with 500+ files? Streaming extraction? Progress shown in chat?
- **Artifact panel file state**: Does the artifact panel track "original vs redacted vs user-edited" per file? Or just the final state? (RESOLVED: redacted is state; user edits tracked separately)
- **Session persistence**: (RESOLVED: Zustand + sessionStorage, session-scoped)
- **LLM prompt engineering**: What system prompt drives MiniMax 2.7 to stay in character as a privacy assistant?
- **ZIP structure**: Flattened? Preserve folder hierarchy? Include a redaction manifest?
- **Multi-file CodeMirror**: One file at a time (tabbed) or all at once?

## Out of scope

<!-- destination-adjacent work ruled out of this map. -->

- User accounts / authentication — anonymous, no session.
- Real-time collaborative editing.
- GLiNER2 client-side WASM — replaced by Basemind CLI wrapper.
- Building/modifying Basemind itself — we consume it as a CLI dependency.
- Vercel Edge runtime for Basemind — native binary requires serverless runtime, not WASM edge.
- Client-side binary extraction (mammoth, pdf.js, SheetJS, Tesseract.js) — replaced by Basemind's own xberg pipeline.
