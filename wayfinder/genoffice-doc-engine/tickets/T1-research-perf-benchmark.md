# T1 — Research: oo-editors vs genoffice performance

## Question

What performance evidence exists for the current oo-editors engine
(OnlyOffice/x2t, local HTTP server on port 38123, iframe-embedded) versus
genoffice (Electron app, pure-TS engines, Rust xlsx sidecar), and what
benchmark protocol would measure the Workstation embedded path? Attempt
lightweight local measurement if feasible without credentials.

Specifically:
- What is known about oo-editors/x2t performance (startup cost, open
  latency, memory footprint, conversion speed)?
- What does genoffice document or claim about its own performance?
- Can either engine be measured locally right now (oo-editors installed?
  genoffice clonable/runnable?) without release-repo credentials?
- What benchmark protocol should a later task ticket run: metrics,
  test files (docx/xlsx/pptx of varying size), and pass/fail thresholds?

## Method

1. Local checks: is oo-editors installed (userData install dir, port 38123
   healthcheck)? Is genoffice present or cheaply clonable to
   `/tmp/opencode/genoffice` (shallow clone)?
2. Mine evidence: genoffice README/docs for performance claims;
   openinterpreter/oo-editors issues (none exist as of 2026-09-18);
   known x2t/OnlyOffice characteristics.
3. Attempt measurement only if genuinely cheap; otherwise write the
   protocol a task ticket can execute later.
4. Save findings as `wayfinder/genoffice-doc-engine/research/perf-benchmark.md`.

## Acceptance

- The file answers every sub-question, distinguishing measured facts from
  qualitative/known characteristics.
- A benchmark protocol exists with metrics, test corpus, and thresholds.

## Resolution

**Status: CLOSED** — research complete (2026-09-19). Findings at
`research/perf-benchmark.md`.

| Finding | Detail |
|---------|--------|
| oo-editors/x2t | Zero perf data anywhere (0 issues, no benchmarks) |
| genoffice | No published numbers, but ships runnable benchmarks (`apps/sheets/scripts/benchmark-large-xlsx.ts`: open/first-viewport/full-index ms + peak sidecar RSS; `bench-recalc-resident.ts` at 50k rows) and documented per-keystroke pathologies ("hundreds of ms per keystroke on a 10k-paragraph document" — `prosemirror-perf.ts`) |
| Measurement now? | No — oo-editors not installed here (port 38123 dead, community install disabled); genoffice cloned at `/tmp/opencode/genoffice` but needs full npm install + Rust build for its real benchmarks |
| Protocol | Written: 6 metrics, 3-size corpus per format (genoffice's own fixture scripts reusable), thresholds — cold open ≤5s, warm ≤1.5s, large xlsx 100k rows first-viewport ≤1s / index ≤60s, RSS ≤1.5GB |

Actual measurement graduated into task ticket
[T5](T5-task-perf-benchmark-run.md).
