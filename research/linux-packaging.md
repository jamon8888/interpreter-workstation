# Linux packaging with a locally-sourced basemind 0.29 binary

Research for issue #59 (part of map #55). Read-only investigation on branch
`basemind-restore`; nothing was built and no code was changed.

## Short answer

Ship the binary the same way the OIX runtime already ships: build basemind
from the local `basemind/` checkout, stage it under
`resources/basemind/linux-x64/`, and add a `linux:`-scoped `extraResources`
entry mapping that staging dir to `basemind/bin`. The runtime side needs no
change — `resolveBasemindBinary` already looks for
`basemind/bin/basemind` under `process.resourcesPath` first.

## extraResources wiring today

- `electron-builder.yml:32-34` has one global basemind entry:
  `from: node_modules/@jamon8888/basemind-fork/bin` → `to: basemind/bin`
  (added in commit `3bb6378`).
- The `linux:` section (`electron-builder.yml:250-267`, targets AppImage +
  deb, x64, `artifactName: ${productName}-linux-${arch}-${buildVersion}.${ext}`)
  has scoped entries for `oix`, `pdfcpu`, and `qwen-asr` — but **no basemind
  entry**. The oix pattern (`from: resources/oix/linux-${arch}` → `to: oix`)
  is the template to copy: a `resources/basemind/linux-${arch}` staging dir
  mapped `to: basemind/bin` keeps Linux packaging independent of npm.

## Packaged resolution path

- `server/utils/bundledRuntimePaths.ts:35-43` (`resolvePackagedResourceCandidates`)
  resolves to `process.resourcesPath/<segments>` with an
  `<execDir>/resources/<segments>` fallback; `:54-63`
  (`resolveBundledResourceCandidates`) appends source-checkout fallbacks.
- `server/utils/basemindManager.ts:27-29` calls it with
  `packagedSegments: ['basemind', 'bin', 'basemind']`, and `:11-22`
  (`findBasemindBinary`) also tries a `.exe` suffix. So the packaged lookup
  is exactly `$resources/basemind/bin/basemind` — matching the `to:
  basemind/bin` side of the extraResources entry. No resolver change is
  needed; only the missing file needs to be put there.

## What breaks today

- `npm view @jamon8888/basemind-fork` returns **404 Not Found** (verified
  against registry.npmjs.org), so no fresh `pnpm install` can ever produce
  `node_modules/@jamon8888/basemind-fork/bin`. Confirmed locally: that
  directory does not exist, and neither `package.json` nor `pnpm-lock.yaml`
  references the package.
- Consequence: the global extraResources `from:` points at a nonexistent
  path at package time, and the app ships with no `basemind/bin/` payload.
- At runtime the dev fallbacks (`basemindManager.ts:37-58` — two
  `node_modules` paths, then `~/.local/bin/basemind` added in `c1af747`,
  then `require('@jamon8888/basemind-fork').binaryPath`) save local dev:
  today `resolveBasemindBinary()` returns `/home/jamin/.local/bin/basemind`
  (`basemind 0.29.0`, 297 MB). In the packaged app those fallbacks do not
  exist, so resolution throws `[basemind] Binary not found`.

## Version-label drift (flag)

The working binary reports `0.29.0`, but `basemind/Cargo.toml` says
`0.28.0` and `basemind/CHANGELOG.md` tops out at `0.26.0`; `git -C basemind
describe` gives `v0.28.0-8-gbcdb1d7` and there is no `target/release`
binary in the checkout. Before staging, rebuild from the local checkout
and confirm `basemind --version` prints `0.29.0` so the label matches what
`~/.local/bin/basemind` already proves works.

## Complete path (proposed, not implemented)

1. `cargo build --release` in `basemind/` (local source, no registry).
2. Stage the result at `resources/basemind/linux-x64/basemd…/basemind`
   (i.e. `resources/basemind/linux-${arch}/` holding the `basemind`
   executable), mirroring `resources/oix/linux-x64/`.
3. Add to the `linux:` `extraResources` in `electron-builder.yml`:
   `from: resources/basemind/linux-${arch}` → `to: basemind/bin`.
4. Package: `pnpm run build:dist -- --linux AppImage deb --x64 --publish
   never` (`package.json:96`; `build:dist` also fetches
   oix/pdfcpu/qwen-asr `--current-platform` and builds the js-repl
   runtime first). Per-issue-#55 scope this stays local-only: no signing,
   no release workflow (`docs/releases.md` reserves those for official
   builds).
5. Boot proof: launch the `.AppImage` (AppImage runs with `--no-sandbox`
   via the `process.env.APPIMAGE` switch in `electron/main.ts:383`;
   the `.deb` instead relies on the pinned AppArmor profile,
   `electron-builder.yml:269-287`), then verify basemind is connected:
   `resolveBasemindBinary()` should return the `$resources/basemind/bin`
   path and the `basemind serve` MCP server should report healthy via
   `getBasemindServerStatus`. Note `pnpm run package:smoke`
   (`scripts/package-smoke.mjs`) currently only asserts the js-repl
   runtime and license files for `--linux dir` output — extend its
   resource-root check to `basemind/bin/basemind` for the automated gate.
6. Pre-commit floor per `AGENTS.md`: `pnpm typecheck`,
   `pnpm run test:unit`, `pnpm run test:vitest` (plus the existing
   `server/utils/basemindManager.vitest.test.ts`, which today only proves
   the dev fallback, not the packaged path).

## Sources

All claims above come from the files cited inline (`electron-builder.yml`,
`server/utils/bundledRuntimePaths.ts`, `server/utils/basemindManager.ts`,
`electron/main.ts`, `package.json`, `docs/releases.md`), the npm registry
404 for `@jamon8888/basemind-fork`, and local filesystem state
(`node_modules/@jamon8888/` absent, `~/.local/bin/basemind` = 0.29.0).
