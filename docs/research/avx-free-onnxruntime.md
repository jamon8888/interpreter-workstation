# AVX-Free ONNX Runtime Binaries: Research Summary

**Date:** 2026-09-16
**Question:** Are there prebuilt AVX-free ONNX Runtime binaries available anywhere?

---

## 1. Existing Prebuilt AVX-Free Binaries

### TauSh3N/onnxruntime-no-avx-windows
- **Repo:** https://github.com/TauSh3N/onnxruntime-no-avx-windows
- **Version:** ONNX Runtime v1.17.1 (custom build)
- **Platform:** **Windows only** (no Linux builds)
- **Target:** Intel Atom E3827 (Silvermont, SSE4.2 only)
- **Approach:** Compiled with `onnxruntime_ENABLE_CPUINFO=ON` and no AVX auto-vectorization flags
- **Deliverable:** Headers + Lib + DLL (Windows C++ SDK)
- **Limitation:** Windows-only, pinned to old version 1.17.1, no releases posted (just README with build instructions)

### TauSh3N/ORT (companion repo)
- **Repo:** https://github.com/TauSh3N/ORT
- **Same concept** as above, same author, also Windows-only

### Microsoft Official Releases
- **No official AVX-free builds exist.** The x86_64 Linux/Windows binaries from Microsoft require AVX/AVX2.
- Microsoft publishes x86 (32-bit) binaries only for **Windows** (NuGet packages), not for Linux.
- The 32-bit Windows x86 binaries likely avoid AVX2 (x86-32 doesn't have AVX), but these are **Windows-only** and not applicable to Linux.

### PyPI manylinux Wheels
- `onnxruntime` on PyPI ships `manylinux_2_27_x86_64` wheels — these **require AVX2** at runtime.
- No SSE2-only variant exists on PyPI.

---

## 2. Nix Packages

- **nixpkgs `onnxruntime`** (v1.27.1): Builds from source. The Nix build does NOT appear to add AVX-free flags by default — it compiles with whatever the standard CMake configuration uses, which includes AVX/AVX2 dispatch via MLAS.
- **No explicit AVX-free variant** exists in nixpkgs. However, since Nix builds from source, you *could* create a custom derivation with `-DCMAKE_C_FLAGS="-mno-avx -mno-avx2"` etc., or patch the MLAS build to disable AVX dispatch.
- `pkgsRocm.onnxruntime` exists for ROCm but still has AVX2 CPU optimizations.

---

## 3. CI Artifacts / Release Variants for Baseline x86_64

- **None found.** Microsoft's CI produces only the standard AVX2-requiring binaries.
- GitHub Actions artifacts for onnxruntime are not publicly hosted as downloadable releases.
- The official build system does not offer a "baseline SSE2" option.

---

## 4. Docker Images

- **No AVX-free Docker images exist.** All Docker images (openvino, dustynv, openkylin, openeuler) use standard ONNX Runtime builds that require AVX2.
- The official ONNX Runtime Dockerfiles build from source but do not disable AVX.
- You could create a custom Dockerfile that builds from source with AVX disabled.

---

## 5. Alternative ONNX Runtimes (No AVX2 Required)

### tract (Sonos) — **Best Option for Linux**
- **Repo:** https://github.com/sonos/tract
- **Language:** Pure Rust (with optional SIMD micro-kernels)
- **ONNX Support:** Yes, loads and runs ONNX models
- **AVX requirement:** **None.** tract uses hand-rolled SIMD micro-kernels that dispatch at runtime based on CPU features. On a CPU without AVX2, it falls back to scalar/SSE2 codepaths.
- **Status:** Production use at Sonos (wake-word, streaming speech recognition). Actively maintained, v0.23.x.
- **Formats:** ONNX, NNEF, TFLite, TensorFlow
- **Install:** `pip install tract` (Python) or `cargo install tract` (CLI) or Rust crate `tract-onnx`
- **Caveat:** Not all ONNX ops are supported. Operator coverage is good for common CV/NLP models but not exhaustive.

### Burn (burn-onnx)
- **Repo:** https://github.com/tracel-ai/burn-onnx
- **Language:** Pure Rust
- **ONNX Support:** Converts ONNX models to native Burn Rust code at build time
- **AVX requirement:** **None.** Burn compiles to Rust code and can run on any backend (CPU, GPU, WebAssembly). The CPU backend uses ndarray or tch, which don't require AVX2.
- **Status:** Active development, supports a growing set of ONNX operators. Validated against 26 real-world models.
- **Caveat:** ONNX import is code-generation (build-time), not a runtime loader. Limited operator set compared to ONNX Runtime. The `burn-onnx` crate is at v0.21.

### wonnx
- **Repo:** https://github.com/webonnx/wonnx
- **Language:** Pure Rust, 100%
- **ONNX Support:** Yes
- **AVX requirement:** **None** — uses WebGPU for compute, so it needs a GPU (Vulkan/Metal/DX12).
- **Status:** 1.8k stars, MIT license
- **Caveat:** Requires GPU (WebGPU). Not a CPU-only solution. Limited operator support compared to ONNX Runtime.

### ort (pykeio/ort)
- **Repo:** https://github.com/pykeio/ort
- **Language:** Rust wrapper around Microsoft's ONNX Runtime C library
- **AVX requirement:** **Yes** — it links against the official ONNX Runtime shared library, which requires AVX2.
- **Not a solution** unless you provide a custom-built AVX-free libonnxruntime.so.

### onnxruntime-go (yalue/onnxruntime_go)
- **Language:** Go wrapper around ONNX Runtime C library
- **AVX requirement:** **Yes** — same as ort, it links against the official library.
- **Not a solution** without a custom AVX-free build.

---

## 6. Building from Source (DIY)

The most reliable path for a custom AVX-free build:

```bash
git clone --recursive https://github.com/microsoft/onnxruntime.git
cd onnxruntime

./build.sh \
  --config Release \
  --build_shared_lib \
  --parallel \
  --skip_tests \
  --cmake_extra_defines \
    onnxruntime_ENABLE_CPUINFO=ON \
    CMAKE_C_FLAGS="-mno-avx -mno-avx2 -mno-fma" \
    CMAKE_CXX_FLAGS="-mno-avx -mno-avx2 -mno-fma"
```

Key flags:
- `onnxruntime_ENABLE_CPUINFO=ON` — enables runtime CPU feature detection
- `-mno-avx -mno-avx2 -mno-fma` — disables AVX/AVX2/FMA instruction generation
- The MLAS library will detect CPU features at runtime and use SSE2 codepaths

This is essentially what TauSh3N did for Windows, adapted for Linux.

---

## 7. Windows x86 (32-bit) as Workaround?

- Microsoft publishes ONNX Runtime for `win32` (32-bit x86) — e.g., `onnxruntime-win-x86-1.17.3.tgz`
- 32-bit x86 code cannot use AVX2 (which is a 64-bit extension), so these binaries are inherently AVX-free
- **Cannot be used on Linux x86_64** — wrong binary format (PE vs ELF), wrong word size
- Not a practical workaround for Linux

---

## Assessment: Most Practical Option for Linux x86_64

| Option | Practicality | Notes |
|--------|-------------|-------|
| **Build from source** | **★★★★★** | Most reliable. ~30 min build. Produces a drop-in replacement libonnxruntime.so. |
| **tract** | **★★★★☆** | Pure Rust, no AVX needed, production-proven. Check operator coverage for your model first. |
| **burn-onnx** | **★★★☆☆** | Good for new projects. Code-gen approach means model must be supported at build time. |
| **TauSh3N repo** | ★★☆☆☆ | Windows-only, old version, no Linux builds. Build instructions can be adapted. |
| **wonnx** | ★★☆☆☆ | Requires GPU (WebGPU). Not a CPU-only solution. |
| **Nix custom derivation** | ★★★☆☆ | Same as build-from-source but wrapped in Nix. Reproducible. |
| **Docker custom build** | ★★★☆☆ | Build-from-source in a container. Portable. |

**Recommendation:** If you need ONNX Runtime specifically (compatibility, performance, operator coverage), **build from source with AVX disabled**. It's a well-understood process and produces a drop-in `libonnxruntime.so`. If you can use an alternative runtime and your model's operators are supported, **tract** is the cleanest solution — pure Rust, no FFI, no C library dependencies, and it gracefully falls back to SSE2 on older CPUs.
