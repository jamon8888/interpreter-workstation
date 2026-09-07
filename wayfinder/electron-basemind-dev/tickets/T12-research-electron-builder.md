# T12 — Research: electron-builder 26.15.0 + `@electron/rebuild` 4.2.0 (packaging context)

## Question

This map's destination is `pnpm dev`, not packaged output, but T2's
"build" step (`scripts/build-with-lock.cjs --dev`) and the
`@electron/rebuild` step matter for native module compatibility. What
is the canonical configuration in electron-builder 26.15.0 +
`@electron/rebuild` 4.2.0 for: (a) `npmRebuild: false` (already set
in `electron-builder.yml:1-9`); (b) `electronRebuildConfig` for the
Basemind npm package (or any native addon); (c) `asarUnpack` patterns
for a sibling Rust binary that the app launches via
`child_process.spawn`? The T3/T4/T7 wiring depends on the binary
being findable at runtime in both unpackaged and packaged modes.

## Method

1. `context7_resolve_library_id` for "electron-builder" and pick the
   highest-reputation match.
2. `context7_query_docs` for `npmRebuild` / `electronRebuildConfig` /
   `asarUnpack`.
3. Save findings on a throwaway `research/electron-builder` branch as
   `research/electron-builder.md`.
4. Compare against `electron-builder.yml` and flag any gaps for the
  packaged case (out of scope to fix here, but worth recording so a
  future effort doesn't trip on them).

## Acceptance

- The sub-questions are answered with version-stamped citations.
- A copy of the file lives at
  `wayfinder/electron-basemind-dev/research/electron-builder.md` and
  a pointer is recorded in this ticket's resolution.

## Resolution

**Status: CLOSED** — research complete.

Findings at `../research/electron-builder.md`.

| Sub-Q | Answer |
|--------|--------|
| (a) `npmRebuild: false` | Top-level v26 key; electron-builder logs `skipped dependencies rebuild` and returns early; correct for N-API/pre-staged deps |
| (b) `electronRebuildConfig` | v26 uses top-level keys (`npmRebuild`, `buildDependenciesFromSource`, `nativeRebuilder`); v27 renames under `nativeModules.*` — v26 keys are right for this repo |
| (c) sibling binary via `spawn` | Needs `extraResources` resolved at runtime via `process.resourcesPath`; `asarUnpack` is only for in-ASAR native modules (`require()`) |
| (d) `@electron/rebuild` API | `rebuild({ buildPath, electronVersion, arch, platform, force, mode, buildFromSource })`; CLI: `electron-rebuild --version --module-dir` |

**Comparison against `electron-builder.yml`**: consistent for cases in scope. Out-of-scope gaps recorded in MAP.md **Out of scope**.
