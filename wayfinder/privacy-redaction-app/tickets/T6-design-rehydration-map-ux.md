# T6 — Decision: rehydration map UX — browser-only reversibility

## Question

Should the user see/download the redaction rehydration map, or is it internal?

## Resolution

**Browser-only reversibility** — the map stays in the browser session.

- Rehydration maps stored in **`sessionStorage`** (encrypted in memory via Zustand)
- User can restore redacted values within the same browser session
- Map is cleared when the tab closes — it never leaves the browser
- The AI explains reversibility in the conversational flow: *"These redactions are stored only in your browser. Close the tab and they're gone."*

**Why not the other options:**
- **A (total irreversibility)**: Wrong — the user wants to chat with their files and may need to restore originals. But irreversibility is the right default for the ZIP when sharing externally.
- **B (passphrase-encrypted download)**: Over-engineering — if they want to share reversibly they'd just keep the originals.
- **D (skip reversibility)**: Loses a useful feature — the whole point is a conversational workspace, not a one-way shredder.

**Architecture:**
- `/api/redact` returns `{ redactedText, rehydrationMap, detections }` (from T1)
- Client stores `rehydrationMap` in Zustand (`useFilesStore`)
- Zustand persists to `sessionStorage` (not `localStorage`)
- ZIP download: redaction map is NOT included — only the redacted files
- Restore button in CodeMirror editor: lets user restore `[EMAIL_0]` → original inline (from the stored map)
- If user refreshes: `sessionStorage` survives the refresh within the tab, but copying the link to another device loses the map

**Conversational implications:**
- After first redaction: *"I've redacted 47 items across 12 files. You can undo any redaction by clicking it in the editor. These mappings stay in your browser — close the tab and they're gone."*
- On ZIP download: *"Your ZIP is ready. It contains only the redacted files — no redaction map is included. To restore originals, stay in this tab."*
