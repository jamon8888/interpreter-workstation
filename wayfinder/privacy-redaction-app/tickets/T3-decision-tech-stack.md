# T3 — Decision: Next.js project structure and tech stack

## Question

With R1-R6 research in hand, what is the exact tech stack and project structure?

## Context

Research decisions so far:
- **Framework**: Next.js App Router (assumed)
- **UI**: shadcn/ui + Tailwind CSS + `@uiw/react-codemirror` + `react-markdown` (NOT extend-hq/ui)
- **Conversational**: `@ai-elements/react` + `@ai-sdk/react` + `useChat`
- **Split pane**: `react-resizable-panels` (shadcn `resizable`)
- **PII detection**: BLOCKED (T1) — GLiNER2 WASM is not available
- **LLM**: MiniMax 2.7 via `@ai-sdk/minimax` — free, confirmed.
- **File handling**: File System Access API + `browser-fs-access`; pdf.js/mammoth.js/SheetJS/Tesseract.js for binary extraction
- **ZIP**: jszip + FileSaver.js
- **State**: React server components + Zustand for client state (assumed)

## Method

1. Confirm Next.js App Router is the right choice (vs SvelteKit, Remix, Astro).
2. Confirm the shadcn/ui component list needed.
3. Decide on state management: Zustand vs `useState` + Context vs something else.
4. Decide: is this a new standalone repo or inside the existing interpreter-workstation monorepo?
5. Sketch the folder structure.

## Resolution

- Post the decision with the confirmed tech stack.
- Note any deviations from the research findings.
