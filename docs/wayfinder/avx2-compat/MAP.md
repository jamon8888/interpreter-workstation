# Wayfinder Map: basemind on AVX2-less CPUs

## Destination

basemind builds from source and runs on the i5-2400S (Sandy Bridge, no AVX2) — all three ONNX models (embeddings, reranker, NER) load and execute without SIGILL.

## Notes

- **Basemind submodule**: `submodules/basemind` (upstream: Goldziher/basemind, local fork: jamon8888/basemind)
- **ONNX Runtime path**: basemind → xberg (git dep) → `ort` crate (Rust wrapper) → downloads ONNX Runtime binaries at build time
- **Skills to consult**: rust-router, domain-embedded (for low-level build questions), coding-guidelines

## Decisions so far

- [ort-crate-resolution](tickets/ort-crate-resolution.md): ort downloads prebuilt static ONNX Runtime from cdn.pyke.io at build time via `download-binaries` feature (on by default). To use a custom build: disable `download-binaries`, set `ORT_LIB_PATH` at build time for static linking, or use `ort-dynamic` feature for runtime dynamic loading via `ORT_DYLIB_PATH`. The `ort-dynamic` feature exists in basemind's Cargo.toml and is used in CI for Intel macOS builds.
- [candle-ner-backend](tickets/candle-ner-backend.md): Candle NER backend exists in xberg-gliner (complete, tested) but basemind doesn't expose it and xberg's NER dispatcher doesn't select it yet. Would require: adding `ner-candle` feature to basemind, adding `Candle` variant to `NerBackendKind`, and using safetensors model format instead of ONNX. Not a quick win — needs upstream changes.
- [prebuilt-avx-free-ort](tickets/prebuilt-avx-free-ort.md): No prebuilt AVX-free ONNX Runtime binaries exist for Linux x86_64. Must build from source. Best alternative runtime: tract (pure Rust, SSE2 fallback). Build from source command: `./build.sh --cmake_extra_defines CMAKE_C_FLAGS="-mno-avx -mno-avx2 -mno-fma" CMAKE_CXX_FLAGS="-mno-avx -mno-avx2 -mno-fma"` — produces drop-in `libonnxruntime.so` with runtime CPU detection.

## Not yet specified

- Binary size comparison (AVX2 vs SSE2-only ONNX Runtime) — will be measured during build
- Build time on i5-2400S for ONNX Runtime + basemind — will be measured during build
- Whether basemind's release build script can be adapted for SSE2-only builds — will be assessed after successful local build

## Out of scope

- Changing the upstream Goldziher/basemind repo (we're a consumer, not maintainer) — though we may need to fork for feature flags
- Replacing ONNX Runtime with tract or candle for embeddings/reranker (too large a change for now)
- Supporting CPUs older than x86_64 (SSE2 is the baseline, we stop there)
