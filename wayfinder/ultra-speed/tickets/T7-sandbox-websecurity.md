Type: grilling
Status: resolved
Blocked by: T1
Resolved: 2026-09-11
Sandbox: no-go
webSecurity: go

# T7: Sandbox and webSecurity Revisit

## Question

Can `sandbox: true` and/or `webSecurity: true` be re-enabled safely, and what's the migration path?

## Answer

### Sandbox: No-Go

**Cannot re-enable `sandbox: true` without rewriting the preload to CJS.**

- Electron 42 sandboxed preload **cannot load ESM**. Hard limitation, not planned to change (issue #48668 closed as not planned).
- The main preload (`electron/preload.ts`) uses full ESM imports (`import { contextBridge, ipcRenderer } from 'electron'`). Works today because `sandbox: false` → Node.js ESM loader runs in preload.
- To enable sandbox, preload must be bundled to CJS with esbuild. Requires build pipeline changes + testing of all 250+ IPC bindings.
- The overlay preload (`preload.cjs`) is already CJS — could enable sandbox independently, but low priority.

**Leave `sandbox: false`.** The security posture is acceptable: `contextIsolation: true` + `nodeIntegration: false` provides the key isolation. The preload is trusted code.

### webSecurity: Go (with small migration)

**Can re-enable `webSecurity: true` with a ~15-line change.**

The only thing requiring `webSecurity: false` is a direct `fetch('http://localhost:38123/healthcheck')` from the renderer to the oo-editors server (in `OfficeExtensionViewer.tsx`). The iframe's `postMessage` communication works cross-origin by design.

**Migration steps:**

1. Add `officeExtension.healthcheck()` IPC channel in `electron/ipc/handlers.ts`
   - Main process makes the fetch (no CORS restrictions)
   - Returns `{ status: string }` to renderer
2. Add bridge method in `electron/preload/documents.ts`
   - `healthcheck: () => ipcRenderer.invoke(IPC_CHANNELS.OFFICE_EXTENSION_HEALTHCHECK)`
3. Update `src/components/OfficeExtensionViewer.tsx`
   - Replace `fetch('http://localhost:38123/healthcheck')` with `window.electron.officeExtension.healthcheck()`
4. Remove `webSecurity: false` from `electron/main.ts:2273`

**Effort:** ~15-20 lines across 4 files.

**Attack surface eliminated:**
- Same-origin policy restored (no cross-origin DOM access)
- Renderer can't make unrestricted requests to local ports
- `allowRunningInsecureContent` stays disabled by default

**Fallback if iframe loading breaks:** Add `session.webRequest.onHeadersReceived` with URL filters scoped to `localhost:38123/*` to inject permissive CORS headers. This is session-scoped and URL-filtered, not a global `webSecurity: false`.

### Security Risk Assessment (Current Settings)

| Flag | Current | Risk of Staying | Severity |
|------|---------|-----------------|----------|
| `sandbox: false` | Disabled | Preload runs with Node.js access in renderer context | Medium — mitigated by `contextIsolation: true` + `nodeIntegration: false` |
| `webSecurity: false` | Disabled | Same-origin policy disabled app-wide; renderer can fetch any local port | High — practical attack surface: compromised iframe could reach internal services |

### Key Files

| File | Line | Setting |
|------|------|---------|
| `electron/main.ts` | 2273 | `webSecurity: false` — remove after migration |
| `electron/main.ts` | 2260 | `sandbox: false` — keep |
| `src/components/OfficeExtensionViewer.tsx` | 89 | Direct `fetch` to localhost — replace with IPC |
| `electron/preload/documents.ts` | — | Add `healthcheck` bridge method |
| `electron/ipc/handlers.ts` | — | Add healthcheck handler |
