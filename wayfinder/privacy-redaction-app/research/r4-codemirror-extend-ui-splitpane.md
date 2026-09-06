# R4 — Research: CodeMirror 6 + Extend UI in a Split Pane

**Ticket**: `wayfinder/privacy-redaction-app/tickets/R4-research-codemirror-extend-ui.md`
**Date**: 2026-09-06
**Status**: Complete

---

## 1. CodeMirror 6 React Wrapper

**Package**: `@uiw/react-codemirror` (Context7 ID: `/uiwjs/react-codemirror`)

This is the de facto CodeMirror 6 React wrapper. It provides a `CodeMirror` React component that wraps the CodeMirror 6 editor engine.

**Minimal markdown editor setup:**

```tsx
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

export default function Editor() {
  return (
    <CodeMirror
      value={content}
      extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
      onChange={(value) => setContent(value)}
    />
  );
}
```

**Dependencies to install:**
- `@uiw/react-codemirror` — the React wrapper
- `@codemirror/lang-markdown` — markdown language support
- `@codemirror/language-data` — syntax highlighting for embedded code blocks (provides `languages` array with 100+ langs)

**Minimal styling** via `minimalSetup` from `@uiw/codemirror-extensions-basic-setup` (already included by default in `@uiw/react-codemirror`).

**Sources:**
- [React Codemirror README — Markdown Highlighting](https://github.com/uiwjs/react-codemirror/blob/master/README.md)
- [React Codemirror extensions/langs](https://github.com/uiwjs/react-codemirror/blob/master/extensions/langs/README.md)

---

## 2. extend-hq/ui — What It Actually Is

**Important finding**: `extend-hq/ui` is **NOT a markdown renderer**. It is a **document component library for AI document agents** — PDF viewers, DOCX viewers, XLSX viewers, e-signature flows, bounding box citations, and Finder-style file browsers.

It is installed via `npx shadcn@latest add @extend/<component>` and ships as copy-paste source code (MIT license). The namespace on npm is `@extendhq/ui` but the components are distributed through the shadcn CLI as individual packages.

**Available components** (from https://www.extend.ai/ui/docs/components):
- PDF Viewer / PDF Editor (experimental)
- DOCX Viewer / DOCX Editor (experimental)
- Excel Viewer / Excel Editor (experimental)
- PowerPoint Viewer
- CSV Viewer
- File Upload
- File System (Finder-style browser)
- Bounding Box Citations
- Schema Builder
- File Thumbnail
- Layout Blocks
- E-Signature
- Document Splits
- Document Viewer Sidebar

**There is no markdown renderer, no editable code block component, and no text/content editing block** in Extend UI.

**Sources:**
- [Extend UI GitHub (extend-hq/ui)](https://github.com/extend-hq/ui) — 1.5k stars, 80 forks
- [Extend UI Documentation](https://www.extend.ai/ui)

---

## 3. CodeMirror + Extend UI Composition

**Can they be composed: CodeMirror for editing, Extend UI for read-only render?**

**No** — for the markdown artifact use case. Extend UI has no markdown rendering component. It is focused entirely on binary/document formats (PDF, DOCX, XLSX).

If the artifact panel needs to display **PDFs or DOCX files**, Extend UI's `PDFViewer` / `DOCXViewer` are excellent choices. But if the artifact is **markdown/code content**, Extend UI provides nothing useful.

**Recommendation for markdown artifact panel:**
- **Editing**: CodeMirror 6 (`@uiw/react-codemirror`) with markdown language extension
- **Read-only rendering**: Use `react-markdown` + `remark-gfm` + a syntax highlighter like `rehype-highlight` or `rehype-pretty-code`. This is the standard stack in the Vercel AI ecosystem.

Do not expect Extend UI to contribute here — its value is in document viewers, not text rendering.

---

## 4. Split Pane Layout

**Standard approach**: `react-resizable-panels`, exposed through shadcn/ui as `@/components/ui/resizable`.

**shadcn/ui installation:**
```bash
npx shadcn@latest add resizable
# also installs: npm install react-resizable-panels
```

**Usage (50/50 split):**
```tsx
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function SplitPane() {
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize={50}>
        {/* Chat panel */}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50}>
        {/* Artifact panel */}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

**CSS grid is an alternative for static splits**, but `react-resizable-panels` is the standard in the shadcn/Vercel AI ecosystem because it:
- Supports drag-to-resize with a visible handle
- Supports nested panel groups (vertical + horizontal combinations)
- Supports `minSize` constraints to prevent panels from collapsing
- Supports controlled mode with `onLayoutChange` for localStorage persistence

**Sources:**
- [shadcn/ui Resizable component docs](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/components/radix/resizable.mdx)
- [shadcn/ui Resizable examples](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/radix/examples/resizable-example.tsx)

---

## 5. shadcn/ui Panel Component and Vercel AI Split-Pane Examples

**shadcn/ui panel component**: Yes, `@/components/ui/resizable` (backed by `react-resizable-panels`) is the standard. There is no dedicated "panel" primitive — `ResizablePanelGroup` / `ResizablePanel` is it.

**Vercel AI ecosystem split-pane artifact pattern**: None of the Vercel AI SDK examples (`next`, `next-workflow`, `next-agent`, `harness-e2e-next`) implement a split-pane artifact panel. They all use a single-column chat layout. The split-pane pattern (50% chat / 50% artifact) is **not present in the official Vercel AI examples** and would need to be built from scratch using the `resizable` component.

The Vercel AI SDK does have block-based rendering for assistant messages via `AssistantMessage` content parts, but no official split-pane layout component exists in the SDK itself.

**Sources:**
- [Vercel AI SDK examples directory](https://github.com/vercel/ai/tree/main/examples)
- Confirmed: `next`, `next-workflow`, `next-agent`, `harness-e2e-next` all use single-column layouts (verified via source review of `page.tsx` and `chat.tsx`)

---

## 6. Keeping CodeMirror Editor and Preview in Sync

**Single source of truth**: A single React state variable holding the markdown content string. CodeMirror is the **controlled editor** (value driven by state, changes call `onChange` to update state). The read-only preview is a **derived rendering** — it reads from the same state and re-renders on changes.

```tsx
function ArtifactPanel({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  );
}
```

Both CodeMirror and `ReactMarkdown` derive from the same `content` string. No need for a separate "sync" mechanism — if they render the same string, they are always in sync.

**For streaming AI responses**: As the LLM streams tokens, append them to the content state. CodeMirror supports dynamic value updates via its `value` prop. For performance at scale, use `useDeferredValue` or throttle updates.

**For edit-in-place**: CodeMirror's `onChange` updates the content state. The preview re-renders reactively from the same state.

---

## Summary Table

| Question | Answer |
|---|---|
| **CodeMirror React package** | `@uiw/react-codemirror` |
| **Extend UI** | Document component library (PDF/DOCX viewers), NOT markdown renderer |
| **Composition possible?** | Extend UI has no markdown; use `react-markdown` for read-only preview |
| **Split pane layout** | `react-resizable-panels` via `npx shadcn@latest add resizable` |
| **shadcn panel component?** | Yes — `@/components/ui/resizable` |
| **Vercel AI split-pane example?** | None found in official examples — build from resizable |
| **Sync strategy** | Single state source + derived read-only render |

---

## Recommendations for the Privacy Redaction App

1. **Markdown editing**: `@uiw/react-codemirror` + `@codemirror/lang-markdown` + `@codemirror/language-data`
2. **Markdown rendering**: `react-markdown` + `remark-gfm` + `rehype-highlight` or `rehype-pretty-code`
3. **Split pane**: `npx shadcn@latest add resizable` — standard horizontal 50/50 with `ResizableHandle`
4. **Extend UI**: Use for document (PDF/DOCX) artifact viewing if needed, not for markdown
5. **Sync**: Single `content` state variable, both CodeMirror and preview read from it

---

*Research conducted via Context7 (shadcn/ui, react-codemirror), GitHub API, and web fetch of extend-hq/ui and Vercel AI SDK examples.*
