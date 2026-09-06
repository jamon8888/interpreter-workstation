# T6 — Design: should users see/download the redaction rehydration map?

## Question

The `/api/redact` response includes a `rehydrationMap: Record<[TYPE_N], originalValue>`. Should the user see this, download it, or is it an internal implementation detail?

## Context

The rehydration map lets you reverse redaction (restore `[EMAIL_0]` → `john@example.com`). This is powerful but also a privacy risk if downloaded alongside the redacted files.

Options:
1. **Internal only** — the rehydration map is never exposed to the user. The redacted text is the only output. Reversibility is lost.
2. **Optional download** — the ZIP can include a `.rehydration-map.json` alongside the files. User explicitly opts in.
3. **Passphrase-encrypted download** — the rehydration map is XPPI-encrypted (Basemind's `vault` tool) and the user downloads it separately with a passphrase they set.
4. **Full reversibility** — the app stores the rehydration map in `localStorage` (encrypted) and offers restore functionality.

## Method

1. Evaluate each option's privacy/utility trade-off.
2. Recommend the right default.
3. Decide: does the conversational flow need to explain this to the user?

## Resolution

- Post the decision with rationale.
