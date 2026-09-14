# T2: Basemind absent from CI

**GitHub:** [#186](https://github.com/jamon8888/interpreter-workstation/issues/186)
**Label:** bug
**Blocked by:** T1 (#190)

## What

`tests/composer-file-redaction.spec.ts` is branch-tolerant: it accepts
either a tokenized send or a blocked send with a toast, because NER
availability varies by machine. In CI it is always the blocked branch,
and no change to the test can alter that.

### Three missing pieces

1. **`basemindDownload` is a stub** — `server/handlers/basemindDownload.ts`
   yields fake progress and downloads nothing. All three stages run the
   same empty loop.

2. **CI never builds basemind** — `.github/workflows/ci.yml` has no
   `cargo build` step for basemind. Source arrives (`submodules: recursive`)
   but source is not a binary.

3. **Resolver path mismatch** — `resolveBasemindBinary()` probes
   `basemind/target/debug` and `basemind/target/release` relative to
   repo root. The submodule lives at `submodules/basemind`.

### Consequence

`resolveBasemindBinary()` returns `''` in CI → MCP server never
registered → `detectPii` throws → `nerFailed` always true → E2E test
takes the blocked arm every run. The tokenized payload assertion has
never executed on CI hardware.

## What is needed (in order)

- [x] Replace `downloadResource` stub with real fetch of pinned NER
      model, or document that basemind downloads on first use and make
      that path observable.
- [ ] Build basemind submodule in CI (or ship prebuilt binary via
      `download:oix`-style script).
- [x] Reconcile `resolveBasemindBinary()` search paths with
      `submodules/basemind`.
- [ ] Make `composer-file-redaction.spec.ts` verify `isPiiModelReady()`
      and assert the tokenized arm specifically, per #163.

### Resolution

**Commit:** `985ffc4` on `feat/workspace-search-rag`

- Item 1 resolved: `basemindDownload` handler now checks
  `isModelResourceReady()` instead of faking progress.
- Item 3 resolved: resolver now probes `submodules/basemind/target/`
  instead of `basemind/target/`.
- Item 2 blocked: CI lives in a separate private ops repository, not
  this repo. Requires coordination with ops.
- Item 4 blocked: needs basemind available in CI (item 2).

## Cost note

Real model download inside CI E2E lane. Weigh size/time budget:
download in-test, pre-warm runner cache, or gate strict assertion
behind readiness check that skips cleanly when model is absent.
