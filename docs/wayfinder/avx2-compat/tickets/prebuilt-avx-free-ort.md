## Question

Are there prebuilt AVX-free ONNX Runtime binaries available anywhere that we could use without building from source?

1. Are there community builds of ONNX Runtime for SSE2-only CPUs? (check GitHub repos, package managers, Nix)
2. Does the `onnxruntime` pip package have a manylinux variant that works on older CPUs?
3. Are there Docker images with AVX-free ONNX Runtime?
4. Does Microsoft publish any non-AVX2 ONNX Runtime builds (e.g., for Windows on ARM or IoT)?
5. Are there alternative ONNX runtimes (tract-onnx, onnxruntime-go) that don't require AVX2?

This is the lazy path: if someone already built what we need, we just use it.

**Blocked by**: none (can investigate in parallel)

## Resolution

No prebuilt AVX-free ONNX Runtime binaries exist for Linux x86_64. Must build from source. Best alternative: tract (pure Rust, SSE2 fallback, production-proven). Build command: `./build.sh --cmake_extra_defines CMAKE_C_FLAGS="-mno-avx -mno-avx2 -mno-fma" CMAKE_CXX_FLAGS="-mno-avx -mno-avx2 -mno-fma"` — produces drop-in `libonnxruntime.so`.
