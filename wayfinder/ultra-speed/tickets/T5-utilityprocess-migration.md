Type: grilling
Status: resolved
Blocked by: T1
Resolved: 2026-09-11
Approach: C (Tiered)

# T5: Background Work → utilityProcess Migration

## Question

Which background tasks currently running in the main process or hidden BrowserWindows should migrate to Electron's `utilityProcess` API?

## Answer: Tiered Approach (Approach C)

Two utilityProcesses + async upgrades. Group by lifecycle and isolation needs.

### Phase 1: Async Upgrades (No New Process)

Convert blocking `readFileSync`/`writeFileSync` to async `fs.promises.*` in the main process.

| File | Current | Change to |
|------|---------|-----------|
| `electron/main.ts` (logging) | `fs.appendFileSync` per log call | Buffer writes + flush every 100ms or on exit |
| `electron/main.ts` (file tree cache) | `readFileSync` at module load | `await fs.promises.readFile` in `app.whenReady()` |
| `electron/crashReports.ts` | `readFileSync`/`writeFileSync` | `await fs.promises.readFile`/`writeFile` |
| `server/tools/builtin-tools/js-repl/kernelManager.ts` | `writeFileSync` for image saving | `await fs.promises.writeFile` |

Effort: Small (~80 lines across 4 files). Risk: Very low.

### Phase 2: Heavy I/O UtilityProcess

On-demand utilityProcess for port cleanup, ZIP extraction, thumbnail generation.

**Architecture:**
```
Main process
  ├── utilityProcess.fork('electron/io-worker/entry.ts')
  │     ├── port cleanup (was execSync → async in worker)
  │     ├── ZIP extraction (was JSZip in main → in worker)
  │     └── thumbnail generation (was child_process.exec → in worker)
  └── port.postMessage / port.on('message')
        ├── { type: 'port-cleanup', ports: number[] }
        ├── { type: 'extract-zip', src: string, dest: string }
        └── { type: 'generate-thumbnail', filePath: string, size: number }
```

**Files to create:**
- `electron/io-worker/entry.ts` — worker entry, message router
- `electron/io-worker/portCleanup.ts` — extracted from `electron/utils/ports.ts`
- `electron/io-worker/zipExtract.ts` — extracted from `electron/services/office-extension.ts`
- `electron/io-worker/thumbnail.ts` — extracted from `server/thumbnailService.ts`

**Files to modify:**
- `electron/utils/ports.ts` — route through worker
- `electron/services/office-extension.ts` — route ZIP extraction through worker
- `server/thumbnailService.ts` — route thumbnail generation through worker

**Lifecycle:** Forked per task, terminated after completion. Transient process.

Effort: Medium (~4 new files, 3 modified). Risk: Low — isolated failures.

### Phase 3: Voice Inference UtilityProcess

Long-lived utilityProcess for Smart Turn FFT + ONNX and Silero VAD.

**Architecture:**
```
Main process (Express server)
  ├── utilityProcess.fork('electron/voice-worker/entry.ts')
  │     ├── Smart Turn (onnxruntime-node, 8MB model)
  │     └── Silero VAD (sherpa-onnx, native)
  └── port.postMessage / port.on('message')
        ├── { type: 'smart-turn', sessionId, pcm: Float32Array }
        ├── { type: 'vad-feed', sessionId, pcm: Int16Array }
        └── { type: 'vad-result', done: boolean, speechProb: number }
```

**IPC contract:** `MessagePortMain` for zero-copy `ArrayBuffer` transfer. Session-scoped with per-session state (ring buffers, ONNX sessions).

**Lifecycle:** Stays alive while any voice session is active. Auto-terminates after 5min idle.

**Files to create:**
- `electron/voice-worker/entry.ts` — worker entry point
- `electron/voice-worker/smartTurn.ts` — FFT + ONNX logic (from `smartTurnService.ts`)
- `electron/voice-worker/vad.ts` — Silero VAD logic (from `sileroVadService.ts`)

**Files to modify:**
- `server/utils/smartTurnService.ts` — replace in-process inference with `port.postMessage`
- `server/utils/sileroVadService.ts` — replace in-process inference with `port.postMessage`
- `server/server.ts` — add worker lifecycle management

Effort: Large (~800 lines moved, 5 files). Risk: Medium — hot path, must maintain voice latency.

## Full Audit Table

| Priority | Subsystem | File(s) | Current Context | Blocks Event Loop? | Action |
|----------|-----------|---------|-----------------|-------------------|--------|
| HIGH | Smart Turn inference | `server/utils/smartTurnService.ts` | In-process | YES (FFT + ONNX) | → Voice utilityProcess |
| HIGH | Silero VAD | `server/utils/sileroVadService.ts` | In-process | YES (ONNX per chunk) | → Voice utilityProcess |
| HIGH | Port cleanup | `electron/utils/ports.ts` | Main process | YES (`execSync`) | → I/O utilityProcess |
| HIGH | Office ZIP extraction | `electron/services/office-extension.ts` | Main process | YES (JSZip) | → I/O utilityProcess |
| HIGH | Thumbnail generation | `server/thumbnailService.ts` | Main process | YES (image processing) | → I/O utilityProcess |
| MEDIUM | File tree cache load | `electron/main.ts` | Main process | YES (`readFileSync`) | → Async upgrade |
| MEDIUM | Logging | `electron/main.ts` | Main process | YES (`appendFileSync`) | → Async upgrade |
| MEDIUM | Crash context R/W | `electron/crashReports.ts` | Main process | YES (`readFileSync`) | → Async upgrade |
| LOW | JS REPL image save | `server/tools/builtin-tools/js-repl/kernelManager.ts` | Main process | YES (`writeFileSync`) | → Async upgrade |
| LOW | Office extension child | `electron/services/office-extension.ts` | child_process | No | No change |
| LOW | Font metadata gen | `electron/services/office-extension.ts` | child_process | No | No change |
| LOW | Update checks | `electron/autoUpdater.ts` | Main process | No (async) | No change |
| LOW | Browser extension relay | `server/utils/browserExtensionRelay.ts` | child_process | No | No change |
| LOW | Shell integration | `electron/services/shell-integration.ts` | Main process | No (async) | No change |
| LOW | Hidden BrowserWindow | `electron/services/browser.ts` | Hidden window | Architectural | No change |
| LOW | Sentry dynamic imports | `electron/main.ts` | Main process | No | No change |
| N/A | Document engine | External (oo-editors) | Separate repo | — | N/A |
| N/A | TTS synthesis | `server/services/ttsService.ts` | worker_threads | No (offloaded) | No change |
| N/A | File watcher | `server/fileWatcher.ts` | Native bindings | No | No change |
| N/A | JS REPL kernel | `server/tools/builtin-tools/js-repl/kernelManager.ts` | child_process | No | No change |

## Process Map

**Before:**
```
Main process (Electron)
├── Express server (in-process)
├── qwen_asr (child_process, per session)
├── JS REPL kernel (child_process, per thread)
├── Office extension (child_process, if installed)
├── Browser extension relay (child_process, if installed)
└── BrowserWindow renderers (per window)
```

**After:**
```
Main process (Electron)
├── Express server (in-process)
├── Voice inference utilityProcess (long-lived, per app session)
│     ├── Smart Turn ONNX
│     └── Silero VAD
├── Heavy I/O utilityProcess (on-demand, per task)
│     ├── Port cleanup
│     ├── ZIP extraction
│     └── Thumbnail generation
├── qwen_asr (child_process, per session) ← unchanged
├── JS REPL kernel (child_process, per thread) ← unchanged
├── Office extension (child_process, if installed) ← unchanged
├── Browser extension relay (child_process, if installed) ← unchanged
└── BrowserWindow renderers (per window) ← unchanged
```

## Memory Impact

| Component | Before | After | Delta |
|-----------|--------|-------|-------|
| Main process V8 heap | ~200MB | ~120-140MB | **-60 to -80MB** |
| Voice inference utilityProcess | 0 | ~60-80MB | +60-80MB |
| Heavy I/O utilityProcess | 0 | ~30-50MB (transient) | +30-50MB peak |
| **Net steady-state** | ~200MB | ~180-220MB | **~-20 to +20MB** |

## IPC Contract Impact

- **No preload changes.** Voice HTTP endpoints still live on Express; only inner inference routes through utilityProcess.
- **No renderer changes.** All `window.electron.*` methods unchanged.
- **New internal channels:** `voice-inference-port` and `heavy-io-port` via `MessagePortMain` — internal only, not exposed to renderer.
- **No HTTP API changes.** All REST endpoints remain identical.

## Risks

1. **Native module loading:** `onnxruntime-node` and `sherpa-onnx` must load in utilityProcess. Test on all platforms before committing.
2. **Voice latency:** `postMessage` serialization adds ~0.1ms overhead vs. current ~10-50ms blocking computation. Net improvement.
3. **Memory leaks:** Voice worker must release ONNX sessions on session end. 5-min idle timeout as safety net.
4. **Packaging:** utilityProcess scripts must resolve correctly in packaged builds. Use `app.getAppPath()` + relative path.
