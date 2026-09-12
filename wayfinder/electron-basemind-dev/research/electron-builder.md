# Research: electron-builder 26.15.0 + `@electron/rebuild` 4.2.0 (packaging context)

Scope: T12 in `wayfinder/electron-basemind-dev/tickets/T12-research-electron-builder.md`.
This map's destination is `pnpm dev` (unpackaged), but T2's
`scripts/build-with-lock.cjs --dev` and the `@electron/rebuild` step matter
for native-module compatibility. Findings below are version-stamped to
electron-builder 26.15.0 (the version pinned in this repo) and
`@electron/rebuild` 4.2.0.

Docs were fetched via context7 MCP. Library IDs:

- electron-builder: `/electron-userland/electron-builder` (High reputation, 1248 snippets)
- @electron/rebuild: `/electron/rebuild` (High reputation, 417 snippets)

## (a) `npmRebuild: false`

**Citation (electron-builder, NativeModulesConfig, default `true`):**
> "Whether to rebuild native Node.js modules for the target Electron version and architecture before packaging. When `true` (the default), electron-builder runs `@electron/rebuild` against the app's `node_modules` directory to ensure all native modules are compiled against the correct Electron ABI. Set to `false` to skip this step entirely — useful when native modules are pre-built elsewhere in your pipeline or when the app has no native dependencies."
> — `packages/app-builder-lib/src/configuration.ts` (`npmRebuild` field on `NativeModulesConfig`).

**Runtime skip (electron-builder, `packager.ts`):**
> "if (config.nativeModules?.npmRebuild === false) { log.info({ reason: 'nativeModules.npmRebuild is set to false' }, 'skipped dependencies rebuild'); return }"
> — `packages/app-builder-lib/src/packager.ts`.

**CLI override syntax:**
> `electron-builder --config.nsis.unicode=false` (dot-notation; applies to `nativeModules.npmRebuild` too).
> — `packages/electron-builder/src/builder.ts`.

**`beforeBuild` hook (alternative):** fires before native deps install/rebuild; resolving to `false` skips the step entirely — useful when `node_modules` are managed externally.
> — `website/docs/features/hooks.md` and `website/docs/features/build-lifecycle.md`.

**Summary:** `npmRebuild: false` skips electron-builder's invocation of `@electron/rebuild` and logs `skipped dependencies rebuild`. This is the correct escape hatch when native modules are N-API (ABI-stable) or pre-staged by another step (e.g. the repo's own `scripts/build-with-lock.cjs --dev`).

## (b) `electronRebuildConfig` (v26 key) / `rebuildMode` (v27 key)

**Citation (v27 migration note on native-module config shape):**
> "// Before (v26) { 'build': { 'buildDependenciesFromSource': true, 'nodeGypRebuild': false, 'npmRebuild': true, 'nativeRebuilder': 'parallel' } } // After (v27) { 'build': { 'nativeModules': { 'buildDependenciesFromSource': true, 'nodeGypRebuild': false, 'npmRebuild': true, 'rebuildMode': 'parallel' } } }"
> — `website/docs/migration/v27-breaking-changes.md`.

**Snippet (how `buildDependenciesFromSource` flows into `@electron/rebuild`):**
> "const effectiveOptions: RebuildOptions = { buildFromSource: config.nativeModules?.buildDependenciesFromSource === true, additionalArgs: asArray(config.npmArgs), ...options }"
> — `packages/app-builder-lib/src/util/installOrRebuild.ts`.

**Summary:** in electron-builder **26.x** the configuration shape is the v26 form (`buildDependenciesFromSource`, `nodeGypRebuild`, `npmRebuild`, `nativeRebuilder`); these were renamed and grouped under `nativeModules.*` in v27. The fields map 1:1 onto `@electron/rebuild`'s `RebuildOptions`. Since this repo pins electron-builder 26.15.0, the v26 keys are the right surface.

## (c) `asarUnpack` for a sibling Rust binary launched via `child_process.spawn`

**Citation (asar.unpack for native modules):**
> "asar: unpack: [ 'node_modules/your-module/**', '**/*.node' ]" — pattern documented for any prebuilt binary that Electron's Node loader can't read directly out of an ASAR.
> — `website/docs/troubleshooting.md` ("Unpack native modules from ASAR").

**Citation (extraResources vs extraFiles vs asar):**
> "`extraResources` copies files to the resources directory (`MyApp.app/Contents/Resources` on macOS or `resources/` on Windows/Linux), which is suitable for native binaries or CLI tools accessible at runtime via `process.resourcesPath`."
> "Note that the 'from' path in FileSet configurations is relative to the app directory for 'files', but relative to the project root for 'extraResources` and `extraFiles'."
> — `website/docs/contents.md`.

**Citation (`mac.binaries` are NOT glob-able):**
> "There is no glob expansion anywhere in this pipeline — only explicit paths are accepted." Each `binaries` entry is checked as an absolute path via `statOrNull`; if it doesn't exist, it is resolved relative to `appPath`.
> — `packages/app-builder-lib/src/targets/mac/MacTargetHelper.ts`.

**Citation (Linux `executableArgs`; deb `appArmorProfile` only on LinuxTargetSpecificOptions, not on `linux:` root):** documented in `packages/app-builder-lib/src/options/linuxOptions.ts` and `PlatformSpecificBuildOptions.ts`.

**Summary:** the canonical pattern for a sibling binary launched via `child_process.spawn` is `extraResources` (places the binary under `process.resourcesPath/<to>/<binary>`, outside the ASAR). `asarUnpack` only matters for files that must remain *inside* the ASAR root path the app expects — for a separately-spawned binary, `extraResources` is the right channel and the binary should be invoked by absolute path resolved from `process.resourcesPath`. For Linux AppImage the `executableArgs` field lets the runtime pass flags to the wrapped binary.

## (d) `@electron/rebuild` 4.2.0 API

**Library ID:** `/electron/rebuild`.

**Top-level signature (`rebuild()`):**
> "function rebuild(options: RebuildOptions): RebuildResult" — rebuilds native Node.js modules against a specified Electron version. Returns a promise with an attached `lifecycle` EventEmitter (`start`, `modules-found`, `module-found`, `module-done`, `module-skip`).
> — `_autodocs/api-reference/rebuild.md`.

**Key `RebuildOptions` fields (all relevant to this repo's Basemind npm package):**
- `buildPath` (string, required) — absolute path to `node_modules`.
- `electronVersion` (string, required) — target Electron version.
- `arch` (`x64` | `arm64` | `armv7l`, optional, default `process.arch`).
- `platform` (`linux` | `darwin` | `win32`, optional, default `process.platform`).
- `extraModules` (string[], default `[]`) — modules to rebuild in addition to detected ones.
- `onlyModules` (string[] | null, default `null`) — restrict to a whitelist.
- `ignoreModules` (string[], default `[]`) — skip a blacklist.
- `force` (boolean, default `false`) — rebuild even if already current.
- `mode` (`sequential` | `parallel`, default `sequential`; `parallel` is the default on macOS/Linux CLI).
- `buildFromSource` (boolean) — skip prebuild download and compile from source. This is the field electron-builder's `buildDependenciesFromSource` flips.
- `useElectronClang` (boolean) — guarantees compiler compatibility.
- `disablePreGypCopy` (boolean) — skip the `.node` copy step.
- `headerURL` (string, default `https://www.electronjs.org/headers`) — header tarball location.
- `debug` (boolean), `useCache` / `cachePath` (experimental), `projectRootPath` (monorepos), `forceABI` (nightlies), `prebuildTagPrefix` (default `'v'`).

**CLI (`electron-rebuild`):**
> `electron-rebuild --version [version] --module-dir [path]` — flags: `-f/--force`, `-a/--arch`, `-m/--module-dir`, `-w/--which-module`, `-o/--only`, `-e/--electron-prebuilt-dir`, `-d/--dist-url`, `-t/--types`, `-p/--parallel`, `-s/--sequential`, `-b/--debug`, `--prebuild-tag-prefix`, `--force-abi`, `--use-electron-clang`, `--disable-pre-gyp-copy`, `--build-from-source`.
> — `README.md`.

**Summary:** `@electron/rebuild`'s `rebuild(options)` function takes `buildPath` + `electronVersion` and optionally an arch/platform/force/mode. For the Basemind npm package (or any prebuilt native addon), the right invocation is `rebuild({ buildPath: appDir, electronVersion, arch, force: true, mode: 'sequential' })` when running from a build script outside electron-builder. Because this repo sets `npmRebuild: false`, electron-builder won't call this — `scripts/build-with-lock.cjs --dev` is the place that would.

## Comparison against `electron-builder.yml`

| Concern | `electron-builder.yml` state | Packaged-mode verdict |
|---|---|---|
| `npmRebuild: false` (top-level, v26 shape) | Set at `electron-builder.yml:11-17` with a comment explaining the reason (hosted Windows runners, N-API). | **Correct for v26.** Matches the documented skip path. No v27 `nativeModules.npmRebuild` nesting required. |
| `electronRebuildConfig` / `nativeRebuilder` | Not set. | **Consistent with `npmRebuild: false`** — since the rebuild step is skipped, `nativeRebuilder` is a no-op. If a future effort ever flips `npmRebuild: true`, add `nativeRebuilder: parallel` for macOS/Linux and `sequential` for Windows (CLI defaults). |
| `asarUnpack` | `electron-builder.yml:18-30` lists `node_modules/@img/sharp-libvips-*/**`, `@parcel/**`, `@vscode/ripgrep/**`, `@openinterpreter/**`, `@resvg/**`, `@napi-rs/**`, `whatsapp-rust-bridge/**`, `sherpa-onnx/**`, `onnxruntime-node/**`, plus `**/*.node` and `**/*.dylib`. | **OK for the in-ASAR native modules the app loads via `require()`** (sharp, ripgrep prebuilds, napi-rs addons, OIX runtime shared libs). However, **there is no entry for a sibling Rust binary launched via `child_process.spawn`**. The current pattern puts those under `extraResources` (per-platform `mac.extraResources`, `win.extraResources`, `linux.extraResources`) — that's correct (binary lives outside ASAR, reachable via `process.resourcesPath`). |
| Basemind npm native addon | Not enumerated in `asarUnpack`. | **Gap (out of scope for this map):** if Basemind ships a `.node` addon as an npm dependency, it must appear in `asarUnpack` (a `**/*.node` catch-all is *not* sufficient when the addon lives under a nested scope not yet matched, e.g. `node_modules/basemind-*/**`). Document for the packaged map; dev mode loads from disk so this only matters when packaging. |
| Linux `appArmorProfile` | Set under `deb:` (`electron-builder.yml:285`), not under `linux:`. | **Correct** — `appArmorProfile` is a `LinuxTargetSpecificOptions` key, not valid on the `linux:` root in v26. Inline comment at `electron-builder.yml:283-284` already states this. |
| `afterPack` | `./scripts/electron-builder/afterPack.cjs` (`electron-builder.yml:133`). | Lives outside the scope of T12, but it's the right hook to fix the absent `asarUnpack` entry above if the Basemind addon ever lands. |

### Gap list (recorded, **out of scope** for this map)

1. **No `asarUnpack` entry for a future Basemind npm package native addon.** Today dev mode loads the addon from disk; packaged mode would fail with the documented "Unpack native modules from ASAR" error unless an entry like `node_modules/@basemind/**` (or a `**/*.node` catch-all that actually matches) is added. YAGNI until Basemind ships an npm package — record, don't fix.
2. **`nativeRebuilder: parallel` not set.** Safe because `npmRebuild: false` makes it a no-op; flip alongside any future `npmRebuild: true`.
3. **No explicit `asar: unpack` glob for a sibling Rust binary.** Not needed — those binaries are intentionally staged under `extraResources` so they're *outside* the ASAR and reachable via `process.resourcesPath`. The runtime T3/T4/T7 wiring must use `process.resourcesPath`-relative absolute paths, not relative paths from `__dirname`.
4. **`@electron/rebuild` is not invoked from `scripts/build-with-lock.cjs --dev`.** Since `npmRebuild: false` short-circuits electron-builder, any future cross-ABI native addon (e.g. a non-N-API Basemind prebuild) needs to be rebuilt by hand via `@electron/rebuild`'s programmatic API or CLI before the package step. Not a gap today; record for the packaged map.

## Versions referenced

- electron-builder **26.15.0** (pinned in this repo).
- `@electron/rebuild` **4.2.0** (pinned in this repo).
- Docs reflect the upstream `main` branches at fetch time. v26 keys (`buildDependenciesFromSource`, `nodeGypRebuild`, `npmRebuild`, `nativeRebuilder`) match this repo's `electron-builder.yml`; the v27 rename to `nativeModules.*` is informational only.