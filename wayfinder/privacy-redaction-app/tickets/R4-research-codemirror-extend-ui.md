# R4 — Research: CodeMirror 6 + extend-hq/ui in a split pane

## Question

How do CodeMirror 6 and extend-hq/ui integrate in a split-pane conversational artifact panel? Specifically:
1. CodeMirror 6: what React wrapper package (`@codemirror/react`?) and what is the minimal setup for a markdown editor with syntax highlighting?
2. extend-hq/ui: what is it, how do you use it to render markdown, and does it support editable code blocks?
3. Can CodeMirror and extend-hq/ui be composed: CodeMirror as the editing layer, extend-hq/ui for read-only render?
4. How do you handle the split-pane layout (50% chat / 50% artifact) — CSS grid, `react-resizable-panels`, or something else?
5. Is there a shadcn/ui panel component, or a standard pattern for this in the Vercel AI ecosystem?
6. How do you keep the CodeMirror editor and the extend-hq/ui preview in sync (single source of truth)?

## Method

1. Use `context7_resolve_library_id` for "codemirror 6 react", "shadcn ui", and look for "extend-hq/ui" or "ui-elements" docs.
2. Search the web for "extend-hq/ui" to understand the package.
3. Look for Vercel AI example projects that use a split-pane artifact panel.
4. Save findings as `wayfinder/privacy-redaction-app/research/r4-codemirror-extend-ui-splitpane.md`.

## Acceptance

- Each sub-question answered with citations.
- Research file committed to `wayfinder/privacy-redaction-app/research/r4-codemirror-extend-ui-splitpane.md`.
