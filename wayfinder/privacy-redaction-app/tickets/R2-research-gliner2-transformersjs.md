# R2 — Research: GLiNER2 multi with transformers.js (client-side WASM)

## Question

How does GLiNER2 multi (ultra-optimized version) run client-side via transformers.js? Specifically:
1. What is GLiNER2 multi vs standard GLiNER2? What makes it "ultra-optimized"?
2. How to load and run GLiNER2 via `@huggingface/transformers` (transformers.js) in a browser/WASM context?
3. What is the memory footprint and first-load time? Can the model be cached with `IndexedDB`?
4. How do you run NER prediction (detect PII entities) on text with it?
5. Is there a way to use a pre-quantized `.q8` or similar variant to reduce size further?
6. What entity types does the multi model support out of the box?

## Method

1. Search HuggingFace docs and GLiNER2 GitHub for transformers.js usage.
2. Look for official GLiNER2 docs on model variants and WASM/browser deployment.
3. Save findings as `wayfinder/privacy-redaction-app/research/r2-gliner2-transformersjs.md`.

## Acceptance

- Each sub-question answered with citations.
- Research file committed to `wayfinder/privacy-redaction-app/research/r2-gliner2-transformersjs.md`.
