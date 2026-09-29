# T10 — Vite 8.2.0 + @vitejs/plugin-react 6.0.5 research

Researched via Context7 MCP against the Vite 8 source tree (`packages/vite/src/node/server/index.ts`,
`packages/vite/src/node/server/hmr.ts`, `packages/vite/src/node/plugins/clientInjections.ts`,
`packages/vite/src/node/utils.ts`) and `docs/config/server-options.md`.

Pinned versions in this repo (`package.json`):

- `vite`: **8.2.0**
- `@vitejs/plugin-react`: **6.0.5**

---

## (a) `server.port` + `server.strictPort`

**Doc citation (Vite 8, `docs/config/server-options.md`):**

> Vite's development server defaults to port 5173. If the configured port is already occupied, Vite
> automatically attempts the next available port unless strict port mode is enabled, which forces
> the server to exit instead.

**Source-level citation (`packages/vite/src/node/http.ts`, `httpServerStart`):**

```ts
for (let port = startPort; port <= MAX_PORT; port++) {
  ...
  if (strictPort) {
    ...
    if (result.error.code !== 'EADDRINUSE') throw result.error
    throw new Error(`Port ${port} is already in use`)
  }
  if (portAvailableOnWildcard) { ... try next ... }
  logger.info(`Port ${port} is in use, trying another one...`)
}
```

**One-line summary:** `port` defaults to `5173`; with `strictPort: false` Vite walks upward until it
finds a free port; with `strictPort: true` it throws on `EADDRINUSE`.

---

## (b) `server.proxy` shape

**Doc citation (Vite 8, `docs/config/server-options.md`):**

```js
proxy: {
  // string shorthand
  '/foo': 'http://localhost:4567',
  // with options
  '/api': {
    target: 'http://jsonplaceholder.typicode.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
  // RegExp key
  '^/fallback/.*': { target: '...', changeOrigin: true, rewrite: ... },
  // WebSockets
  '/socket.io': { target: 'ws://localhost:5174', ws: true, rewriteWsOrigin: true },
}
```

Backed by `http-proxy-3`. `Record<string, string | ProxyOptions>`. Keys starting with `^` are
treated as RegExp.

**One-line summary:** Map path-prefix (or `^`-prefixed RegExp) → `string` shorthand or `{ target,
changeOrigin, rewrite, ws, ... }` options; built on `http-proxy-3`.

---

## (c) `server.hmr` knobs for the Electron renderer

**Critical Vite 8 finding — knobs renamed:**

From `packages/vite/src/node/server/hmr.ts`:

```ts
export interface HmrOptions {
  /** @deprecated Use `server.ws.protocol` instead. */
  protocol?: string
  /** @deprecated Use `server.ws.host` instead. */
  host?: string
  /** @deprecated Use `server.ws.port` instead. */
  port?: number
  /** @deprecated Use `server.ws.clientPort` instead. */
  clientPort?: number
  /** @deprecated Use `server.ws.path` instead. */
  path?: string
  /** @deprecated Use `server.ws.timeout` instead. */
  timeout?: number
  overlay?: boolean
  /** @deprecated Use `server.ws.server` instead. */
  server?: HttpServer
}
```

`server.hmr.{host,port,clientPort,protocol,path,timeout,server}` are deprecated; the canonical
location is now `server.ws.*`. Backwards compat is wired up in
`setupHmrWsOptionCompat` (`packages/vite/src/node/utils.ts`) — values set under `server.hmr.*` are
proxied to `server.ws.*` at runtime, but the deprecation warning fires on writes.

**Doc snippet (`docs/config/server-options.md`):**

```js
server: {
  ws: {
    protocol: 'wss',
    host: 'localhost',
    port: 3001,
  },
}
```

**Electron-renderer implication:** the WebSocket URL the client uses is resolved in
`packages/vite/src/node/plugins/clientInjections.ts`:

```ts
// ws.clientPort -> ws.port -> 24678 (middleware mode) -> new URL(import.meta.url).port
let port = wsConfig?.clientPort || wsConfig?.port || null
```

When Electron's `BrowserWindow` loads the renderer via `loadURL('http://localhost:5173')`, the
renderer's WebSocket connects back to the same origin — same host and same port as the dev server.
Because Electron is the only client and there is no reverse proxy between the renderer and Vite,
**no `server.ws` override is needed** for HMR in this app; defaults (port = server.port, host =
server.host) work. `clientPort` is only useful when an external reverse proxy exposes a different
port than the one Vite binds (e.g., Docker host port).

**One-line summary:** In Vite 8 the HMR transport knobs (`host`, `port`, `clientPort`, `protocol`)
live under `server.ws.*`; for an Electron renderer that loads Vite directly (`localhost:5173`),
the defaults already wire HMR correctly, no `server.ws` overrides required.

---

## (d) `@vitejs/plugin-react` HMR behavior

**Doc citation (Vite 8, `docs/plugins/index.md`):**

> Provides React Fast Refresh support via Oxc Transformer.

(Plugin React 6.0.5 moved Fast Refresh off Babel onto the plugin's own Oxc-based pipeline.)

**Doc citation (Vite 8, `docs/guide/features.md`):**

> First-party and official HMR integrations are available for Vue Single File Components,
> React Fast Refresh, and Preact, which come pre-configured in create-vite templates.

**One-line summary:** Plugin-react 6.0.5 wires React Fast Refresh into Vite's HMR pipeline so
component edits hot-replace without full reload; it does not require any explicit `server.hmr` /
`server.ws` configuration to function.

---

## Comparison against `vite.config.ts`

Lines referenced: `vite.config.ts:72-96`.

| Sub-question | Repo setting | Verdict |
|---|---|---|
| (a) port + strictPort | `port: parseInt(process.env.VITE_PORT \|\| '5173', 10)`, `strictPort: false` | **Correct for stated goal.** Comment says "Allow fallback to next available port for multi-instance support" — that matches `strictPort: false`. Default 5173 matches the question. Caveat: the ticket *asks* about `strictPort: true`, but the comment + the goal of multi-instance support legitimately justify `false`. No contradiction with Vite 8 docs. |
| (b) proxy `/api` → `http://localhost:5177` | `{ '/api': { target: 'http://localhost:${EXPRESS_PORT \|\| '5177'}', changeOrigin: true } }` | **Correct.** Matches the documented `{ target, changeOrigin }` shape exactly. `changeOrigin: true` is appropriate because the upstream Express server expects `Host: localhost:5177`. No rewrite needed (and none present) — the upstream Express expects the `/api` prefix, so leaving the path intact is right. |
| (c) HMR for Electron renderer | **No `server.hmr` or `server.ws` block set.** | **Correct.** Defaults suffice for an Electron renderer that loads Vite directly. If anyone later adds `server.hmr: { host, port, clientPort, protocol }` they should know that those keys are deprecated in Vite 8 in favor of `server.ws.*` (backed by `setupHmrWsOptionCompat`); values still work but emit deprecation warnings on write. |
| (d) plugin-react HMR | `react({ babel: { plugins: [['babel-plugin-react-compiler', { panicThreshold }]] } })` | **Correct.** `react()` enables Fast Refresh by default; the only knob passed is the React Compiler babel plugin. No HMR interaction to fix. |

### Findings to flag in T2

1. **Deprecated path:** if anyone touches `server.hmr.{host,port,clientPort,protocol,path,timeout,server}`,
   they should move those keys to `server.ws.*` instead. Vite 8 still accepts the old keys
   (`setupHmrWsOptionCompat`) but they emit deprecation warnings. Not currently a problem — the
   config has no `server.hmr` block — but worth recording so a future drive-by edit doesn't
   reintroduce the deprecated form.
2. **No correctness issues found.** `vite.config.ts:72-96` matches Vite 8.2.0 docs for all four
   sub-questions.

---

## Sources

- `/vitejs/vite` (Context7, highest reputation match, 1317 snippets, benchmark 85.79)
- `packages/vite/src/node/server/index.ts` — `ServerOptions` / `CommonServerOptions` type
- `packages/vite/src/node/server/hmr.ts` — `HmrOptions` deprecation markers
- `packages/vite/src/node/utils.ts` — `setupHmrWsOptionCompat`
- `packages/vite/src/node/http.ts` — `httpServerStart` port-walking behavior
- `packages/vite/src/node/plugins/clientInjections.ts` — `clientPort || port` resolution
- `docs/config/server-options.md` — public-facing `server.*` options
- `docs/config/preview-options.md` — `preview.strictPort` (referenced for parity)
- `docs/plugins/index.md` — `@vitejs/plugin-react` Fast Refresh via Oxc
- `docs/guide/features.md` — HMR API description
- `docs/guide/api-hmr.md` — `import.meta.hot` event surface (not needed for this ticket)