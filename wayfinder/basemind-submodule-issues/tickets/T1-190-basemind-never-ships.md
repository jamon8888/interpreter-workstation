# T1: Basemind never ships with app

**GitHub:** [#190](https://github.com/jamon8888/interpreter-workstation/issues/190)
**Label:** bug (critical)
**Blocks:** T2 (#186)

## What

PII redaction is announced in the product (privacy shield, file-redaction
notice, `basemind.filesWillBeRedacted` copy), but the engine it depends
on is never delivered to the machine running the app.

`resolveBasemindBinary()` searches `PATH`, `basemind/target/{debug,release}`,
`~/.cargo/bin`, and npm — none exist for an installed user. The resolver
returns `''`, `registerBasemindServer()` bails, and every `detectPii` call
fails into the regex fallback.

### Comparison with OIX

| | OIX | basemind |
| --- | --- | --- |
| Download script | `scripts/download-oix.mjs` (`download:oix`) | none |
| Staging directory | `resources/oix/<platform>` | none |
| `extraResources` entry | `electron-builder.yml:175` | none |
| Reaches an end user | yes | no |

## What is needed

1. A `download:basemind` script, modelled on `download-oix.mjs`, staging
   into `resources/basemind/<platform-arch>/`.
2. `extraResources` entries per platform in `electron-builder.yml`.
3. `resolveBasemindBinary()` extended to look in `process.resourcesPath`
   first.
4. A build-time step so packaging jobs populate the directory.

## Blocked on

A published basemind binary containing the `redact_text` MCP tool.
v0.29.0 predates it by 34 commits. Items 1–3 can be written before
that release exists; only pinning the version and switching CI on cannot.

## Archive layout note

Published tarballs are flat: the `basemind` executable sits beside ~94
`.dylib` files. Staging must keep them together, and the resolver must
point at the binary in place rather than copying it out.

## Resolution

**Commit:** `3d3447a` on `feat/workspace-search-rag`

All four items implemented:

1. `scripts/download-basemind.mjs` — downloads from `jamon8888/basemind`
   releases, stages into `resources/basemind/<platform>/`.
2. `electron-builder.yml` — per-platform `extraResources` entries
   (replaced broken `@jamon8888/basemind-fork/bin` npm reference).
3. `server/utils/basemindManager.ts` — `findBasemindBinary()` checks
   `process.resourcesPath/basemind/basemind` first.
4. `package.json` — `download:basemind` wired into `build:dist`.

**Still blocked on:** a published basemind binary containing `redact_text`
MCP tool. v0.29.0 predates it. The download/wiring infrastructure is
ready; only pinning the version and switching CI on needs a newer build.
