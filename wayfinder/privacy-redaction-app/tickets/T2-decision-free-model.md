# T2 — Decision: Free model — MiniMax 2.7

## Question

MiniMax M3 is not free. What free model does this app use?

## Resolution

**MiniMax 2.7** — confirmed free by user. Use `@ai-sdk/minimax` with model `minimax-2.7`.

Token cost: free tier applies. Anthropomorphic-compatible API. Works with AI Elements out of the box (same provider as M3).

Updated tech stack:
- **LLM**: `minimax-2.7` via `@ai-sdk/minimax`
- **NER**: Basemind CLI wrapped in `/api/redact` (from T1)
