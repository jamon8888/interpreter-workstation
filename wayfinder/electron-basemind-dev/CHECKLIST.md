# Basemind E2E Verification Checklist

## Prerequisites

```bash
# Daemon must be running (basemind comms daemon)
ps aux | grep basemind | grep comms
# → ... basemind comms daemon ... (PID shown)

# Workspace scan cache path
echo $HOME/.local/share/basemind/
ls $HOME/.local/share/basemind/comms/
# → comms.sock  daemon.pid
```

## 1. Binary resolution

```bash
npx tsx -e "import('./server/utils/basemindManager').then(m => console.log(m.resolveBasemindBinary()))"
# → /home/jamin/.nvm/versions/node/v22.23.2/bin/basemind  (npm shim with serve support)
```

The local debug binary (`basemind/target/debug/basemind`) is v0.28.0 without `comms` feature — it doesn't support `serve`. The npm shim (v0.26.0 with `comms` feature) is found via PATH lookup.

## 2. Daemon status

```bash
npx tsx -e "import('./server/utils/basemindManager').then(m => { console.log('running:', m.isDaemonRunning()); m.getBasemindServerStatus().then(s => console.log('status:', s)); })"
# → running: true
# → status: { status: 'connected' }
```

## 3. MCP tool server (port 5177)

```bash
curl -s -X POST http://localhost:5177/api/ipc/basemind/status \
  -H "Content-Type: application/json" -d '{}'
# → {"status":"connected"}
```

## 4. Register MCP server

```bash
curl -s -X POST http://localhost:5177/api/ipc/basemind/register \
  -H "Content-Type: application/json" -d '{}'
# → {"serverId":"basemind"}
```

## 5. Unregister MCP server

```bash
curl -s -X POST http://localhost:5177/api/ipc/basemind/unregister \
  -H "Content-Type: application/json" -d '{}'
# → {"success":true}
```

## 6. Workspace scan status

```bash
curl -s -X POST http://localhost:5177/api/ipc/workspaceScan/status \
  -H "Content-Type: application/json" -d '{}'
# → {"redactionActive":true,"indexing":false,"fileCount":0,"lastScanAt":null,
#     "xbergAvailable":true,"basemindAvailable":true,
#     "resourcesReady":{"nerModel":true,"embeddings":true,"reranker":true}}
```

Key fields:
- `basemindAvailable: true` — daemon is running
- `resourcesReady.*: true` — all three resources ready (ner, embeddings, reranker)

## 7. Unit tests

```bash
npx vitest run
# → Test Files  82 passed
# → Tests       354 passed
```

## 8. TypeScript

```bash
pnpm exec tsc --noEmit && pnpm exec tsc -p tsconfig.electron.json --noEmit
# → (no output = clean)
```

## Visual pass commands (requires desktop display)

```bash
# Start dev
pnpm dev

# In Electron DevTools console:
await window.api.basemind.status()       // { status: 'connected' }
await window.api.basemind.register()      // { serverId: 'basemind' }
await window.api.basemind.unregister()   // { success: true }
await window.api.workspaceScan.status()   // WorkspaceScanStatus object

# interpreter-app mcp list (requires INTERPRETER_CLI_SERVER_CONNECTION env)
interpreter-app mcp list
interpreter-app mcp basemind code --help
```

## Common issues

| Symptom | Fix |
|---------|-----|
| `register()` returns `""` | Binary doesn't support `serve` — use npm shim (PATH lookup before local binary) |
| `status: 'disconnected'` | Daemon not running — `basemind comms daemon &` |
| `basemindAvailable: false` | Same as above |
| Wrong cache path | Use `~/.local/share/basemind/` not `~/.cache/basemind/` |
| Vite deps scanning hangs | Normal on first run; Electron may crash/retry — wait for `[IPC] All handlers registered` |
