#!/usr/bin/env bash
# Build + install an AVX2-free basemind for old x86_64 CPUs (e.g. Sandy Bridge).
#
# Phase 0 (ONNX Runtime, run once):
#   git clone --depth 1 --branch v1.28.0 --recursive --shallow-submodules \
#     https://github.com/microsoft/onnxruntime.git /home/jamin/ort-build/onnxruntime
#   cd /home/jamin/ort-build/onnxruntime
#   python3 tools/ci_build/build.py --build_dir /home/jamin/ort-build/build \
#     --config Release --build_shared_lib --parallel 3 --skip_tests \
#     --cmake_extra_defines onnxruntime_ENABLE_CPUINFO=ON onnxruntime_USE_AVX=OFF \
#     onnxruntime_BUILD_FOR_NATIVE_MACHINE=OFF \
#     CMAKE_DISABLE_FIND_PACKAGE_flatbuffers=TRUE \
#     'CMAKE_C_FLAGS=-mno-avx -mno-avx2 -mno-fma -mno-avx512f' \
#     'CMAKE_CXX_FLAGS=-mno-avx -mno-avx2 -mno-fma -mno-avx512f'
#   NOTE: CMAKE_DISABLE_FIND_PACKAGE_flatbuffers is required on machines with
#   Android SDK installed — its emulator ships flatbuffers v25.1, which ORT's
#   FetchContent prefers over v23.5.26 but which breaks the checked-in headers.
#
# This script: phases 1-5 (install ORT, build basemind, test, stage).
# Usage: ./build-basemind-avxfree.sh
set -euo pipefail

ORT_BUILD=${ORT_BUILD:-/home/jamin/ort-build/build/Release}
BASEMIND=${BASEMIND:-/home/jamin/Documents/interpreter-workstation/submodules/basemind}
WORKSTATION=${WORKSTATION:-/home/jamin/Documents/interpreter-workstation}
STAGED=${STAGED:-$WORKSTATION/resources/basemind/linux-x64-noavx2}
mkdir -p "$STAGED"

echo "==> 1/5 inspect custom libonnxruntime for AVX2 instructions (diagnostic only)"
# NOTE: a bare presence check canNOT gate here — MLAS ships CPUID-dispatched
# AVX2 kernels (safe: never executed without AVX2) alongside the SSE2
# baseline, so a known-good build contains tens of thousands of VEX hits.
# The hard gate is step 4's smoke test on AVX2-less hardware (set -euo
# pipefail aborts on its SIGILL/nonzero exit); this count is diagnostic.
AVX_HITS=$(objdump -d "$ORT_BUILD/libonnxruntime.so.1.28.0" | grep -c -E "vpbroadcast|vpadd|ymm[0-9]|zmm[0-9]" || true)
echo "info: $AVX_HITS AVX vector instructions (expected: MLAS CPUID-dispatched kernels)"

echo "==> 2/5 install libonnxruntime system-wide"
if ! sudo -n true 2>/dev/null; then
  echo "ERROR: passwordless sudo required for system-wide install. Run with sudo or configure NOPASSWD for cp/ln/ldconfig." >&2
  exit 1
fi
sudo cp "$ORT_BUILD/libonnxruntime.so.1.28.0" /usr/local/lib/
sudo ln -sf libonnxruntime.so.1.28.0 /usr/local/lib/libonnxruntime.so.1
sudo ln -sf libonnxruntime.so.1 /usr/local/lib/libonnxruntime.so
sudo ldconfig
ldconfig -p | grep onnxruntime

echo "==> 3/5 build basemind (release, full + ort-dynamic)"
cd "$BASEMIND"
cargo build --release --features full,ort-dynamic --bin basemind

echo "==> 4/5 smoke test on this CPU (no AVX2)"
export ORT_DYLIB_PATH=/usr/local/lib/libonnxruntime.so.1.28.0
./target/release/basemind --version
AVXFREE_TEST_DIR=$(mktemp -d /tmp/bm-avxfree-test-XXXXXX)
trap 'rm -rf "$AVXFREE_TEST_DIR"' EXIT INT TERM
echo '<html><body><p>Contact Jane Doe at jane.doe@example.com about quarterly renewable energy.</p></body></html>' > "$AVXFREE_TEST_DIR/warmup.html"
echo 'function sumQuarterlyReport(values) { return values.reduce((t, v) => t + v, 0); }' > "$AVXFREE_TEST_DIR/warmup.js"
export BASEMIND_ALLOW_ANY_ROOT=1
"$BASEMIND/target/release/basemind" memory documents "quarterly report" --root "$AVXFREE_TEST_DIR" --limit 1
trap - EXIT INT TERM
rm -rf "$AVXFREE_TEST_DIR"

echo "==> 5/5 stage into workstation (leave stock linux-x64 untouched)"
cp "$BASEMIND/target/release/basemind" "$STAGED/basemind"
cp /usr/local/lib/libonnxruntime.so.1.28.0 "$STAGED/"
ln -sf libonnxruntime.so.1.28.0 "$STAGED/libonnxruntime.so.1"
ln -sf libonnxruntime.so.1 "$STAGED/libonnxruntime.so"
ls -la "$STAGED/"
echo "DONE"
