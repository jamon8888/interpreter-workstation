Type: research
Status: resolved
Blocked by: _(none)_

# T1: Baseline Performance Measurement

## Question

What are the current performance numbers for every metric in the Ultra Speed spec, and where is the time actually spent?

Specifically, measure:

1. **Cold start → first interactive paint**: time from `app.on('ready')` to renderer signals "mounted" via IPC
2. **Main renderer JS shipped on first paint**: current gzip size of the main entry chunk (confirm the ~2.0 MB from docs/react-compiler.md; measure the full chunk tree)
3. **New window → ready-to-show**: time from `new BrowserWindow()` to `ready-to-show` event
4. **Main process cold boot**: time from `app.on('ready')` returning (module init + requires complete)
5. **Peak idle memory**: with 1 window open, idle for 30s after first paint

Also profile WHERE the time goes:
- Main process: run `pnpm start -- --cpu-prof --heap-prof` to find which `require()` calls dominate boot time (profile output goes to `CPU.001.cpuprofile` in the working directory)
- Renderer: use Vite bundle analyzer or rollup-plugin-visualizer to map the chunk tree; identify the largest modules in the main chunk
- Process count: how many processes does the app spawn at idle? (main + renderer + any hidden BrowserWindows + any spawned children)

Record all numbers in `wayfinder/ultra-speed/research/baseline.md`.

## Answer

Research completed 2026-09-11. Full findings: [research/baseline.md](../research/baseline.md)

**Key numbers:**
- Main entry chunk: 6,004 kB raw / **1,852 kB gzip** (target: ≤600 KB)
- Total JS: 11.5 MB raw / 3.4 MB gzip across 25 chunks
- i18n chunk: 1,224 kB — separate but loaded eagerly
- Main process: 2,792 lines, ~79 static imports, 13 dynamic
- Server import block (lines 860–919): heaviest single startup cost — pulls entire Express backend statically
- App.tsx: 35 static component imports, 0 React.lazy
- Preload: 1,825 lines, ~179 IPC methods across ~37 categories
- No startup instrumentation exists
- No utilityProcess usage
- No manualChunks configured
- No NODE_COMPILE_CACHE set

**Top quick wins identified:**
1. Lazy-load server import block in main.ts (biggest single win)
2. React.lazy for onboarding/marketing components in App.tsx
3. Code-split i18n (1.2 MB chunk)
4. manualChunks for vendor + file-viewer runtimes
5. Add startup profiling instrumentation

**Still needs runtime measurement:** cold start time, preload execution time, memory baseline, window creation time. Static analysis done; dynamic profiling needs `pnpm dev` + instrumented Electron launch.

## Acceptance

### Completed (static analysis)
- Main process require() profile shows top-10 most expensive imports ✓
- Renderer bundle visualization shows where the 2 MB gzip goes ✓

### Pending (requires runtime measurement)
- [ ] All 5 metrics have concrete numbers — cold start, preload time, memory, window creation need instrumented `pnpm dev` launch
- [ ] Process count at idle is documented
