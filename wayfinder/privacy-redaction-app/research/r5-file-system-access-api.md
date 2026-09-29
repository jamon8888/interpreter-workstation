# R5 — Research: File System Access API + Drag-Drop for Folder Upload

**Ticket:** R5
**Date:** 2026-09-06
**Status:** Complete

---

## 1. Using `showDirectoryPicker()` to Let Users Select a Real Folder

The File System Access API provides `showDirectoryPicker()` to let users select a real folder from their local filesystem.

**API:**
```javascript
const dirHandle = await window.showDirectoryPicker();
```

**Source:** [WICG File System Access — EXPLAINER](https://github.com/wicg/file-system-access/blob/main/EXPLAINER.md)

**Requirements:**
- Must be called from a [secure context](https://github.com/wicg/file-system-access/blob/main/index.bs) (HTTPS or localhost)
- Requires [transient user activation](https://github.com/wicg/file-system-access/blob/main/index.bs) (must be triggered by a user gesture like a click)
- Returns a `FileSystemDirectoryHandle`

**Key Options (DirectoryPickerOptions):**
```javascript
await window.showDirectoryPicker({
  startIn: 'documents', // 'desktop', 'documents', 'downloads', 'music', 'pictures', 'videos'
  id: 'project-folder', // unique ID for remembering user's last directory for this ID
});
```

---

## 2. Recursively Reading All Files from a Picked Directory

**Modern API (File System Access API):**

Use `values()` to iterate directory contents, handling files and subdirectories recursively:

```javascript
async function getAllFiles(dirHandle, files = []) {
  for await (const [name, entry] of dirHandle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      files.push({ name, file, handle: entry });
    } else if (entry.kind === 'directory') {
      const subDir = await entry;
      await getAllFiles(subDir, files);
    }
  }
  return files;
}
```

**Source:** [WICG File System Access — EXPLAINER](https://github.com/wicg/file-system-access/blob/main/EXPLAINER.md)

**Simpler alternative using `browser-fs-access` library:**

```javascript
import { directoryOpen } from 'browser-fs-access';

const files = await directoryOpen({
  recursive: true,
  mode: 'read',
  skipDirectory: (entry) => entry.name.startsWith('.'),
});
// files is an array of File objects with .webkitRelativePath set
```

**Source:** [browser-fs-access](https://github.com/googlechromelabs/browser-fs-access)

---

## 3. Extracting Text from Common File Types (txt, md, json, csv, code files)

These can be read directly with the standard File API:

```javascript
// Read file as text
const text = await file.text();

// For specific formats:
const content = await file.text(); // txt, md, json, csv, js, ts, html, css, etc.
```

**For JSON specifically:**
```javascript
const data = JSON.parse(await file.text());
```

---

## 4. Binary Files (PDF, Images, Word docs) — Client-Side Processing

### PDF — pdf.js (Mozilla)

```javascript
import { getDocument } from 'pdfjs-dist';

const loadingTask = pdfjsLib.getDocument({ url: URL.createObjectURL(file) });
const pdf = await loadingTask.promise;

let fullText = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const { items } = await page.getTextContent();
  fullText += items.map(item => item.str).join(' ') + '\n';
}
```

**Source:** [Mozilla pdf.js — API docs](https://github.com/mozilla/pdf.js/blob/master/src/display/api.js), [Node.js example](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs)

**Note:** Requires a worker script for browser use. The legacy build (`pdfjs-dist/legacy/build/pdf.mjs`) works without explicit worker configuration.

### Word (.docx) — mammoth.js

```javascript
import mammoth from 'mammoth';

const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
console.log(result.value); // raw text
console.log(result.messages); // any warnings/errors
```

**Source:** [Mammoth.js — extractRawText](https://github.com/mwilliamson/mammoth.js/blob/master/README.md)

**Key method:**
```javascript
mammoth.extractRawText(input: { arrayBuffer: ArrayBuffer })
```

### Excel (.xlsx) — SheetJS

```javascript
import * as XLSX from 'xlsx';

const workbook = XLSX.read(await file.arrayBuffer());
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const text = XLSX.utils.sheet_to_txt(firstSheet);
// Or to JSON:
const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
```

**Source:** [SheetJS — sheet_to_txt](https://docs.sheetjs.com/docs/api/utilities/csv), [SheetJS — sheet_to_json](https://docs.sheetjs.com/docs/api/utilities/array)

### Images — OCR needed (e.g., Tesseract.js)

Images cannot have their "text" extracted directly — they require OCR. Tesseract.js can run client-side:

```javascript
import Tesseract from 'tesseract.js';

const { data: { text } } = await Tesseract.recognize(file);
```

---

## 5. Drag-and-Drop Fallback for Unavailable File System Access API

**Detection:**
```javascript
const isSupported = 'showDirectoryPicker' in window;
```

**Fallback using `<input type="file" webkitdirectory>`:**

```javascript
function openFolderFallback(onFiles) {
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;

  input.onchange = (e) => {
    const files = Array.from(e.target.files);
    onFiles(files);
  };

  input.click();
}
```

**Note:** `webkitdirectory` is supported in Chrome, Edge, and Safari. Firefox does not support it (as of 2025).

**Combined approach:**

```javascript
async function openFolder() {
  if ('showDirectoryPicker' in window) {
    // Use modern API
    const dirHandle = await window.showDirectoryPicker();
    return await getAllFiles(dirHandle);
  } else {
    // Use fallback
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = () => resolve(Array.from(input.files));
      input.click();
    });
  }
}
```

**Using browser-fs-access for automatic fallback:**

```javascript
import { directoryOpen } from 'browser-fs-access';

try {
  const files = await directoryOpen({
    recursive: true,
    mode: 'read',
  });
} catch (err) {
  if (err.name === 'AbortError') {
    // User cancelled
  } else {
    throw err;
  }
}
```

**Source:** [browser-fs-access](https://github.com/googlechromelabs/browser-fs-access) handles the fallback automatically.

---

## 6. Browser Support Matrix

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| `showDirectoryPicker()` | ✅ M86+ | ✅ M86+ | ❌ Not supported | ❌ Not supported |
| `showOpenFilePicker()` | ✅ M86+ | ✅ M86+ | ❌ Not supported | ❌ Not supported |
| `webkitdirectory` | ✅ | ✅ | ❌ | ✅ |
| `FileSystemDirectoryHandle` | ✅ M86+ | ✅ M86+ | ❌ Not supported | ❌ Not supported |

**Source:** [Can I Use — File System Access API](https://caniuse.com/?search=File%20System%20Access%20API), [browser-fs-access README](https://github.com/googlechromelabs/browser-fs-access)

**Summary:**
- **Chrome/Edge:** Full File System Access API support
- **Safari:** Partial — supports `webkitdirectory` input fallback, not the modern API
- **Firefox:** Neither — only `webkitdirectory` fallback

**Recommendation for cross-browser:** Use the `browser-fs-access` library (Google Chrome Labs), which provides automatic fallback to the `webkitdirectory` input method on unsupported browsers.

---

## Libraries Summary

| Format | Library | Size (minified) | License |
|--------|---------|-----------------|---------|
| PDF text extraction | [pdf.js](https://mozilla.github.io/pdf.js/) | ~600KB (legacy build) | Apache 2.0 |
| Word (.docx) text | [mammoth.js](https://github.com/mwilliamson/mammoth.js) | ~100KB | MIT |
| Excel (.xlsx) text | [SheetJS](https://docs.sheetjs.com/) | ~200KB | Apache 2.0 |
| File System Access polyfill | [browser-fs-access](https://github.com/googlechromelabs/browser-fs-access) | ~15KB | Apache 2.0 |

---

## References

- [WICG File System Access API — Explainer](https://github.com/wicg/file-system-access/blob/main/EXPLAINER.md)
- [WICG File System Access API — Spec](https://github.com/wicg/file-system-access/blob/main/index.bs)
- [browser-fs-access — Google Chrome Labs](https://github.com/googlechromelabs/browser-fs-access)
- [Mozilla pdf.js](https://github.com/mozilla/pdf.js)
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js)
- [SheetJS](https://docs.sheetjs.com/)
