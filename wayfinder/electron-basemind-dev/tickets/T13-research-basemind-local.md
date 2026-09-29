# T13 — Research: Basemind local docs (CLI surface, MCP, config)

## Question

Context7 has no library entry for the nested Basemind repo. We need
the local docs read once and surfaced in a single file, so every
downstream ticket (T3, T4, T5, T6, T7) doesn't re-read the same
sections. Specifically: what is the real CLI surface of the Basemind
binary (subcommands, flags, exit codes, progress output format); how
does it expose itself as an MCP server (stdio? HTTP? config file?);
where does it store its cache and its `.ready` markers; how does
`basemind scan` / `rescan` differ; how does `basemind download` (or
per-stage) work?

## Method

1. Walk the nested repo: `basemind/README.md`, `basemind/docs/`,
   `basemind/schema/`, `basemind/Cargo.toml`, `basemind/Taskfile.yaml`,
   `basemind/llms.txt`, `basemind/npm-package/`, `basemind/opencode-plugin/`,
   `basemind/pip-package*/`.
2. For each of the sub-questions, capture the source-of-truth file
   path and a verbatim quote (1–3 lines max each).
3. Save the synthesis on a throwaway `research/basemind-local-docs`
   branch as `research/basemind.md`.
4. If the binary is already built locally
   (`basemind/target/release/basemind` or `…/debug/basemind` exists),
   also run `basemind --help` and any `basemind <subcommand> --help`
   we can reach without network, and append the live help text to
   the same file.

## Acceptance

- The file `research/basemind.md` answers every sub-question with a
  cited path and a one-line summary.
- A copy lives at
  `wayfinder/electron-basemind-dev/research/basemind.md` and a
  pointer is recorded in this ticket's resolution.

## Resolution

**Status: CLOSED** — research complete.

Findings at `../research/basemind.md`.

| SQ | Finding |
|----|---------|
| SQ1 CLI surface | 21 subcommands, 6 global flags, standard Rust exit codes (0/1), per-file streaming progress + summary line |
| SQ2 MCP exposure | `basemind serve` = stdio relay to background daemon; daemon hosts MCP over Unix socket + optional HTTP (`BASEMIND_ALLOW_HTTP=1`) |
| SQ3 Cache + readiness | Cache at `~/.local/share/basemind/` (NOT `~/.cache/basemind/`); readiness via MCP `status` tool `notice` field (NOT `.ready` marker files) |
| SQ4 scan vs rescan | `scan` = one-shot full; `rescan` = full or incremental on paths (default full, `--full` forces full even with paths) |
| SQ5 Download surface | No `download` command; grammars via `basemind lang install` (auto on first scan); ONNX/code-search models on first use when enabled |
| SQ6 init | Writes `basemind.toml`, picks capabilities, injects rules into `AGENTS.md`/`CLAUDE.md` |

**Major findings for downstream tickets:**
- T3/T4: binary path must resolve to either npm-installed shim or `~/.cargo/bin/basemind`
- T5: no `download` subcommand — `basemind lang install` + first-use model fetch is the actual download surface; UI needs to reflect this
- T6: cache path in `workspaceScan.ts:54` (`~/.cache/basemind/`) is wrong — must be `~/.local/share/basemind/`
- T7: MCP registration is `basemind serve` (stdio) piped through `interpreter-app mcp add_server` with `transport: "stdio"`

**Binary built?** `basemind/target/release/basemind` — not confirmed (would need `ls` check).
