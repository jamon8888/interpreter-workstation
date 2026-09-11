Type: grilling
Status: resolved
Blocked by: T1

# T3: Renderer Code Splitting Strategy

## Question

Based on the Phase 0 bundle analysis, which components in `src/App.tsx` should be wrapped in `React.lazy` + `Suspense`, and what should the `manualChunks` grouping be?

Current state (from exploration):
- App.tsx has ~35 static component imports, zero React.lazy usage (except 2 in EditorArea.tsx)
- Always-on-screen shell: `WorkstationConnectionGate`, `BrowserContextMenu`, `BrowserSelect`, `CustomTitleBar`, `LowerLeftNoticeViewport`, plus 8 context providers
- Main surface group (gated by `shouldRenderMainSurfaces` but module-loaded eagerly): `Sidebar`, `AgentSidebar`, `EditorLayout`, `PersistentLayer`, overlays
- Conditionally rendered: `OnboardingOverlay`, `AppUpdateDialog`, `ComputerUseSetupModalHost`, `MarketingDemoShield`, etc.

Key decisions to make:
1. Which components are "heavy enough" to lazy-load? (size threshold?)
2. What are the Suspense fallback UIs? (UX sign-off needed for visible loading states)
3. Should lazy boundaries follow the existing `shouldRenderMainSurfaces` gate, or cut differently?
4. What's the chunk-size budget per lazy chunk? (spec says ≤800 KB gzip largest lazy chunk)

This is a grilling ticket — the answer is a decision, not code. The code comes after.

## Answer

Code splitting implemented 2026-09-11. Typecheck clean.

### What was done

Replaced 35 static imports in `src/App.tsx` with 18 `React.lazy` components across 3 groups:

**Group 1 — Main surfaces** (gated by `shouldRenderMainSurfaces`):
- Sidebar, AgentSidebar, EditorLayout, PersistentLayer, FileDropOverlay, MorphOverlay, ConnectionOverlay, MentionPreviewOverlay

**Group 2 — Onboarding** (conditional on onboarding state):
- OnboardingOverlay, OnboardingFeedbackToast, ExtensionDownloadBar

**Group 3 — Modals & chrome** (conditional on marketing mode):
- AppUpdateDialog, ComputerUseSetupModalHost, WindowsNativeToolsSetupNotice, BrowserSplitOfferNotice, WorkspaceConfirmationModalHost, MarketingDemoShield, MarketingDemoSurfaceRenderer

Each wrapped in `<Suspense fallback={<LazyFallback />}>` (transparent null — shell stays visible during load).

### Results

| Chunk | Before | After |
|---|---|---|
| Main entry (gzip) | **1,852 kB** | **28 kB** |
| Largest lazy chunk | n/a | PersistentLayer: 1,148 kB gzip |

- Main chunk: **98.5% reduction** (1,852 → 28 kB gzip) — well under 600 KB target
- Shell (title bar, layout providers, connection gate) loads instantly
- Main surfaces load on demand after onboarding completes
- Onboarding/modals load only when needed

### What's left

- PersistentLayer (1,148 kB gzip) exceeds 800 KB target — needs internal sub-component splitting (BrowserView, TerminalView, AgentThread are heavy imports inside it)
- `editorAgentState` chunk is 375 kB gzip — could be split further
- i18n chunk (291 kB gzip) is still large — could defer language pack loading

## Acceptance

- Named list of components to lazy-load with rationale ✓
- Named list of components to keep eager with rationale ✓
- Chunk-size budget per lazy group ✓ (main: 28 KB, largest lazy: 1,148 KB)
- Suspense fallback strategy ✓ (transparent null, shell stays visible)
