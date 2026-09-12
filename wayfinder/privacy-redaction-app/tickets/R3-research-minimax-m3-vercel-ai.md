# R3 — Research: MiniMax M3 on Vercel AI free tier

## Question

What is the MiniMax M3 model available on Vercel AI, and how do you configure it as a free-tier model provider? Specifically:
1. How to add MiniMax M3 as a provider in Vercel AI SDK? Is it `@ai-sdk/minimax` or similar?
2. What is the model ID string for MiniMax M3 on Vercel AI?
3. Is there a free tier / how many free tokens? Any rate limits?
4. What API shape does it expose (chat completions, tool calling, streaming)?
5. Does Vercel AI's AI Elements work with it out of the box?
6. Any quirks vs OpenAI or Anthropic providers in the SDK?

## Method

1. Use `context7_resolve_library_id` for "vercel ai minimax" or search Vercel AI SDK docs.
2. Fall back to `https://elements.ai-sdk.dev/` or Vercel AI documentation.
3. Search for "minimax vercel ai sdk model" to find the provider package.
4. Save findings as `wayfinder/privacy-redaction-app/research/r3-minimax-m3-vercel-ai.md`.

## Acceptance

- Each sub-question answered with citations.
- Research file committed to `wayfinder/privacy-redaction-app/research/r3-minimax-m3-vercel-ai.md`.
