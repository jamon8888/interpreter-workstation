# R5 — Research: File System Access API + drag-drop for folder upload

## Question

How do you use the File System Access API to let users pick a folder, and combine it with drag-and-drop as a fallback? Specifically:
1. How to use `showDirectoryPicker()` to let users select a real folder?
2. How to recursively read all files from a picked directory (including subdirectories)?
3. How to extract text content from common file types (txt, md, json, csv, code files) client-side?
4. What about binary files (PDF, images, Word docs) — can they be processed client-side? What libraries?
5. Drag-and-drop fallback: how to detect if File System Access API is unavailable and use `<input type="file" webkitdirectory>` instead?
6. What does the browser support matrix look like (Chrome, Firefox, Safari)?

## Method

1. Use `context7_resolve_library_id` for "File System Access API" or browser platform docs.
2. Search MDN for `showDirectoryPicker` and file handling APIs.
3. For binary file text extraction, look at `pdf.js`, `mammoth.js` (Word), `xlsx` for common formats.
4. Save findings as `wayfinder/privacy-redaction-app/research/r5-file-system-access-api.md`.

## Acceptance

- Each sub-question answered with citations.
- Research file committed to `wayfinder/privacy-redaction-app/research/r5-file-system-access-api.md`.
