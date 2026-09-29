# R6 — Research: jszip client-side ZIP generation + privacy loading animation

**Date:** 2026-09-06
**Ticket:** R6

---

## 1. jszip: Create a ZIP from in-memory blobs and trigger browser download

JSZip creates a ZIP via `new JSZip()` → `zip.file(name, data)` → `zip.generateAsync({type: "blob"})` → `saveAs(blob, "file.zip")`.

**Source:** [JSZip README](https://github.com/Stuk/jszip), [write_zip howto](https://stuk.github.io/jszip/documentation/howto/write_zip.html)

```js
const zip = new JSZip();
zip.file("Hello.txt", "Hello World\n");
zip.file("images/smile.gif", imgData, { base64: true });

zip.generateAsync({ type: "blob" }).then(function (blob) {
  saveAs(blob, "example.zip"); // FileSaver.js
});
```

`generateAsync` returns a Promise resolving to the generated ZIP. The `type` option supports: `blob` (browser, default for downloads), `uint8array`, `arraybuffer`, `base64`, `binarystring`, `nodebuffer` (Node.js).

For the download trigger, JSZip docs recommend [FileSaver.js](https://github.com/eligrey/FileSaver.js) — it polyfills `saveAs` across browsers. Alternative: construct a Blob URL and set `location.href` to it, but FileSaver handles filenames correctly across browsers.

---

## 2. Preserve folder hierarchy (nested directories)

Use `zip.folder(name)` which returns a new JSZip instance rooted at that folder. Chain calls for nesting.

**Source:** [JSZip folder() docs](https://stuk.github.io/jszip/documentation/api_jszip/folder_name.html)

```js
const zip = new JSZip();
zip.folder("images");
zip.folder("css").file("style.css", "body {background: #FF0000}");
// Result: images/, css/, css/style.css
```

Absolute-style paths (with `/`) can also be passed directly to `file()`:

```js
zip.file("css/font.css", "body {font-family: sans-serif}");
```

Chaining `folder().folder().file()` creates deeply nested directories automatically.

---

## 3. Avoid memory issues with large ZIP files (streaming, chunking)

**Key strategies:**

1. **`streamFiles: true`** in `generateAsync` — streams individual file entries with data descriptors instead of holding them in memory. Reduces peak memory significantly. Trade-off: some zip readers don't support data descriptors.

   **Source:** [JSZip generateAsync streamFiles option](https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html)

   ```js
   zip.generateAsync({ type: 'uint8array', streamFiles: true });
   ```

2. **Use `type: "uint8array"` or `"arraybuffer"`** instead of `"blob"` for better memory control in some browsers. For very large files, prefer `uint8array` over `blob`.

   **Source:** [JSZip limitations page](https://stuk.github.io/jszip/documentation/limitations.html)

3. **Node.js streaming** — use `generateNodeStream()` which pipes to a writable file stream without loading the full result into RAM:

   ```js
   zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
     .pipe(fs.createWriteStream('out.zip'));
   ```

4. **Browser**: Strings in JS are UTF-16 — a 10MB ASCII text file takes ~20MB memory. Use typed arrays (`Uint8Array`) where possible.

5. **Chunked processing** — for extremely large inputs, process files in batches (add some files → generate partial zip → accumulate via `StreamHelper.accumulate()` with `pause()`/`resume()` backpressure handling).

---

## 4. Loading animation pattern signaling "local processing / files never leave device"

**Best patterns for "local processing, privacy" signal:**

- **Shield icon** — universally understood as "protection" or "your data is safe". Often combined with a lock or checkmark.
- **"Processing locally" / "Files never leave your device"** text label paired with spinner.
- **Device icon** — signals the computation happens on the user's machine.
- **Green lock icon** — common trust indicator; less novel than shield but widely recognized.

**Sources:** General UI/UX consensus; no single canonical reference. This pattern appears across privacy-focused tools (Signal, Bitwarden, Proton products) as shield + local-device messaging.

**shadcn/ui components available:**

- **Spinner** — `<Spinner />` (lucide-react LoaderIcon, `size-*` for scaling). Good for indeterminate wait states.

  ```tsx
  import { Spinner } from "@/components/ui/spinner"
  <Spinner />
  ```

- **Progress** — `<Progress value={33} />` for determinate progress bars. Accepts `ProgressLabel` and `ProgressValue` sub-components for rich status text.

  ```tsx
  import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
  <Progress value={56} className="w-full max-w-sm">
    <ProgressLabel>Upload progress</ProgressLabel>
    <ProgressValue />
  </Progress>
  ```

- **Toast** — `npx shadcn@latest add toast` — for success/error notifications (e.g., "Download ready" or "Redaction complete").

**Source:** [shadcn/ui Spinner docs](https://ui.shadcn.com/docs/components/spinner), [Progress docs](https://ui.shadcn.com/docs/components/progress), [Toast changelog](https://github.com/shadcn-ui/ui/blob/main/apps/v4/content/docs/changelog/2026-07-toast.mdx)

---

## 5. Per-file progress in chat stream (e.g., "redacting file 3 of 47")

The `onUpdate` callback in `generateAsync` provides `metadata.percent` (overall %) and `metadata.currentFile` (name of file being processed).

**Source:** [JSZip generateAsync onUpdate docs](https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html)

```js
zip.generateAsync(
  { type: "blob" },
  function updateCallback(metadata) {
    console.log("progression: " + metadata.percent.toFixed(2) + " %");
    if (metadata.currentFile) {
      console.log("current file = " + metadata.currentFile);
    }
  }
);
```

**Limitation:** `currentFile` only tells you *which file is currently being compressed*, not an absolute "file N of M" index. To show "file X of Y" you would need to:

1. Track total file count upfront (e.g., `const totalFiles = files.length`)
2. Maintain a running counter by listening to `currentFile` changes
3. Emit structured progress events to the chat stream (e.g., via a callback or event emitter the UI layer subscribes to)

**Recommendation:** Combine `metadata.percent` for a progress bar with a derived "X of Y" counter by tracking file transitions in `onUpdate`. Format: `"Redacting file 3 of 47: report.pdf"` as a streaming message in the chat.

---

## 6. Well-known animation/icon for "privacy" (shield, local processing indicator)

**Consensus icons:**

| Icon | Meaning |
|------|---------|
| **Shield** | Protection, privacy, security (most universal) |
| **Shield + checkmark** | Privacy verified / data safe |
| **Lock / Lock icon** | Encrypted / secure / can't be accessed |
| **Device (laptop/phone)** | Local processing / on-device |
| **Eye with slash** | Not watching / no surveillance |
| **Hand with shield** | Less common, privacy guard |

**For "local processing" specifically:** A laptop/phone icon with a small "local" badge, or a shield icon with the text "processed locally" is the clearest signal. Many privacy-focused apps (Proton, Signal, Bitwarden) use a **shield** as their primary privacy symbol.

**Animation suggestion:** A subtle shield fade-in + gentle pulse (scale 1.0 → 1.05 → 1.0 loop, ~2s) with "Processing locally..." text. Avoid rapid motion — privacy conveys calm, not urgency.

**Lucide icons available (shadcn/ui default):** `Shield`, `ShieldCheck`, `Lock`, `LockKeyhole`, `ShieldAlert`, `DeviceMobile`, `Cpu` (for local processing feel). Combine: shield + lock = "private & secure".

---

## Summary Table

| Question | Answer |
|----------|--------|
| ZIP from blobs + download | `zip.generateAsync({type:"blob"})` + FileSaver.js `saveAs()` |
| Nested folders | `zip.folder("name").file(...)` chaining |
| Large file memory | `streamFiles: true`, typed arrays, Node stream API |
| Privacy loading animation | Shield/lock icon + "Processing locally" text + Spinner |
| Per-file progress | `onUpdate` callback + `metadata.currentFile` + file counter |
| Privacy icon | Shield / ShieldCheck (lucide-react) |
