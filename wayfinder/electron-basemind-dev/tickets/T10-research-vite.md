# T10 — Research: Vite 8.2.0 dev server (HMR, `5173`, `/api` proxy)

## Question

How does Vite 8.2.0 configure: (a) the dev server on a fixed port
(`5173`) with `strictPort: true`; (b) a proxy from `/api` to
`http://localhost:5177`; (c) HMR over the Electron renderer, including
the `server.hmr` knobs that matter when the page is loaded by Electron
(not a normal browser tab); (d) the React plugin 6.0.5's interaction
with HMR? `vite.config.ts:72-96` is the current source of truth in
this repo; the goal is to confirm it's correct for our setup.

## Method

1. `context7_resolve_library_id` for "vite" and pick the
   highest-reputation match.
2. `context7_query_docs` four times, one per sub-question.
3. Capture: the `server.port` / `server.strictPort` config, the
   `server.proxy` shape, the `server.hmr` knobs (host, port, clientPort,
   protocol), and the @vitejs/plugin-react HMR behavior.
4. Save findings on a throwaway `research/vite-8` branch as
   `research/vite-8.md`.
5. Compare against the current `vite.config.ts`; flag any
   contradictions.

## Acceptance

- The four sub-questions are answered with version-stamped citations.
- A copy of the file lives at
  `wayfinder/electron-basemind-dev/research/vite-8.md` and a pointer
  is recorded in this ticket's resolution.

## Resolution

**Status: CLOSED** — research complete.

Findings at `../research/vite-8.md`.

| Sub-Q | Answer | Verdict |
|--------|--------|---------|
| (a) `strictPort` | `false` = walk upward for free port; `true` = throw on `EADDRINUSE` | — |
| (b) `proxy` shape | `Record<string, string \| ProxyOptions>`; `'/api': { target, changeOrigin }` | — |
| (c) HMR knobs for Electron renderer | Vite 8 moves to `server.ws.*`; defaults suffice for Electron | deprecation compat still works, no immediate fix needed |
| (d) `@vitejs/plugin-react` HMR | Oxc Fast Refresh; no extra config required | — |

**Comparison against `vite.config.ts:72-96`**: correct on all four. One note for T2: `server.hmr.*` deprecation warnings not currently triggered (no `server.hmr` block in current config).
