# Research: AVX-free ONNX Runtime for basemind

## ort crate resolution (resolved)

The `ort` crate (v2.0.0-rc.13) downloads prebuilt static ONNX Runtime binaries from `cdn.pyke.io` at build time. The `download-binaries` feature is enabled by default.

**To use a custom AVX-free ONNX Runtime build:**

| Method | When | How |
|--------|------|-----|
| `ORT_LIB_PATH` | Build time | Set directory containing static `.a` files, disable `download-binaries` |
| `ort-dynamic` feature | Build time | Enables runtime dynamic loading, ONNX Runtime `.so` bundled alongside binary |
| `ORT_DYLIB_PATH` | Runtime | Points to `.so` path (used with `ort-dynamic`) |

The `ort-dynamic` feature exists in basemind's Cargo.toml (`ort-dynamic = ["xberg?/ort-dynamic"]`) and is already used in CI for Intel macOS builds.

## Candle NER backend (resolved)

The candle NER backend exists in xberg-gliner but is **not wired into basemind's dispatcher**. To use it:
1. Add `ner-candle` feature to basemind forwarding `xberg/ner-candle`
2. Add `Candle` variant to `NerBackendKind` enum
3. Use safetensors model format (not ONNX)

This is an upstream change — not practical for immediate use.

## Prebuilt AVX-free binaries (resolved)

No prebuilt AVX-free ONNX Runtime binaries exist for Linux x86_64. Must build from source.

**Build from source (recommended):**
```bash
git clone --recursive https://github.com/microsoft/onnxruntime.git
cd onnxruntime
./build.sh --config Release --build_shared_lib --parallel --skip_tests \
  --cmake_extra_defines \
    onnxruntime_ENABLE_CPUINFO=ON \
    CMAKE_C_FLAGS="-mno-avx -mno-avx2 -mno-fma" \
    CMAKE_CXX_FLAGS="-mno-avx -mno-avx2 -mno-fma"
```

This produces `libonnxruntime.so` with runtime CPU detection (SSE2 baseline, auto-dispatches to AVX2/AVX-512 when available).

**Alternative: tract** (pure Rust, SSE2 fallback, production-proven by Sonos).

## Recommended path

1. Build ONNX Runtime from source without AVX2 (~30 min on i5-2400S)
2. Build basemind with `--features ort-dynamic` and `ORT_DYLIB_PATH` pointing to the custom build
3. Bundle `libonnxruntime.so` alongside the basemind binary
4. The resulting binary works on any x86_64 CPU (SSE2 baseline, auto-dispatches to AVX2 when available)
