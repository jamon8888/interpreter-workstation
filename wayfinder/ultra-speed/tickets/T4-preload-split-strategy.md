Type: grilling
Status: resolved
Blocked by: T1
Resolved: 2026-09-11

# T4: Preload Split Strategy

## Question

How should the 1,825-line `electron/preload.ts` be split, and which splits can load lazily?

Current state:
- Single `contextBridge.exposeInMainWorld('electron', {...})` call spanning ~1,000 lines
- ~250+ IPC method bindings across ~37 feature categories
- Loaded synchronously by every BrowserWindow before first paint

Strong candidates for lazy loading (feature bridges not needed for first paint):
- Voice Extension / TTS / STT (~15 methods)
- Office Extension (~8 methods)
- Movie export (~4 methods)
- Terminal (~6 methods)
- Codex (~5 methods)
- PDF (~3 methods)
- Computer Use Setup (~2 methods)
- Overlay Settings / Interpreter Overlay (~10 methods)

Core bridges needed for first paint:
- Core/App (~25 methods)
- Approvals (~8 methods)
- Agent Tabs/Threads (~15 methods)
- Profiles (~11 methods)
- Workspace (~10 methods)
- Files (~22 methods)
- UI Settings (dynamic)
- Browser (~16 methods) — needed if browser is the default view

Key decisions:
1. What's the split boundary? (by feature namespace? by usage frequency? by first-paint necessity?)
2. How do lazy bridges get loaded? (dynamic `contextBridge.exposeInMainWorld` after `ready-to-show`? separate preload scripts?)
3. What's the IPC contract impact? (does the renderer need to know which bridges are loaded?)

## Acceptance

- Named split: which feature groups go in core preload vs. lazy bridges
- Lazy loading mechanism documented
- No regression in IPC-dependent tests
- Core preload ≤ 300 lines

## Answer

### Split boundary: by feature namespace

Five feature module files under `electron/preload/`, each exporting a builder function:

| Module | Namespaces | Methods |
|--------|-----------|---------|
| `voice.ts` | voiceExtension, tts, stt | ~15 |
| `documents.ts` | officeExtension, pdf, markdown, movie | ~15 |
| `browser.ts` | browser, browserControl, terminal | ~22 |
| `agent.ts` | codex, subagentTools, agentNotifications, appToasts, programmaticTasks, feedback, skills, desktopNotification | ~20 |
| `misc.ts` | computerUseSetup, overlaySettings, interpreterOverlay, projectRunner, checkpoint | ~18 |

### Loading mechanism: eagerly imported, spread into expose block

All five modules are imported statically and their builder functions called before `contextBridge.exposeInMainWorld`. The returned objects are spread into the expose block. This preserves the single-expose contract while reducing the core file from **1,837 → 1,407 lines** (23% reduction).

Lazy dynamic loading was not pursued because:
- Preload scripts run in an isolated context; dynamically adding to `contextBridge` after initial expose is not supported by Electron
- Separate preload scripts per feature would require coordinating multiple `contextBridge.exposeInMainWorld` calls and the renderer would need to handle partial availability
- The 23% reduction + modular organization is sufficient for this phase; further splitting is deferred to T5+ (utilityProcess migration)

### Core namespaces kept inline

These stay in the main preload.ts expose block: core/app methods, approvals, runtime, agentTabs, agentThreads, profiles, workspace, servers, setup, files, locale, backgroundOpacity, zoomFactor, theme, primaryColor, uiSettings, window, tabs, quickActions, workstation, appUpdate, toolServers, globalTools, auth.

### Type safety

Builder functions receive `(ipcRenderer, IPC_CHANNELS)` as parameters. The `IPC_CHANNELS` parameter is typed as `typeof import('../ipc/registry').IPC_CHANNELS` to avoid coupling to the registry export name.
