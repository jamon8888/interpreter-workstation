# T4 — Build `/api/redact` Next.js serverless function wrapping Basemind CLI

## Question

How do we build the `/api/redact` endpoint that wraps the Basemind CLI?

## Context

T1 resolved: Basemind is an MCP/CLI binary with no HTTP API. We wrap it in a Next.js API route.

**API contract (from T1):**
```
POST /api/redact
Body: {
  text: string,
  categories?: string[],
  strategy?: "token_replace" | "mask" | "hash" | "drop",
  customPatterns?: { label: string, pattern: string }[]
}
Response: {
  redactedText: string,
  rehydrationMap: Record<[TYPE_N], originalValue>,
  detections: { category: string, start: number, end: number, confidence: number }[]
}
```

## Method

1. Determine how to bundle/call the Basemind CLI in a Vercel serverless function:
   - Is it available as an npm package we can `npm install`?
   - Do we download the binary from GitHub releases at deploy time?
   - Is it a local submodule we compile?
2. Implement the `/api/redact` route using `child_process.execFile` or similar
3. Parse the Basemind CLI output into the response shape
4. Handle errors (Basemind not found, timeout, invalid input)
5. Write a one-file test that mocks the Basemind binary

## Resolution

- Post the confirmed approach and implementation notes.
- The next ticket (T5) wires binary extraction to this route.
