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

ORT_BUILD=/home/jamin/ort-build/build/Release
BASEMIND=/home/jamin/Documents/interpreter-workstation/submodules/basemind
WORKSTATION=/home/jamin/Documents/interpreter-workstation
STAGED=$WORKSTATION/resources/basemind/linux-x64

echo "==> 1/5 verify custom libonnxruntime has no AVX2 instructions"
if objdump -d "$ORT_BUILD/libonnxruntime.so.1.28.0" | grep -qm1 -E "vpbroadcast|vpadd|ymm[0-9]|zmm[0-9]"; then
  echo "WARN: AVX vector instructions found in libonnxruntime (may be CPUID-guarded MLAS kernels)"
  objdump -d "$ORT_BUILD/libonnxruntime.so.1.28.0" | grep -c -E "vpbroadcast|vpadd|ymm[0-9]|zmm[0-9]" || true
else
  echo "OK: no AVX vector instructions"
fi

echo "==> 2/5 install libonnxruntime system-wide"
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
mkdir -p /tmp/bm-avxfree-test && cd /tmp/bm-avxfree-test
echo '<html><body><p>Contact Jane Doe at jane.doe@example.com about quarterly renewable energy.</p></body></html>' > warmup.html
echo 'function sumQuarterlyReport(values) { return values.reduce((t, v) => t + v, 0); }' > warmup.js
export BASEMIND_ALLOW_ANY_ROOT=1
"$BASEMIND/target/release/basemind" memory documents "quarterly report" --root /tmp/bm-avxfree-test --limit 1

echo "==> 5/5 stage into workstation (backup old binary first)"
cp "$STAGED/basemind" "$STAGED/basemind.stock-avx2.bak"
cp "$BASEMIND/target/release/basemind" "$STAGED/basemind"
cp /usr/local/lib/libonnxruntime.so.1.28.0 "$STAGED/"
ln -sf libonnxruntime.so.1.28.0 "$STAGED/libonnxruntime.so.1"
ln -sf libonnxruntime.so.1 "$STAGED/libonnxruntime.so"
ls -la "$STAGED/"
echo "DONE"
