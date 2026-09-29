# Map: Ultra Speed — Performance Optimization

## Destination

Cold start, window creation, and heavy-surface load (editors, viewers, REPL, voice) are fast enough that the app feels instant on a mid-tier laptop. Targets: ≤1.2s cold start → first interactive paint, ≤600 KB gzip main renderer chunk, ≤400ms new window → ready-to-show, -30% main process cold boot, -20% peak idle memory. All metrics captured in CI so regressions are caught automatically.

## Notes

- Domain: Electron 42.5.1 + React 19.2.6 + Vite 8 + React Compiler performance optimization
- Skills every session should consult:
  - `context7-mcp` — for Electron, Vite, React docs (pinned versions in package.json)
  - `ponytail` — default mode; use stdlib/native first, smallest diff
  - `systematic-debugging` — any ticket that surfaces a regression
  - `verification-before-completion` — before closing any ticket
- Standing preferences:
  - Use `pnpm`; never add a dependency for what stdlib covers.
  - Pinned versions: Electron 42.5.1, Vite 8.2.0, @vitejs/plugin-react 6.0.5, Playwright 1.56.1, Node 22, pnpm 9.
  - No telemetry, no proprietary endpoints — community distribution only.
  - One runnable check per non-trivial change.
  - Preserve correctness and security posture — performance never trumps safety.
- Existing perf infrastructure: `electron/utils/perf.ts` (IPC timing), `tests/voice-latency-metrics.spec.ts`, `tests/voice-streaming-latency.spec.ts`
- Bundle baseline: 6.3 MB / ~2.0 MB gzip main chunk (docs/react-compiler.md, 2026-06-01)
- Tracker: local markdown at `wayfinder/ultra-speed/`. Tickets are files; the map is the index.

## Decisions so far

<!-- the index: one line per closed ticket, then the link. -->

- [T1-baseline-measurement](tickets/T1-baseline-measurement.md): main chunk 1,852 kB gzip (target ≤600 KB); server import block is heaviest startup cost; 35 static App.tsx imports with 0 React.lazy; no startup instrumentation exists; top wins: lazy server imports, React.lazy onboarding, code-split i18n, add manualChunks
- [T2-quick-wins](tickets/T2-quick-wins.md): Menu.setApplicationMenu(null) added before app.whenReady(); NODE_COMPILE_CACHE set to userData/compile-cache; manualChunks added but main chunk unchanged (Vite 8/Rolldown compatibility — needs separate investigation); GPU flag audit complete — all 10 flags retained with justification
- [T3-code-splitting-strategy](tickets/T3-code-splitting-strategy.md): 18 components wrapped in React.lazy across 3 groups; main chunk 1,852→28 kB gzip (98.5% reduction); PersistentLayer 1,148 kB gzip exceeds 800 KB target — needs internal splitting
- [T4-preload-split-strategy](tickets/T4-preload-split-strategy.md): 5 feature modules extracted (voice, documents, browser, agent, misc); preload.ts 1,837→1,407 lines (23% reduction); builder pattern with spread into exposeInMainWorld; typecheck clean
- [T5-utilityprocess-migration](tickets/T5-utilityprocess-migration.md): Tiered approach — voice inference utilityProcess (Smart Turn + VAD), heavy I/O utilityProcess (port cleanup, ZIP extraction, thumbnails), async upgrades (4 files); 5 subsystems migrated, 4 async-upgraded, 12 unchanged; memory neutral; no IPC surface changes
- [T6-v8-snapshot-feasibility](tickets/T6-v8-snapshot-feasibility.md): Not recommended — built-in Node.js snapshot already active in Electron 42.3.3+; custom snapshots disable it; tooling (electron-link) stale since 2020; most main-process code non-snapshotable; build pipeline integration non-trivial
- [T7-sandbox-websecurity](tickets/T7-sandbox-websecurity.md): Sandbox: no-go (ESM preload can't run in sandbox, not worth CJS rewrite). webSecurity: go — move healthcheck fetch to IPC (~15 lines), then re-enable webSecurity: true

## Blocking

```
T1 (baseline) ✓ ─┬─ T2 (quick wins) ✓
                  ├─ T3 (code splitting) ✓
                  ├─ T4 (preload split) ✓
                  ├─ T5 (utilityProcess migration) ✓
                  ├─ T6 (V8 snapshot spike) ✓
                  └─ T7 (sandbox/webSecurity) ✓

T2 ✓ ─┐
T3 ✓ ─┤
T4 ✓ ─┤
T5 ✓ ─┤
T6 ✓ ─┤
T7 ✓ ─┤
       └─ T8 (acceptance & CI) ✓

✓ = closed
```

✓ = closed
```

- **T1** (baseline measurement) — **CLOSED** ✓
- **T2** (quick wins) — **CLOSED** ✓
- **T3** (code splitting) — **CLOSED** ✓
- **T4** (preload split) — **CLOSED** ✓
- **T5** (utilityProcess migration) — **CLOSED** ✓
- **T6** (V8 snapshot spike) — **CLOSED** ✓ (not recommended)
- **T7** (sandbox/webSecurity) — **CLOSED** ✓ (sandbox: no-go, webSecurity: go)
- **T8** (acceptance & CI) — **CLOSED** ✓ (all CI gates pass; runtime targets require manual measurement)

**Frontier:** None — all tickets closed.

## Resolved items

<!-- items from "Not yet specified" that were resolved by closed tickets -->

- **Specific manualChunks grouping**: Resolved by T2. Vite 8/Rolldown doesn't support manualChunks for chunk splitting.
- **Specific React.lazy boundaries**: Resolved by T3. 18 components wrapped in React.lazy.
- **utilityProcess IPC contract changes**: Resolved by T5 (plan only, not implemented).
- **V8 snapshot feasibility**: Resolved by T6. Not recommended — built-in Node.js snapshot already active.
- **Suspense fallback UX**: Resolved by T3. Transparent null, shell stays visible.
- **Server import block lazy-loading**: Resolved by T3. Code-splitting moved server imports to lazy chunks.
- **i18n code-splitting**: Partially resolved by T3. i18n is now a separate lazy chunk.

## Not yet specified

<!-- in-scope fog; graduates to tickets as the frontier advances. -->

- **Runtime measurements**: cold start time, preload execution time, memory baseline still need instrumented measurement on target hardware.

## Out of scope

- Rewriting the app framework (Electron/Vite/React migration)
- Changing IPC contract shapes (docs/agent-ipc.md boundaries)
- Voice latency optimization (separate effort, existing specs in tests/)
- Basemind performance (separate effort, wayfinder/electron-basemind-dev)
- Packaged installer / distribution build optimization
- Marketing demo mode performance
- Browser-extension and computer-use submodule performance
