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
  - Loading animations signal "processing via Basemind Edge Function" not server activity.
  - Tracker: local markdown at `wayfinder/privacy-redaction-app/`.
- Tracker: local markdown at `wayfinder/privacy-redaction-app/`. Tickets are files; the map is the index.

## Conversational Flow (destination behavior)

1. AI greets user with an upload widget (drag-drop + file picker)
2. User uploads files/folder → sent to `/api/redact` (Basemind CLI via Next.js serverless function) → loading animation ("redacting PII via Basemind")
3. AI says "here are your files, you can edit them and add more PII" → 50% artifact sidebar appears with file finder + CodeMirror
4. User edits markdown files, adds custom PII redactions
5. AI asks "do you want to download a full ZIP ready for ChatGPT/Claude/Gemini without any personal info?"
6. User downloads ZIP (client-side jszip)
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

## Blocking

- T3 (tech stack + project structure) — blocked by T2; unblocked now.
- T4 (build /api/redact route) — blocked by T3 (needs Next.js project scaffolded first).
- T5 (wire binary extraction to redact API) — blocked by T4.
- T6 (design rehydration map UX) — unblocked.

**Frontier (open and unblocked):** T3, T6.

## Not yet specified

<!-- in-scope fog; graduates to tickets as the frontier advances. -->

- **Basemind CLI packaging**: How is the Basemind binary bundled/deployed with the Next.js Vercel serverless function? npm package? GitHub Release download at deploy time?
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
