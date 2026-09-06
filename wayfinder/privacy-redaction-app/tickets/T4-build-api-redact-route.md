# T4 — Build `/api/redact` Next.js serverless function wrapping Basemind CLI

## Question

How do we build the `/api/redact` endpoint that wraps the Basemind CLI?

## Context

T1 proposed wrapping the Basemind CLI in a Next.js API route. After examining the actual Basemind CLI (`basemind/src/main.rs`), a critical blocker was found: **`basemind scan` requires a git repository context** — it indexes a working tree, staging area, or git revision. There is no `basemind redact "some text"` subcommand. The PII modules exist but are not exposed as a standalone CLI command.

## Resolution

### Critical finding

Basemind's PII redaction is embedded in the document scanning pipeline (`src/extract/doc.rs` + `src/pii.rs`). It is not callable as a standalone text-processing tool. The CLI commands that accept text:
- `basemind agents …` — multi-agent comms, not text redaction
- `basemind vault …` — rehydration map encryption, not text redaction
- `basemind compress-output` — compresses CLI output, not PII redaction

**There is no `basemind redact <text>` command.**

### Options

**Option A — Add `basemind redact` to the fork (correct path)**
Add a new `RedactArgs` CLI command to the Basemind fork that:
1. Takes text via `--text` flag or stdin
2. Runs the PII pipeline (regex + NER)
3. Returns JSON: `{ redactedText, rehydrationMap, detections }`

This is the clean solution. The fork is owned by the user (`github.com/jamon8888/basemind`). This is a new Rust CLI command that calls the existing `PiiEntity` + `DetectedSpan` pipeline directly.

**Option B — Fake git repo (hack, won't work serverless)**
Create a temp directory, `git init`, write text to a file, run `basemind scan`, parse output. Rejected: git operations don't work in Vercel serverless sandbox.

**Option C — MCP server as subprocess**
Spawn `basemind serve` (the MCP server) as a long-lived subprocess, send it JSON-RPC `agents` tool calls with `redaction.enabled: true`. The `agents` tool is not designed for arbitrary text processing — rejected.

**Option D — Separate HTTP service**
Build a minimal Actix/Rust HTTP server that exposes only the NER/redaction pipeline, deploy it separately. Overkill for what is essentially a text transformation.

### Decision

**Option A** — add `basemind redact` to the fork. This is a small, focused Rust addition:
1. New `RedactArgs` struct with `--text`, `--strategy`, `--categories`, `--custom-patterns`
2. A `run_redact()` function that calls the existing PII pipeline directly
3. Output as JSON (matching the T1 API contract)

This is the right place for this logic — it's a CLI command in the Basemind fork.

### Implementation plan

**In the Basemind fork** (`github.com/jamon8888/basemind`):
```
src/main.rs: add Redact subcommand
src/cli/redact.rs: new file — RedactArgs, run_redact()
Cargo.toml: no new deps needed
```

**In the Next.js app** (`privacy-redaction-app`):
```
src/app/api/redact/route.ts — shells out to basemind redact --text ...
```

### API contract (unchanged from T1)

```
POST /api/redact
Body: { text, categories?, strategy?, customPatterns? }
Response: { redactedText, rehydrationMap, detections }
```

### What this means for T5

T5 (wire binary extraction) depends on the `basemind redact` command existing. Binary files: `basemind redact --text "$(cat file.pdf_text)"`. The `xberg/documents` pipeline handles PDF/Office extraction, then `basemind redact` handles the NER step.

### New ticket surfaced

- **T7** (new): Implement `basemind redact` CLI command in the Basemind fork — the actual Rust implementation of the text redaction pipeline.
