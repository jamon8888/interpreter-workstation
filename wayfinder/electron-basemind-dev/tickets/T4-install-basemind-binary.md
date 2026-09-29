# T4 — Install the real `basemind` binary on this workstation

## Question

The `basemind` npm package (or its `cargo install` equivalent) is not
currently installed in the repo's `node_modules/`. Without it,
`resolveBasemindBinary` (T3) cannot return a real path and the rest of
the Basemind flow cannot run. What is the correct install path for this
workstation, and does the installed binary actually execute?

## Context

The Basemind distribution is documented at `basemind/README.md` and
`basemind/npm-package/`. The shim
`basemind/npm-package/bin/basemind.js:7-34` documents the install
contract: an npm install + postinstall that downloads from GitHub
releases, or a `cargo install basemind` fallback. The binary
`basemind/target/` may already exist if the repo was built locally.

This is a **Task** ticket: it does manual work (running the install)
that is required before downstream tickets (T5, T6, T7) can make any
decision.

## Method

1. Check whether `basemind/target/release/basemind` (or `debug/basemind`)
   already exists; if so, the binary is already built and the only
   question is whether to use it directly or symlink it into
   `node_modules/.pnpm/basemind@…/node_modules/basemind/bin/`.
2. If not built, prefer `cargo install --path basemind` over npm — it
   gives a known location (`~/.cargo/bin/basemind`) without needing
   the npm package's `postinstall` to reach GitHub.
3. Verify: `basemind --version` (or `basemind --help`) prints something
   non-error.
4. Make the binary discoverable by T3's resolver: either install via
   npm in this repo (`pnpm add -D basemind`) or symlink the cargo
   binary into a location the resolver checks (e.g. `bin/basemind` at
   the repo root, gitignored).
5. Note the install path and the verification command in the ticket
   resolution.

## Acceptance

- `basemind --version` (or equivalent help command) exits 0.
- The install path is recorded in this ticket's resolution comment.
- T3's resolver (after its fix) returns this path on this machine.

## Resolution

**Status: CLOSED — no install needed.**

Binary was already at `basemind/target/debug/basemind` v0.28.0. T3's resolver finds it at path #1. No install steps needed.

Verification: `basemind --version` → `basemind 0.28.0`.
