# Basemind Local Research — CLI, MCP, Cache, Scan/Rescan, Download

Sources walked: `basemind/README.md`, `basemind/src/main.rs`, `basemind/src/store_layout.rs`,
`basemind/src/stdio_relay.rs`, `basemind/src/comms_cli.rs`, `basemind/src/render.rs`,
`basemind/llms.txt`, `basemind/Taskfile.yaml`, `basemind/schema/`.

Binary found at `basemind/target/debug/basemind`; live `--help` output appended below.

---

## SQ1 — CLI surface (subcommands, flags, exit codes, progress output)

**Subcommands** (21 total):
`init`, `scan`, `rescan`, `watch`, `code`, `git`, `graph`, `memory`, `web`,
`admin`, `hook`, `lang`, `compress-output`, `delta`, `checkpoint`, `detect-waste`,
`serve`, `statusline`, `cache` (+ `agents`, `workspace`, `comms`, `daemon` with `--features comms`)

**Global flags**: `--root`, `--quiet` / `-q`, `--verbose` / `-v`, `--no-color`, `--json`, `--view <working|staged|rev-<sha7>>`

**Exit codes**: No explicit custom exit codes. `Result<()>` propagates → `0` on Ok, `1` on Err (standard Rust). The `stdio_relay` module defines `BACKEND_RESTARTED_CODE: i64 = -32001` for JSON-RPC error responses (not process exit).

> "File-watcher and code-map generator using tree-sitter" — `src/main.rs:26`

**Progress output format** (scan/watch): per-file lines streamed to stdout as files are absorbed,
then a summary line:
```
scanned  updated  reused  warn  unchanged  failed  skipped  removed
```
Colors: green = updated, yellow = warn/removed, red = failed. No `.ready` marker exists.

---

## SQ2 — MCP server (stdio? HTTP? config file?)

**Transport**: `basemind serve` is a **thin stdio↔daemon relay** — it ensures the background daemon is up, then pumps this process's stdin/stdout to the daemon's Unix-socket relay. The daemon is the **actual MCP server**, hosting the router over BOTH the Unix-socket relay and a streamable-HTTP front-end.

**HTTP MCP**: opt-in only — set `BASEMIND_ALLOW_HTTP=1` in the **daemon's environment** (not the relay's). When enabled, the daemon binds HTTP on loopback and publishes the bearer token as line 2 of `<comms_dir>/http.addr`.

**MCP config** (JSON, stdio):
```json
{ "mcpServers": { "basemind": { "command": "basemind", "args": ["serve"] } } }
```
Plugin manifests use the same. No config file for MCP itself — transport is wired by the host tool.

> "The daemon can additionally serve MCP over streamable HTTP on loopback, but that front-end is **opt-in**" — `README.md:456`

> "`basemind serve`: a thin stdio↔daemon relay, not a server in its own right. The comms daemon is the sole MCP server" — `src/main.rs:754–755`

---

## SQ3 — Cache location and `.ready` markers

**Cache root** (global, machine-wide):
- Linux: `~/.local/share/basemind/`
- macOS: `~/Library/Application Support/basemind/`
- Override: `BASEMIND_DATA_HOME` env var

**Layout**: `~/.local/share/basemind/cache/{blobs,workspaces/<workspace_key>}/`

**Markers** (all inside the per-workspace cache dir):
- `workspace.json` (`WORKSPACE_MARKER_FILE`) — canonical worktree root + timestamp; proves the hashed dir name corresponds to a real repo
- `status.json` (`STATUS_SIDECAR_FILE`) — file count, blob count, last-scanned Unix epoch; written after every working-view scan/rescan so the statusline avoids opening the Fjall index
- `.lock` + `.lock.meta` — writer lock + holder metadata (command/pid)

**No `.ready` marker exists.** Readiness is reported at the **MCP protocol level** via the `status` tool response: a `notice` object with `state` = `warming_up` | `building_index` | `rescanning`.

> "A single background daemon per machine is the sole writer to that cache." — `README.md:435`

> "`status.json` sidecar … written after every working-view scan/rescan so a shell statusline can render the rich per-repo line by reading one tiny JSON file" — `src/store_layout.rs:43–46`

---

## SQ4 — `scan` vs `rescan` difference

| | `scan` | `rescan` |
|---|---|---|
| **Scope** | One-shot full index | Full working tree, or incremental on given `PATH…` |
| **Staged index** | `--staged` flag | Not available |
| **Arbitrary rev** | `--rev <sha>` flag | Not available |
| **Incremental paths** | Not available | `rescan [PATH…]` with paths = incremental |
| **Full re-index** | Always full | `--full` flag forces full even with paths |
| **Lock holder** | `LockHolder::Scan` | `LockHolder::Rescan` |

Both sync the git-history index after scanning unless `--no-git-history`.

> "`scan`: Run a one-shot scan over the repository and write the code map." — `src/main.rs:68`

> "`rescan`: Re-index the working tree (full) or only the given paths (incremental). Use after edits, or to rebuild a stale/empty index without starting the server." — `src/main.rs:69–71`

---

## SQ5 — Download surface

**No `basemind download` subcommand.** Downloads are triggered implicitly:

1. **Tree-sitter grammars** — auto-downloaded on first scan that needs a given language, via `ensure_grammars()`. Explicit management: `basemind lang list | install | clean`. Bootstrap summary renders `▼ downloaded N grammar(s) (names)` to stdout.

2. **ONNX reranker model** for `code semantic` search — downloaded on first `semantic` call when `code_search.embed = true` (off by default). No CLI hook; triggered inside the MCP tool handler.

3. **Embedding models** (LanceDB) — downloaded on first document embed when `documents.embed = true`.

> "The Homebrew / npm / pip / GitHub downloads include the full feature set — documents, OCR, search, web crawl, shared memory, and agent comms — so the first run downloads the models it needs." — `README.md:283–284`

---

## SQ6 — `basemind init` (onboarding)

`basemind init` writes a commented `basemind.toml` scaffold at the repo root, lets the user pick capabilities (`--yes` / `--with` / `--without`), and injects a delimited usage-rules block into `.ai-rulez/rules/basemind-usage.md` (if `.ai-rulez/config.toml` exists), else `CLAUDE.md`, else `AGENTS.md`. Preview with `--print`; skip rules with `--no-rules`.

---

## Live help output

```
$ basemind --help
File-watcher and code-map generator using tree-sitter

Usage: basemind [OPTIONS] <COMMAND>

Commands:
  init             Initialize (or refresh) basemind onboarding
  scan             Run a one-shot scan over the repository
  rescan           Re-index the working tree (full) or only given paths (incremental)
  watch            Long-running watcher; keeps the code map current
  code             Read the code map: outline, symbols, grep, files, find, definition, references, callers, implementations, dependents, expand, semantic, chunk
  git              Git history / blame / diff queries
  graph            Navigate the code graph
  memory           Shared agent memory + document search
  web              On-demand web ingestion
  admin            Server + cache administration
  hook             Install a pre-commit hook
  lang             Manage downloaded tree-sitter grammars
  compress-output  Compress verbose command output
  delta            Emit a compact +N/-M line-diff
  checkpoint       Extract a checkpoint from session text
  detect-waste     Flag wasteful tool usage
  serve            Run an MCP server (stdio relay to daemon)
  statusline       Print daemon hot-workspace summary
  cache            Manage the cache (gc / stats / clear)

Options:
      --root <ROOT>  Repository root [default: current directory]
  -q, --quiet        Suppress all but hard failures
  -v, --verbose      Show every per-file result
      --no-color     Force-disable ANSI colors
      --json         Machine-readable JSON output
      --view <VIEW>  working | staged | rev-<sha7> [default: working]
```

```
$ basemind serve --help
Run an MCP server for a stdio client: ensure the daemon (the real server) is up,
then relay this process's stdin/stdout to it.

Options:
      --git-cache-mem <GIT_CACHE_MEM>  LRU capacity for in-process git cache [default: 1024]
      --no-git-cache-disk               Disable on-disk git cache
      --no-watch                        Disable continuous background re-scan
  -q  --quiet                          Suppress all but hard failures
  [+ many --documents-* and --llm-* override flags]
```

```
$ basemind scan --help
Run a one-shot scan over the repository and write the code map

Options:
      --staged         Index git staging area (for pre-commit hook)
      --rev <REV>     Index tree at given revision (writes under views/rev-<sha7>/)
      --no-git-history Skip building git-history index after scan
      --rebuild-git-history Wipe and fully rebuild git-history index
```

```
$ basemind rescan --help
Re-index the working tree (full) or only the given paths (incremental)

Usage: basemind rescan [OPTIONS] [PATH]...
Arguments:
  [PATH]...  Repo-relative paths to re-index incrementally (forward-slash, no leading /)

Options:
      --full           Force full re-index even with paths supplied
      --no-git-history Skip git-history sync
      --rebuild-git-history Full rebuild of git-history index
```

```
$ basemind lang --help
Manage downloaded tree-sitter grammars

Commands:
  list     Show installed grammars and where they live
  install  Force-download all supported grammars (no-op if cached)
  clean    Delete the grammar cache
```

```
$ basemind cache --help
Manage the `.basemind/` caches (offline path)

Commands:
  stats  Disk footprint per-component + total (matches `du`) and process RAM
  gc     Reclaim unused space (safe while server runs)
  clear  Clear a cache component (blobs|views|lance|git-cache|telemetry|all, or views:<name>)
```

---

## Sub-question index

| # | Title | One-liner |
|---|---|---|
| SQ1 | CLI surface | 21 subcommands, 6 global flags, standard Rust exit codes (0/1), per-file streaming progress + summary line |
| SQ2 | MCP exposure | `basemind serve` = stdio relay to background daemon; daemon hosts MCP over Unix socket + optional HTTP (opt-in `BASEMIND_ALLOW_HTTP=1`, bearer token in `<comms_dir>/http.addr`) |
| SQ3 | Cache + markers | Global cache at `~/.local/share/basemind/`; markers are `workspace.json` and `status.json`; no `.ready` file — readiness via MCP `status` tool `notice` object |
| SQ4 | scan vs rescan | `scan` = one-shot full (supports `--staged`/`--rev`); `rescan` = full or incremental on paths (default full when no paths, `--full` forces full even with paths) |
| SQ5 | Download surface | No `download` command; grammars via `basemind lang install` (auto on first scan); ONNX/code-search models downloaded on first use when enabled |
| SQ6 | init | Writes `basemind.toml`, picks capabilities, injects usage rules into AGENTS.md/CLAUDE.md |

## Contradictions

None found between docs and code.
