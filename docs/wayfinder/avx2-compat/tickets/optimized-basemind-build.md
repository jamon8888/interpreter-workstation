## Question

Build a fully optimized basemind binary for the i5-2400S (Sandy Bridge, no AVX2) that works with interpreter-workstation, including all ML features (embeddings, reranker, NER, layout detection, OCR).

**Approach**: Two-phase build:
1. Build ONNX Runtime from source without AVX2 (SSE2-only, with runtime CPU dispatch)
2. Build basemind with `--features full,ort-dynamic` linking against the custom ONNX Runtime

**Requirements**:
- Binary must run on i5-2400S without SIGILL
- All three ONNX models (embeddings, reranker, NER) must work
- Layout detection, auto-rotate, PaddleOCR, Sceptre OCR must work
- Candle VLM OCR backends (TrOCR, PaddleOCR-VL, GLM-OCR, DeepSeek-OCR) must work
- Tree-sitter code intelligence (371 languages) must work
- MCP server must work
- Must integrate with interpreter-workstation's `basemindManager.ts` binary resolution

**Acceptance criteria**:
1. `basemind cpu-features` reports `avx2: false` (or binary runs without SIGILL)
2. `basemind memory documents "test" --root /tmp/test --limit 1` downloads and runs embeddings model
3. `basemind code semantic "test" --root /tmp/test --limit 1 --rerank --rerank-preset bge-reranker-v2-m3` downloads and runs reranker
4. `basemind scan --root /tmp/test --documents-enabled true --documents-ner-enabled true -q` downloads and runs NER
5. `basemind code outline --root /tmp/test` works (tree-sitter)
6. Binary size is reasonable (< 500MB)
7. `findBasemindBinary()` in basemindManager.ts resolves the new binary

**Blocked by**: build-ort-sse2, build-basemind-with-ort-dynamic

**This is the integration ticket** — it brings together the AVX-free ONNX Runtime build and the basemind build into a working system connected to interpreter-workstation.

## Progress (2026-09-16)

- ONNX Runtime version pinned: **1.28.0** (matches ort-sys 2.0.0-rc.13 dist.tsv for x86_64-linux-gnu)
- Source cloned shallow to `/home/jamin/ort-build/onnxruntime` (904M)
- Configure verified: `USE_AVX=OFF`, `USE_AVX2=OFF`, `USE_AVX512=OFF`, `BUILD_FOR_NATIVE_MACHINE=OFF`, `ENABLE_CPUINFO=ON`, plus `-mno-avx -mno-avx2 -mno-fma -mno-avx512f` in C/CXX flags
- Build running in background (`/home/jamin/ort-build/build.log`), shared lib, Release, parallel 3
- Runtime strategy: install `libonnxruntime.so.1.28.0` to `/usr/local/lib` + ldconfig → no env vars needed (ort `load-dynamic` falls back to dlopen `libonnxruntime.so`)
- Build script drafted: `docs/wayfinder/avx2-compat/build-basemind-avxfree.sh`
- Workstation improvement (independent of build): `runWarmup` in `server/handlers/basemindDownload.ts` now maps signal kills (SIGILL) to a clear "CPU may lack AVX2" message instead of cryptic "Command failed"

## CI + workstation implementation (2026-09-16)

Fork CI (`jamon8888/basemind`, not yet committed):
- `scripts/build-ort-noavx2.sh` (new): builds ORT from source without AVX2, installs to a prefix with versioned .so + symlinks. ORT_VERSION env (default 1.28.0, must match ort-sys dist.tsv)
- `publish.yaml`: new `build-linux-noavx2` job (manylinux_2_28 container → glibc 2.28 floor preserved; ORT build → `cargo build --release --features full,ort-dynamic` → stage .so into `release/deps/` → `package-release.sh` bundles it into `lib/` with `$ORIGIN/lib` rpath → rename to `basemind-x86_64-unknown-linux-gnu-noavx2.tar.gz` → upload)
- Completeness gates updated (meta required, checksums expected + needs, finalize required, "5"→"6")
- `package-release.sh` needed NO changes (deps/*.so* loop already bundles the .so)

Workstation (this repo, uncommitted):
- `download-basemind.mjs`: `linux-x64-noavx2` key; `hasAvx2()` (/proc/cpuinfo on linux, true elsewhere); `--current-platform` auto-selects noavx2 on AVX2-less linux-x64. 15/15 node --test pass
- `basemindManager.ts`: `cpuHasAvx2()`, `isNoAvx2BasemindBinary()`; packaged + staged resolution prefers noavx2 dir on AVX2-less linux-x64
- `routes/ipc.ts`: wired the missing `basemind.cpuFeatures` route (it never existed — the UI always fell into its catch fallback). Route also reports `noavx2Build`
- `BasemindSetupScreen.tsx`: gate stands down when `noavx2Build` is true
- `electron-builder.yml` (linux): ships `resources/basemind/linux-x64-noavx2` as `basemind-noavx2` alongside stock (~300MB extra in Linux packages only)

Local validation build (in progress): basemind `release + full,ort-dynamic` with `RUNPATH=$ORIGIN` against the locally built ORT 1.28.0 (no sudo available for /usr/local/lib install, so $ORIGIN-relative resolution instead)

## Build incident (2026-09-16): flatbuffers v25 hijack

- First build failed at 32% with `static assertion failed: Non-compatible flatbuffers version included` — checked-in headers need flatbuffers 23.x, compiler saw 25.x
- Root cause: ORT cmake uses `FetchContent ... FIND_PACKAGE_ARGS 23.5.9`, which **prefers any system flatbuffers ≥23.5.9 over fetching v23.5.26**. This machine's Android SDK emulator ships flatbuffers v25.1 (`Android/Sdk/emulator/lib/cmake/flatbuffers`), which satisfied the version check but broke the v23-generated headers
- Unsetting ANDROID_HOME did NOT help (build.py only uses it for Android builds; find_package found the SDK config another way)
- Fix: `CMAKE_DISABLE_FIND_PACKAGE_flatbuffers=TRUE` in `--cmake_extra_defines` → forces the v23.5.26 fetch. Verified: `_deps/flatbuffers-src` now present, `flatbuffers_DIR` no longer points at Android SDK
- Note for CI/docs: any dev machine with Android SDK installed hits this. The define should be standard in our build script
