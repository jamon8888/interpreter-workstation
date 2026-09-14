# Map: Basemind submodule integration issues

**Parent map:** [#174](https://github.com/jamon8888/interpreter-workstation/issues/174) — document backend seam

## Destination

Basemind ships with the installed Electron app (binary bundled via
electron-builder), CI exercises the PII redaction path end-to-end, the
Rust submodule supports ingest-time redaction during scan, and document
searches use the BM25 keyword lane. Installed users get working PII
redaction without needing a local Rust toolchain.

## Notes

- Domain: Basemind is a Rust submodule at `submodules/basemind/`
  (separate git history, forked from `Goldziher/basemind`). The Electron
  app consumes it as a binary via `basemindManager.ts`. The `documents`
  feature flag gates the PII redaction pipeline (xberg + ONNX NER).
- Skills every session should consult:
  - `superpowers:systematic-debugging` — any ticket that surfaces a bug
  - `superpowers:verification-before-completion` — before closing any ticket
  - `ponytail` — default mode; use stdlib/native first, smallest diff
  - `context7-mcp` — for electron-builder docs if wiring changes
  - `rust-skills` — for Basemind Rust submodule work (T3 #183, T4 #184)
- Standing preferences:
  - Use `pnpm`; never add a dependency for what stdlib covers.
  - Real binary, no stubs. If a path is stubbed, that is a ticket
    finding, not a "skip it" signal.
  - No telemetry, no proprietary endpoints — community distribution only.
  - One runnable check per non-trivial change.
- Tracker: GitHub issues on `jamon8888/interpreter-workstation`.
  Local wayfinder tickets at `wayfinder/basemind-submodule-issues/`.

## Tickets

| Wayfinder | GitHub | Title | Status |
|-----------|--------|-------|--------|
| T1 | [#190](https://github.com/jamon8888/interpreter-workstation/issues/190) | Basemind never ships with app | implemented (3d3447a), blocked on newer basemind release |
| T2 | [#186](https://github.com/jamon8888/interpreter-workstation/issues/186) | Basemind absent from CI | partially resolved (985ffc4), CI build blocked (ops repo) |
| T3 | [#183](https://github.com/jamon8888/interpreter-workstation/issues/183) | Ingest-time redaction in basemind | implemented (a9be94f), PR #16 open |
| T4 | [#184](https://github.com/jamon8888/interpreter-workstation/issues/184) | Docs BM25 lane in basemind | open, unblocked (part of #174) |

## Blocking

```
T1 (#190) ─── T2 (#186)
T3 (#183) — independent (part of parent #174)
T4 (#184) — independent (part of parent #174)
```

- **T1** (never ships) — implemented in `3d3447a`. Download script,
  electron-builder wiring, and resolver all in place. Blocked on a
  published basemind binary containing `redact_text` MCP tool (v0.29.0
  predates it by 34 commits). Infrastructure ready; only version pinning
  and CI switch remain.
- **T2** (absent from CI) — resolver fix (`985ffc4`) and download stub
  fix already landed. CI build step blocked: CI lives in a separate
  private ops repository, requires coordination. Test assertion update
  (#163) blocked on CI build.
- **T3** (ingest-time redaction) — unblocked; Rust submodule work.
  Decisions #177 (pseudonymization mechanism) and #178 (vault key-space
  unification) are closed and feed into this.
- **T4** (docs BM25 lane) — unblocked; Rust submodule work.
  Decision #179 (document search surface) is closed and feeds into this.

**Frontier (open, unblocked):** T3, T4.
T1 implemented, awaiting release with `redact_text`.
T2 partially resolved (resolver + download fix landed); CI build blocked
(ops repo), test assertion blocked on CI.

## Decisions so far

<!-- index only: one line per closed ticket, then the link. -->

- [#177](https://github.com/jamon8888/interpreter-workstation/issues/177): Ingest-time scan redaction chosen over .redacted/ shadow files.
- [#178](https://github.com/jamon8888/interpreter-workstation/issues/178): Vault key-space unified — extraction blobs keyed by sanitized workspace-relative path.
- [#179](https://github.com/jamon8888/interpreter-workstation/issues/179): Upstream BM25 lane for documents (mirroring code search RRF fusion).

## Not yet specified

<!-- in-scope fog; graduates to tickets as the frontier advances. -->

- **Basemind version pinning**: which release/tag to download. v0.29.0
  predates `redact_text`; need a newer build or a custom release.
- **Cross-platform binary matrix**: linux-x64, macos-arm64, macos-x64,
  windows-x64. `package-release.sh` handles all four.
- **ONNX runtime bundling**: `documents` feature needs ONNX Runtime.
  Release script vendors it for Intel macOS; Linux needs the shared lib.
- **Test wiring**: `composer-file-redaction.spec.ts` needs to assert the
  tokenized arm once CI can prove NER availability (#163).

## Out of scope

<!-- destination-adjacent work ruled out of this map. -->

- OIX app-server local testing — separate effort.
- Browser-extension and computer-use submodule work.
- Product website (separate repository).
- Replacing or refactoring Basemind itself — we consume the binary.
- Voice/live providers and other opt-in runtime features.
