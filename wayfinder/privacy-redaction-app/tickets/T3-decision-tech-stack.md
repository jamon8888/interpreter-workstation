# T3 — Decision: Next.js project structure and tech stack

## Question

With all research in hand, what is the exact tech stack and project structure?

## Resolution

### 1. Framework: Next.js App Router ✓

Next.js App Router is the right choice. Vercel AI SDK + AI Elements are built for React/Next.js. No reason to consider SvelteKit or Remix.

### 2. Standalone repo

**New standalone repository** — `privacy-redaction-app`. This is a greenfield SaaS app. It has no coupling to interpreter-workstation. Separate repo keeps deployments, dependencies, and mental model clean.

### 3. Tech stack confirmed

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | |
| Deploy target | Vercel | Zero-config |
| Conversational UI | `@ai-elements/react` + `@ai-sdk/react` | `useChat`, AI Elements streaming components |
| UI components | shadcn/ui + Tailwind CSS | Resizable panels, buttons, progress, spinner, etc. |
| Split pane | `react-resizable-panels` | shadcn `resizable` package |
| CodeMirror | `@uiw/react-codemirror` | `lang-markdown`, `language-data` extensions |
| Markdown preview | `react-markdown` + `remark-gfm` | NOT extend-hq/ui |
| State | `useChat` (AI) + Zustand (files/editing) | Lightweight, no Redux needed |
| File picker | File System Access API (native) | `browser-fs-access` for cross-browser fallback |
| Binary extraction | Basemind `xberg/documents` pipeline | Via `/api/redact` route — no client-side extraction libs |
| ZIP download | jszip + FileSaver.js | |
| LLM | `minimax-2.7` via `@ai-sdk/minimax` | Free tier confirmed |
| NER/redaction | Basemind CLI via `/api/redact` | Next.js serverless function wrapper |

### 4. shadcn/ui component list

```
npx shadcn@latest init
npx shadcn@latest add button card dialog dropdown-menu input label
npx shadcn@latest add progress resizable scroll-area separator
npx shadcn@latest add sheet skeleton tabs textarea tooltip
```

### 5. Folder structure

```
/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Redirect to /app
│   │   ├── app/
│   │   │   └── page.tsx      # Main app shell (server component)
│   │   └── api/
│   │       └── redact/
│   │           └── route.ts  # POST /api/redact — Basemind CLI wrapper
│   ├── components/
│   │   ├── ai/                # AI Elements conversational components
│   │   │   ├── chat.tsx       # useChat wrapper
│   │   │   ├── upload-trigger.tsx
│   │   │   └── redaction-stream.tsx
│   │   ├── ui/                # shadcn components
│   │   └── editor/             # CodeMirror + file finder
│   │       ├── file-finder.tsx
│   │       ├── code-editor.tsx
│   │       └── artifact-panel.tsx
│   ├── lib/
│   │   ├── basemind.ts        # Basemind CLI invocation helper
│   │   ├── file-system.ts     # File System Access API helpers
│   │   ├── zip.ts             # jszip wrapper
│   │   └── types.ts
│   └── store/
│       └── use-files.ts       # Zustand store: file list, redaction state
├── public/
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── components.json
```

### 6. State split

- **`useChat`** — conversational messages, streaming LLM responses. AI Elements owns this.
- **Zustand `useFilesStore`** — `files: FileNode[]`, `activeFileId`, `redactedContent: Record<path, string>`, `rehydrationMaps: Record<path, Record<token, original>>`. Persisted to `sessionStorage` (not `localStorage` — no server-side session).

### 7. `/api/redact` implementation note

The route uses `execFile` to call `basemind` as a subprocess. The binary must be available in the Vercel serverless environment. Options:
1. `postinstall` script that downloads the correct platform binary from GitHub releases
2. npm package `basemind` as a dependency

Option 2 is cleaner — `npm install basemind` gives us the binary via the npm package shim.

### 8. What changed from research assumptions

- Binary extraction: Basemind `xberg/documents` pipeline handles PDF/Office/images — no pdf.js, mammoth, SheetJS, or Tesseract.js
- No `browser-fs-access` polyfill needed — use File System Access API directly with a fallback check
- No extend-hq/ui at all
- No Zustand for chat state — `useChat` owns that
