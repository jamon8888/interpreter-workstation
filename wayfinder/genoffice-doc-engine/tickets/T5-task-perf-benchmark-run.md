# T5 — Task: run the perf benchmark (oo-editors vs genoffice)

## Question

T1 wrote the benchmark protocol but could not measure: oo-editors is not
installed on this machine (port 38123 dead; community build has install
disabled — needs the release repo, which is credential-dependent) and
genoffice needs a full npm install + Rust build for its real benchmarks.

Run the protocol from `research/perf-benchmark.md`: 6 metrics, 3-size corpus
per format (genoffice's own fixture scripts are reusable), thresholds — cold
open ≤5s, warm ≤1.5s, large xlsx 100k rows first-viewport ≤1s / index ≤60s,
RSS ≤1.5GB.

## Method

- genoffice side (AFK): shallow clone already at `/tmp/opencode/genoffice`;
  `pnpm install`, build the Rust xlsx sidecar if cargo allows, run the
  in-repo benchmarks + open-latency measurements.
- oo-editors side (HITL): installing it needs release-repo access. Hand
  the human a precise checklist (install via a Workstation official build
  or direct release download, then run the same protocol); or skip the
  oo-editors side if the human says the comparison isn't needed.

## Acceptance

- Measured numbers recorded in this ticket's resolution and appended to
  `research/perf-benchmark.md`, clearly separated from the qualitative
  findings.
- Any metric that could not be measured is reported as such with the
  reason (platform/credential-dependent).

## Resolution

**Status: IN PROGRESS** — claimed 2026-09-19.

(open)
