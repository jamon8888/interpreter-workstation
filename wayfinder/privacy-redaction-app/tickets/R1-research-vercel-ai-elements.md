# R1 — Research: Vercel AI SDK + AI Elements (conversational UI)

## Question

How does the Vercel AI SDK with AI Elements (`https://elements.ai-sdk.dev/`) work for building a conversational streaming UI? Specifically:
1. What is AI Elements — is it a separate package from `ai` core?
2. How do you build a streaming chat interface with it (components, hooks)?
3. How do AI Elements drive UI state from LLM messages (tool calls, multipart messages)?
4. Can an LLM message trigger a split-pane artifact view (50% chat / 50% file panel)?
5. How does the `@ai-sdk/ui-components` or similar package structure work?
6. What is the recommended pattern for a chat-then-artifact-panel conversational flow?

## Method

1. Use `context7_resolve_library_id` for "vercel ai sdk" or "ai elements" and pick the highest-reputation match.
2. `context7_query_docs` for each sub-question above.
3. If context7 lacks specific AI Elements docs, fall back to `https://elements.ai-sdk.dev/` and scrape/crawl.
4. Save findings as `wayfinder/privacy-redaction-app/research/r1-vercel-ai-elements.md`.

## Acceptance

- Each sub-question answered with citations.
- Research file committed to `wayfinder/privacy-redaction-app/research/r1-vercel-ai-elements.md`.
