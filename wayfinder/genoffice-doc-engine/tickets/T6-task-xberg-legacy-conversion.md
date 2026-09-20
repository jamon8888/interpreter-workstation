# T6 — Task: wire xberg open-time conversion for legacy formats

## Question

T3 decided: with the matrix trimmed, legacy formats (.doc/.odt/.rtf/.ppt)
open via xberg extraction to markdown at open time. Wire it:

- xberg is Basemind's core document-tier engine (submodule dep
  `xberg-io/xberg`; also available as the standalone `xberg` CLI).
  When the user opens an unsupported legacy format, Workstation calls
  `xberg extract <path>` and displays the extracted markdown directly
  in the app.
- Gate on the EXISTING availability signal —
  `WorkspaceScanStatus.xbergAvailable` (`src/ipc.ts:627`) already
  tracks it; do not add a new presence check.
- Fallback (xberg/basemind unavailable): "open with agent" prompt
  (agent converts via code execution — soffice/LibreOffice, pandoc,
  etc.).
- Save stays markdown — the original file is never modified, extraction
  is lossy (no round-trip to .doc/.odt).
- The community distribution must stay fully usable without
  basemind/xberg (graceful fallback, never a hard dependency).

## Method

Reference `docs/agent-paths.md` (route path handling through `src/ipc.ts`
helpers) and `docs/agent-frontend.md` before UI work. The touch points:
format handling in `shared/utils/converterFormats.ts` / `EditorArea.tsx`
routing, an IPC path for xberg extraction (or the agent-path prompt), and
the markdown display. Keep the smallest diff that satisfies the decided
behavior.

## Acceptance

- Opening a .doc/.odt/.rtf/.ppt with xberg present shows the extracted
  markdown; without xberg shows the agent prompt.
- The original file is never modified; save stays markdown.
- Unit coverage for the branch (xberg present vs absent).

## Resolution

(open)
