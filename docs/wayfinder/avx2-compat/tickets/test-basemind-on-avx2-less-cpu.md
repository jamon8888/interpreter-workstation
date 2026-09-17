## Question

Verify that the custom-built basemind binary runs on the i5-2400S (Sandy Bridge, no AVX2) and all three ONNX models work:

1. Run `basemind cpu-features` — should report `avx2: false`
2. Run embeddings warmup: `BASEMIND_ALLOW_ANY_ROOT=1 basemind memory documents "test" --root /tmp/test --limit 1` — should download and run the embeddings model without SIGILL
3. Run reranker warmup: `BASEMIND_ALLOW_ANY_ROOT=1 basemind code semantic "test" --root /tmp/test --limit 1 --rerank --rerank-preset bge-reranker-v2-m3` — should download and run the reranker model
4. Run NER: `BASEMIND_ALLOW_ANY_ROOT=1 basemind scan --root /tmp/test --documents-enabled true --documents-ner-enabled true --documents-redaction-enabled true -q` — should download and run the NER model
5. Verify all three models appear in `~/.cache/huggingface/hub/`
6. Confirm no "illegal instruction" or SIGILL errors in any step

**Blocked by**: [build-basemind-with-ort-dynamic](build-basemind-with-ort-dynamic.md) (need the custom binary)

**This is the acceptance test.** If all three pass, the destination is reached.
