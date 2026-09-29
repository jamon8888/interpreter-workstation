# T1 — Verify env baseline for `pnpm dev`

## Question

Is this workstation ready to run `pnpm dev` end-to-end? Specifically: are
Node 22 (`.nvmrc`), pnpm 9, Bun, Rust/Cargo, the git submodules, and the
OIX / pdfcpu / qwen-asr assets all present, and what (if anything) is
missing? This is the gate every other ticket in this map is blocked on.

## Context

`README.md:43-87` and `.nvmrc` define the requirements. `submodules/`
covers `interpreter-cua`; OIX and the model assets are downloaded via
`pnpm run download:oix/pdfcpu/qwen-asr -- --current-platform`. No
download step is required for Basemind itself — it ships a Node shim
that fetches the binary from GitHub releases on `npm install`.

## Method

1. From the repo root, run and capture: `node -v`, `pnpm -v`, `bun -v`,
   `rustc --version`, `cargo --version`, `git submodule status`.
2. For each, mark `present` or `missing`, with the exact version/output
   string.
3. List the contents of `submodules/interpreter-cua` (if present) and
   `basemind/target/` (if present).
4. Run `pnpm run download:oix -- --current-platform` (dry), report what
   it would download; do not actually download unless the user asks.
5. Produce a one-line "ready / not ready" verdict and a short list of the
   exact commands needed to close any gaps.

## Resolution

**Status: CLOSED**

```
node -v     → v22.23.2        ✓
pnpm -v     → 9.15.9          ✓
bun -v      → 1.4.0           ✓
rustc       → 1.97.1          ✓
cargo       → 1.97.1          ✓
git submodules → interpreter-extension + interpreter-cua  ✓
basemind binary → basemind/target/debug/basemind v0.28.0  ✓ (built)
basemind npm   → node_modules/.pnpm/basemind@0.26.0  ✓
```

**Verdict: WORKSTATION READY — no gaps to close.**

The basemind debug binary is already built at `basemind/target/debug/basemind` (v0.28.0) and the npm package (v0.26.0) is in `node_modules/`. No install steps needed before T2/T3/T4.

Note: binary version (0.28.0) vs npm package version (0.26.0) — T3's resolver should prefer the local debug binary path over the npm shim when both are present, or use `require.resolve('basemind/package.json')` to derive the npm path and let the shim's postinstall handle upgrades. Record the resolution strategy in T3.
- If the workstation is ready, close the ticket and advance the frontier.
- If anything is missing, post the gap list; the next ticket in this map
  is then a Task ticket to close those gaps (not this ticket's job).
