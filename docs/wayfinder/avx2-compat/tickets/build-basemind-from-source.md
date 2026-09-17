## Question

What's the full process to build basemind from source on this machine, and what does the resulting binary look like?

1. What are the build prerequisites? (Rust toolchain version, system libraries, etc.)
2. What cargo features does the released binary use? (check the download script or CI config in the basemind repo)
3. How long does a clean build take on this hardware (i5-2400S, 4 cores)?
4. Does the build download ONNX Runtime automatically (via the `ort` crate), or is it expected to be pre-installed?
5. Can we build with `ort-dynamic` to link against a system `libonnxruntime.so` instead of bundling?
6. What's the final binary size?
7. Are there any build scripts or CI configs in the basemind repo that show the exact release build process?

This tells us whether rebuilding basemind is a realistic path or whether we need to work at a different layer.

**Blocked by**: [ort-crate-resolution](ort-crate-resolution.md) (need to know ort's linking model before we can plan the basemind build)
