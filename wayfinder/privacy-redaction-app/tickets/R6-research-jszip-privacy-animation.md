# R6 — Research: jszip client-side ZIP generation + privacy loading animation

## Question

How do you generate a ZIP file client-side and trigger a download, and how do you design a loading animation that signals "processing happens locally — your files are private"? Specifically:
1. jszip: what is the API to create a ZIP from in-memory file blobs and trigger a browser download?
2. How do you preserve folder hierarchy in the ZIP (create nested directories)?
3. How do you avoid memory issues with large ZIP files (streaming, chunking)?
4. What loading animation pattern signals "local processing, files never leave your device"? Is there a shadcn/ui spinner or progress component?
5. How do you show per-file progress (e.g., "redacting file 3 of 47") in the chat stream?
6. Is there a well-known animation or icon that communicates "privacy" (like a shield or local processing indicator)?

## Method

1. Look at jszip documentation and examples.
2. Look at shadcn/ui for spinner, progress, and toast components.
3. Search for "local processing privacy animation" or similar UI patterns.
4. Save findings as `wayfinder/privacy-redaction-app/research/r6-jszip-privacy-animation.md`.

## Acceptance

- Each sub-question answered with citations.
- Research file committed to `wayfinder/privacy-redaction-app/research/r6-jszip-privacy-animation.md`.
