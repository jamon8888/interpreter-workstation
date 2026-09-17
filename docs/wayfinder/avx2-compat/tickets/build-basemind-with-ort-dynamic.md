## Question

Build basemind from source with the `ort-dynamic` feature, linking against the AVX-free `libonnxruntime.so` built in the previous ticket.

Steps:
1. Ensure Rust toolchain is installed (check basemind's rust-toolchain.toml for pinned version)
2. Build basemind: `cargo build --release --features full,ort-dynamic` with `ORT_DYLIB_PATH` pointing to the custom `libonnxruntime.so`
3. Verify the resulting binary doesn't statically link AVX2 code: `objdump -d basemind | grep -c "avx"`
4. Bundle `libonnxruntime.so` alongside the binary
5. Test on this machine: run `basemind cpu-features` (if it exists) or `basemind code semantic "test" --rerank` in a test repo
6. Record: build time, binary size, whether it runs without SIGILL

**Blocked by**: [build-ort-sse2](build-ort-sse2.md) (need the custom ONNX Runtime `.so`)

**Blocking**: [test-basemind-on-avx2-less-cpu](test-basemind-on-avx2-less-cpu.md)
