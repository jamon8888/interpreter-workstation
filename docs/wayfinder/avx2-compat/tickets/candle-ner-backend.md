## Question

Does basemind's NER model work with the Candle backend instead of ONNX Runtime, and can we enable it without modifying upstream?

1. In the basemind submodule Cargo.toml, what feature flag controls the Candle backend for NER? (likely `xberg-gliner/candle` or similar)
2. Does basemind expose this feature flag, or is it buried in xberg's internals?
3. If we enable the Candle feature, does NER work without ONNX Runtime on the same hardware?
4. What's the model format for the Candle backend — does it use the same ONNX model file, or a different format (e.g., safetensors)?
5. Is the Candle backend mature enough for production use, or is it experimental?

This is the quickest win: if NER already supports Candle, we can skip ONNX for that model entirely and only need to solve embeddings + reranker.

**Blocked by**: none (can investigate in parallel with other tickets)

## Resolution

Candle NER backend exists in xberg-gliner (complete, tested, 299 lines) but is **not wired into basemind's dispatcher**. `NerBackendKind` enum only has `Onnx` and `Llm` variants — no `Candle`. To use it: add `ner-candle` feature to basemind, add `Candle` variant to dispatcher, use safetensors model format. **Not a quick win** — requires upstream changes. The ONNX path is the one to solve.
