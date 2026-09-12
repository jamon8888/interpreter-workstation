# T5 — Wire client-side binary file extraction to the redact API

## Question

How do we extract text from binary files (PDF, images, Word docs) client-side and feed it to `/api/redact`?

## Context

R5 found: pdf.js (PDF), mammoth.js (Word), SheetJS (Excel), Tesseract.js (OCR for images) are the client-side extraction stack.

The flow is:
1. User drops PDF/image/Word file
2. Client-side extraction → raw text
3. Raw text → `/api/redact`
4. Redacted text returned

## Method

1. Confirm which file types are in scope (PDF, images, Word, Excel, or all of these)
2. Evaluate each library's browser WASM compatibility
3. Design the extraction API: `extractText(file: File): Promise<string>`
4. Integrate with the upload flow: if binary file, extract first, then send to redact API
5. Handle extraction failures gracefully (some PDFs are scanned images → Tesseract fallback)

## Resolution

- Post the confirmed file types and library choices.
- Note any extraction quality concerns.
