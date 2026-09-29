# R7 — Research: Basemind Rust fork — NER pipeline, API, and Vercel Edge deployment

## Question

Everything about the Basemind Rust fork as it relates to this project:

1. **NER pipeline**: What entity types does Basemind detect? How does redaction marking work? Can it be configured per-request with custom entity patterns?
2. **API interface**: What does a request/response cycle look like? Is there an existing HTTP API, gRPC, or Edge Function wrapper?
3. **Binary handling**: Does Basemind handle PDF, images, Word docs directly, or does it only take raw text?
4. **Vercel Edge**: Is there already a Vercel Edge Function deployment for Basemind? Any existing `@vercel/edge` or similar wrapper?
5. **Deployment**: What is the deployment story? Is the Basemind binary compiled to Wasm for Edge, or does it run as a separate service?
6. **Code location**: Is the Basemind fork a submodule of this repo or a separate repo? What is the repo URL?

## Method

1. Explore the Basemind fork at `basemind/` in this checkout (if it exists here) or look at `submodules/` and `basemind/` paths.
2. Read any existing docs about the NER pipeline, API, and deployment.
3. Look at `server/utils/xbergPipelineBinary.ts` (referenced in the existing wayfinder map) for any Basemind integration hints.
4. If insufficient local info, use context7 to look up Vercel Edge Functions + Rust Wasm deployment patterns.
5. Save findings as `wayfinder/privacy-redaction-app/research/r7-basemind-ner-edge.md`.

## Acceptance

- Each sub-question answered with citations or "unknown — needs TBD" if not resolvable from available sources.
- Research file committed.
