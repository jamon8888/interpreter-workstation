## Question

How does the `ort` crate (pykeio/ort) resolve and bundle ONNX Runtime binaries at build time? Specifically:

1. Does `ort` download prebuilt ONNX Runtime `.so`/`.dylib`/`.dll` files during `cargo build`? If so, where does it get them (URL, version)?
2. Is there a cargo feature flag or environment variable to point `ort` at a locally-built ONNX Runtime instead of downloading the official binaries?
3. Does `ort` have a "dynamic" linking mode (`ort-dynamic` feature) that links against a system-installed `libonnxruntime.so` instead of bundling it?
4. What version of ONNX Runtime does `ort` pin? (check Cargo.lock in basemind submodule)
5. Can we pre-place the ONNX Runtime `.so` in a known path to skip the download?

This determines whether we can feed basemind an AVX-free ONNX Runtime build, or whether we need to patch the build system.

**Blocked by**: none

## Resolution

ort v2.0.0-rc.13 downloads prebuilt static ONNX Runtime from `cdn.pyke.io` at build time via `download-binaries` feature (on by default). To use a custom build:
- Set `ORT_LIB_PATH` at build time (static linking), or
- Use `ort-dynamic` feature in basemind Cargo.toml for runtime dynamic loading

The `ort-dynamic` feature exists in basemind (`ort-dynamic = ["xberg?/ort-dynamic"]`) and is used in CI for Intel macOS builds. **This is the cleanest path**: build ONNX Runtime as a shared library, build basemind with `ort-dynamic`, bundle the `.so` alongside.
