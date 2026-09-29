# R3 — Research: MiniMax M3 on Vercel AI SDK

## 1. Provider Package

**Answer:** The official Vercel AI SDK provider package is `@ai-sdk/minimax`.

```ts
import { createMiniMax } from '@ai-sdk/minimax';
```

Source: [Vercel AI SDK docs — MiniMax provider](https://github.com/vercel/ai/blob/main/content/providers/01-ai-sdk-providers/33-minimax.mdx)

A community alternative (`vercel-minimax-ai-provider`) also exists but `@ai-sdk/minimax` is the official Vercel-maintained package.

---

## 2. Model ID String

**Answer:** The model ID is `'minimax-m3'`.

```ts
import { minimax } from '@ai-sdk/minimax';

const model = minimax('minimax-m3');
// or via factory methods:
const model = minimax.chat('minimax-m3');
const model = minimax.languageModel('minimax-m3');
```

Other available MiniMax models via the same package include: `minimax-m2.7`, `minimax-m2.5`, `minimax-m2.1`, `minimax-m2`, plus highspeed variants (e.g. `minimax-m2.7-highspeed`).

Source: [Vercel AI SDK docs — minimax(modelId)](https://github.com/vercel/ai/blob/main/content/providers/01-ai-sdk-providers/33-minimax.mdx)

---

## 3. Free Tier / Tokens / Rate Limits

**Answer:** MiniMax M3 is a paid API — there is no free token allocation. Vercel AI SDK itself is open-source and free, but the model API calls cost money.

MiniMax pricing (from their platform):

| Model | Input (¥/M tokens) | Output (¥/M tokens) |
|---|---|---|
| **MiniMax-M3** (≤512k input) | ~~4.20~~ **2.10** (permanent 50% off) | ~~16.80~~ **8.40** |
| **MiniMax-M3** (>512k input) | ~~8.40~~ **4.20** | ~~33.60~~ **16.80** |

No free tier is advertised. MiniMax offers paid **Token Plan** subscriptions:

| Plan | Price |
|---|---|
| Plus | ¥49/month |
| Max | ¥119/month |
| Ultra | ¥469/month |

Or pay-as-you-go via purchased credit packs (1,000 credits = ¥7).

There are no rate limits explicitly documented in the Vercel AI SDK provider docs; rate limits are enforced server-side by MiniMax's API.

Sources:
- [MiniMax Platform Pricing (pay-as-you-go)](https://platform.minimaxi.com/docs/guides/pricing-paygo)
- [MiniMax Platform Pricing (Token Plan)](https://platform.minimaxi.com/docs/guides/pricing-token-plan)

---

## 4. API Shape (Chat Completions, Tool Calling, Streaming)

**Answer:** Full support for chat completions, tool calling, and streaming via `generateText` and `streamText`.

```ts
import { minimax } from '@ai-sdk/minimax';
import { generateText, streamText } from 'ai';

// Non-streaming
const { text } = await generateText({
  model: minimax('minimax-m3'),
  prompt: 'Explain quantum computing in simple terms.',
});

// Streaming
const result = streamText({
  model: minimax('minimax-m3'),
  prompt: 'Write a short story about a robot learning to paint.',
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

**Tool calling** is fully supported:

```ts
const { toolCalls, toolResults } = await generateText({
  model: minimax('minimax-m3'),
  prompt: 'What is the weather in Tokyo?',
  tools: {
    getWeather: tool({
      description: 'Get the weather for a location',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temp: 22, condition: 'sunny' }),
    }),
  },
});
```

The MiniMax provider uses an **Anthropic-compatible protocol** at `https://api.minimax.io/anthropic/v1` (not OpenAI-compatible). It uses the `x-api-key` header for authentication (not `Authorization: Bearer`).

Source: [Vercel AI SDK docs — MiniMax provider](https://github.com/vercel/ai/blob/main/content/providers/01-ai-sdk-providers/33-minimax.mdx)

---

## 5. AI Elements / Generative UI Compatibility

**Answer:** Yes, MiniMax M3 works with AI Elements (generative UI) out of the box, via `streamUI` from `@ai-sdk/rsc`.

Since `minimax-m3` supports `streamText` and tool calling, it is compatible with `streamUI`:

```tsx
'use server';

import { minimax } from '@ai-sdk/minimax';
import { streamUI } from '@ai-sdk/rsc';

const result = await streamUI({
  model: minimax('minimax-m3'),
  prompt: 'Get the weather for San Francisco',
  text: ({ content }) => <div>{content}</div>,
  // tools also work with generate
  tools: { /* ... */ },
});
```

MiniMax models support: object generation, tool usage, and tool streaming. They do **not** support image input.

Source: [Vercel AI SDK docs — MiniMax model capabilities](https://github.com/vercel/ai/blob/main/content/providers/01-ai-sdk-providers/33-minimax.mdx)

---

## 6. Quirks vs OpenAI / Anthropic Providers

| Aspect | OpenAI | Anthropic | MiniMax (`@ai-sdk/minimax`) |
|---|---|---|---|
| **Auth header** | `Authorization: Bearer <key>` | `x-api-key` | `x-api-key` |
| **Base URL** | `https://api.openai.com/v1` | `https://api.anthropic.com` | `https://api.minimax.io/anthropic/v1` |
| **Free tier** | Yes (some) | No | No |
| **Thinking/Reasoning** | Via `thinking` param (o3/o4) | Via `thinking` budget | Via `providerOptions.minimax.thinking` |
| **Image input** | Yes | Yes (vision) | **No** |
| **Streaming** | Yes | Yes | Yes |
| **Tool calling** | Yes | Yes | Yes |

**Notable MiniMax M3 quirk — reasoning/thinking:**

MiniMax M3 supports a `thinking` provider option for adaptive deep reasoning:

```ts
const { text, reasoningText } = await generateText({
  model: minimax('minimax-m3'),
  providerOptions: {
    minimax: {
      thinking: { type: 'adaptive' }, // or 'disabled'
    },
  },
  prompt: 'How many "r"s are in the word "strawberry"?',
});
```

This is distinct from OpenAI's `thinking` parameter and uses MiniMax's own reasoning control.

**Provider instantiation difference:**

```ts
// OpenAI / Anthropic — no explicit create call needed
import { openai } from '@ai-sdk/openai';
const model = openai('gpt-4o');

// MiniMax — requires createMiniMax for custom config (or direct import)
import { minimax, createMiniMax } from '@ai-sdk/minimax';
const minimaxProvider = createMiniMax({ apiKey: process.env.MINIMAX_API_KEY });
const model = minimaxProvider.languageModel('minimax-m3');
// or simply:
const model = minimax('minimax-m3'); // uses MINIMAX_API_KEY env var
```

---

## Summary

| Question | Answer |
|---|---|
| Provider package | `@ai-sdk/minimax` |
| Model ID | `minimax-m3` |
| Free tier | No free tokens; paid API via Token Plan (¥49+/mo) or pay-as-you-go |
| API shape | Chat completions + streaming + tool calling (Anthropic-compatible) |
| AI Elements | Works out of the box via `streamUI` / `generateText` |
| Main quirk | Uses `x-api-key` header (not Bearer); Anthropic-compatible endpoint; no image input; MiniMax-specific `thinking` provider option |
