## Question

Build ONNX Runtime from source without AVX2 on this machine, producing a `libonnxruntime.so` that works on the i5-2400S.

Steps:
1. Clone ONNX Runtime (pin to the version ort expects — check ort-sys's dist.tsv or Cargo.lock)
2. Build with: `./build.sh --config Release --build_shared_lib --parallel --skip_tests --cmake_extra_defines onnxruntime_ENABLE_CPUINFO=ON CMAKE_C_FLAGS="-mno-avx -mno-avx2 -mno-fma" CMAKE_CXX_FLAGS="-mno-avx -mno-avx2 -mno-fma"`
3. Verify the resulting `.so` doesn't contain AVX2 instructions: `objdump -d libonnxruntime.so | grep -c "avx"`
4. Test the `.so` loads and runs on this CPU: write a minimal C program that loads the `.so` and runs inference
5. Record: build time, binary size, CPU instructions used

**Blocked by**: [ort-crate-resolution](ort-crate-resolution.md) (need exact ONNX Runtime version)

**Blocking**: [build-basemind-with-ort-dynamic](build-basemind-with-ort-dynamic.md)
