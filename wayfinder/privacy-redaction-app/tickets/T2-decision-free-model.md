# T2 — Decision: MiniMax M3 is NOT free — pay, switch model, or use a free provider?

## Question

MiniMax M3 has no free tier (¥49/mo or ~$0.28/M tokens). The app was described as using "free MiniMax M3 via Vercel AI models." What is the actual free-tier path forward?

## Context

R3 research found: `@ai-sdk/minimax` with model `minimax-m3` — no free tier, costs money after ¥49 token plan.

Free Vercel AI model alternatives:
- **Groq** (`@ai-sdk/groq`): Llama 3.1 8B, Mistral 7B — free tier with rate limits
- **Vercel AI Platform**: free tier for 100k tokens/month with providers like OpenAI/Anthropic
- **Fireworks** (`@ai-sdk/fireworks`): free tier with Llama 3.1
- **LM Studio** / **Ollama**: fully local, free, private — but requires local model running

The key constraint: Vercel AI SDK + AI Elements must work with the chosen provider.

## Method

1. Evaluate: does Groq + `@ai-sdk/groq` work with AI Elements out of the box?
2. Is the free tier sufficient for a personal/side project?
3. Or does the user want to use MiniMax M3 with their own ¥49 plan?

## Resolution

- Post the decision.
- If switching: update the tech stack decision.
- If paying: note the cost assumption.
