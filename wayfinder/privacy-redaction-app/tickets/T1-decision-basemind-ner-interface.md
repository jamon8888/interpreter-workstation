# T1 — Decision: Basemind as NER engine — confirm interface and Vercel Edge deployment

## Question

Basemind (local Rust fork) replaces GLiNER2 as the NER/redaction engine. What is its API interface and how does the Next.js frontend call it?

## Context

The plan: Basemind Rust fork deployed as a Vercel Edge Function. Files go to Basemind → redacted text → LLM. The privacy guarantee is preserved: raw files never reach MiniMax M3, only Basemind-redacted text does.

## Resolution

### API contract

**Basemind has no HTTP API.** It is an MCP server (stdio JSON-RPC) with these relevant tools:
- `vault` — manages the redaction rehydration map (encrypt/decrypt/forget/inspect)
- `comms` (with `redaction.enabled = true`) — processes text and returns redacted output + rehydration map

**The redaction token format** (from `config/documents.rs`):
- `token_replace` (default, reversible): `[TYPE_N]` tokens — e.g., `[EMAIL_0]`, `[IBAN_1]`, `[NAME_2]`
- `mask` (irreversible): `[REDACTED]`
- `hash`: `[HASH:...]`
- `drop`: removes span entirely, no marker

The **reversible** `token_replace` strategy is the right default — it produces readable `[TYPE_N]` placeholders in the redacted text, and a rehydration map allows restoring originals later.

**Entity types** (~40 categories, from `src/pii.rs`):
- Personal: `person_name`, `email`, `phone_number`, `address`, `date_of_birth`
- EU National IDs: French NIR, Dutch BSN, Belgian NISS, Austrian SVNR, Irish PPS, Portuguese NIF, etc.
- Financial: `iban`, `credit_card`, `bank_account`
- Secrets: `api_key`, `aws_access_key`, `aws_secret_key`, `jwt_token`, `bearer_token`, `db_connection_string`, `env_secret`
- Infrastructure: `ip_address`, `internal_hostname`, `internal_url`

**What needs to be built:**

**Option A — Next.js API Route (recommended)**
A Next.js API route (`/api/redact`) that:
1. Accepts `POST { text: string, categories?: string[], strategy?: "token_replace"|"mask" }`
2. Shells out to `basemind comms --text "$text" --redaction.enabled --redaction.strategy token_replace` via `child_process.execFileSync`
3. Returns `{ redactedText: string, rehydrationMap: Record<string, string> }`

This is simple, works with the standard Vercel serverless runtime, and the privacy boundary is preserved: the LLM only ever sees the redacted text returned from this function.

**Option B — Vercel Serverless HTTP wrapper (separate deployment)**
A dedicated Vercel serverless function (not edge, because the Basemind binary is x86_64/arm64 native, not WASM) that wraps Basemind's CLI. Same interface as Option A but as a standalone deployment separate from the Next.js app.

### Architecture decision

**Option A** is the right call: keep Basemind as a CLI dependency of the Next.js app's API route. Deploy it as part of the same Vercel serverless function deployment. This avoids a second deployment and keeps the architecture simple.

**On the MCP server**: we are NOT using Basemind as an MCP server in this architecture. The MCP server is useful for local CLI use. For the web app, we call the CLI directly from the API route.

**Vercel Edge vs Serverless**: The Basemind binary is a native binary (not WASM), so it runs on the Vercel **serverless** runtime (Node.js execution environment), not the Edge runtime. CPU time limit is 10s on Hobby, up to 300s on Pro. This is sufficient for text redaction.

**Binary file extraction** (PDF, images, Word docs): The `documents` feature in Basemind uses `xberg` for OCR + layout detection. This is the path for binary file support — but it needs to be wired into the API route. Binary files would be extracted client-side using pdf.js/mammoth.js/SheetJS/Tesseract.js (per R5), then the extracted text is sent to the redact API.

**Custom entity types**: Basemind supports `custom_terms` and `custom_patterns` in the redaction config (from `config/documents.rs`). These can be passed per-request to the API route. The conversational UI can expose this: "also redact my employee IDs" → pass custom regex pattern to the API.

### API route contract

```
POST /api/redact
Body: {
  text: string,               // raw text to redact
  categories?: string[],       // optional: filter to specific PiiCategory names
  strategy?: "token_replace" | "mask" | "hash" | "drop",  // default: "token_replace"
  customPatterns?: { label: string, pattern: string }[]
}
Response: {
  redactedText: string,       // text with [TYPE_N] tokens
  rehydrationMap: Record<[TYPE_N], originalValue>,  // for reversible redaction
  detections: { category: string, start: number, end: number, confidence: number }[]
}
```

## What this unlocks

This API route becomes the `/api/redact` endpoint the frontend calls when the user drops files. The conversational UI (via AI Elements) sends this request and streams the result back to the chat, triggering the artifact panel to open.

## New tickets surfaced

- **T4** (new): Build `/api/redact` Next.js API route wrapping Basemind CLI
- **T5** (new): Wire binary file extraction (pdf.js/mammoth.js) to the redact API
- **T6** (new): Design the redaction manifest / rehydration map UX (does the user see the map? download it?)

## Resolution recorded

Basemind has no HTTP API — we wrap its CLI in a Next.js API route. Redaction tokens are `[TYPE_N]` format (reversible). Vercel serverless runtime, not Edge. Binary files extracted client-side first, then sent to redact API. Custom patterns supported per-request.
