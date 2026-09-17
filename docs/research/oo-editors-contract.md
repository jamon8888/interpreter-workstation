# oo-editors upstream release and runtime contract (research for #224)

**Date:** 2026-09-17
**Question (#224, part of #219):** What exactly does Hacienda need to consume upstream
`openinterpreter/oo-editors` releases? Facts only — no config edits, no license judgment.
**Method:** primary sources only — `gh api repos/openinterpreter/oo-editors/...`,
`https://raw.githubusercontent.com/openinterpreter/oo-editors/main/...`
(`server.js` sha `9121118`, `package.json` v1.0.40), and this repo's
`electron/services/office-extension*.ts`, `shared/productConfig.ts`, `product.json`.

## 1. Upstream releases — artifacts and URLs

- **Repo:** `https://github.com/openinterpreter/oo-editors`
  (`gh api repos/openinterpreter/oo-editors/contents` lists `server.js`,
  `server-lifecycle.js`, `server-utils.js`, `download-converter.js`, `scripts/`,
  `package.json`).
- **Latest release (2026-06-09):** tag `v1.0.40`, `published_at 2026-06-09T07:18:33Z`,
  `html_url https://github.com/openinterpreter/oo-editors/releases/tag/v1.0.40`
  (`gh api repos/openinterpreter/oo-editors/releases/latest --jq`).
  Upstream `package.json` on main also says `"version": "1.0.40"`, `"main": "server.js"`.
- **Assets in every recent release (v1.0.13–v1.0.40 sampled): exactly three zips, same names:**
  - `oo-editors-darwin-arm64.zip` (v1.0.40: 192,132,690 bytes)
  - `oo-editors-darwin-x64.zip` (v1.0.40: 162,892,801 bytes)
  - `oo-editors-windows-x64.zip` (v1.0.40: 143,042,182 bytes)
  - No Linux asset exists in any listed release.
- **Versioned download URL pattern:**
  `https://github.com/openinterpreter/oo-editors/releases/download/<tag>/<asset-name>`
  e.g. `.../releases/download/v1.0.40/oo-editors-darwin-arm64.zip`
  (v1.0.40 `browser_download_url` values from the releases API).
- **How Workstation resolves them:** `electron/services/office-extension.ts`
  builds `https://api.github.com/repos/<releaseRepository>/releases/latest`
  (`DOCUMENT_ENGINE_RELEASE_REPOSITORY`, lines 168-172), `GET`s it with
  `Accept: application/vnd.github+json` (lines 193-224), then picks the asset by
  substring match in `ARCH_ASSET_PATTERNS` (lines 174-178, 226-234):
  `darwin-arm64 → [darwin-arm64, macos-arm64, mac-arm64]`,
  `darwin-x64 → [darwin-x64, darwin-amd64, macos-x64, mac-x64]`,
  `windows-x64 → [windows-x64, windows-amd64, win64]`.
  Download follows 301/302 redirects (`downloadToFile`, lines 492-562).
- **Supported platforms in-app:** `getArch()` (lines 155-166) returns only
  `darwin-arm64 | darwin-x64 | windows-x64` and **throws**
  `Unsupported platform: <platform>-<arch>` for anything else (i.e. Linux unsupported).
- **Upstream license state (fact only, judgment deferred):** upstream `README.md`
  says `AGPL-3.0 -- see LICENSE`; repo root contains a `LICENSE` file
  (contents listing). No evaluation here per #224.

## 2. Local runtime protocol (port, endpoints, startup/shutdown)

- **Port:** `const PORT = 38123` (`office-extension.ts:34`).
  Server: `const PORT = Number.parseInt(process.env.PORT || '38123', 10)` and
  `BASE_URL = http://localhost:${PORT}` (`server.js`, upstream main).
- **Endpoints observed in upstream `server.js` route table** (via `app.get|post|use` scan):
  - `GET /healthcheck` → `Content-Type: text/plain`, body `true` (server.js).
    Client `isOfficeExtensionRunning()` (`office-extension.ts:663-681`) `fetch`es
    `http://localhost:38123/healthcheck` with a 2 s abort timeout and returns
    `response.ok && text.includes('true')`.
  - `GET /open?filepath=<absolute>&lang=&theme=` — absolute path required
    (400 otherwise); builds `http://localhost:${PORT}/api/convert?filepath=...`,
    converts via x2t, serves editor HTML (server.js; README "Document Flow").
  - `POST /converter` — OnlyOffice Document Server compat endpoint. Accepts raw
    JSON `{filetype, key, outputtype, title, url}` **or** a JWT `token` (decoded
    without verification — "local trusted environment", server.js). `url` must be
    an existing local path or an `http(s)` URL matching
    `/api/onlyoffice/files/<abs-path>`. Workstation `convertFile()`
    (`office-extension.ts:1030-1076`) POSTs
    `{filetype, outputtype, key, title, filePath|url, outputPath?}` to
    `http://localhost:38123/converter` and expects `{error: 0, url}` on success
    (or `{success, outputPath}` when `outputPath` is passed).
  - `POST /api/save?filepath=<absolute>&filehash=` — writes the SDK binary back
    to the original absolute path via x2t (server.js; README "Document Flow").
  - Supporting routes (same scan): `GET /api/convert`, `GET /converted/:filename`,
    `GET /load/:filename`, `GET /raw/:filename`, `GET /offline/:filename`,
    `GET /edit/:filename`, `GET /file/:filename`, `GET /api/document/:filename`,
    `POST /api/media/:filehash`, `GET /api/media/:filehash/:imagefile`,
    `GET /api/media-list/:filehash`, `GET /api/doc-base/:filehash/*`,
    `GET /fonts/*`, `GET /fonts-info.js`, `GET /sdkjs/common/AllFonts.js`,
    `GET /document_editor_service_worker.js`, `GET /desktop-stub*.js`,
    `GET */*.wasm`, `/static-test` mount.
- **Client startup sequence** (`doStartupOoEditors`, lines 760-934):
  1. Require `<installDir>/server.js` (`isOoEditorsInstalled`, lines 251-254;
     retry once after 500 ms post-extract for filesystem sync).
  2. Ensure font metadata exists, else run `scripts/generate_office_fonts.js`
     (lines 783-794; details in §3).
  3. Free port 38123 (`ensurePortAvailableForStartup`, lines 646-661: kill
     listeners, up to 3 attempts).
  4. `spawn(process.execPath, [server.js], {cwd: <exe dir>, env: serverEnv})`
     where `serverEnv` sets `ELECTRON_RUN_AS_NODE=1`,
     `NODE_PATH=<appPath>/node_modules`, `NODE_ENV`, `PORT=38123`,
     `FONT_DATA_DIR=<userData>/office-extension-fontdata`,
     `OO_EDITOR_SENTRY_DSN` (`office-extension-startup.ts:80-104`;
     `resolveOoEditorsNodeRuntime` pins the Electron binary as the Node runtime,
     cwd = exe dir — Windows ICU-data workaround noted lines 57-78).
  5. Poll `/healthcheck` 30 × 1 s (`waitForServerReady`, lines 744-758);
     throw `oo-editors server failed to start within expected time` on timeout.
- **Server startup gates** (server.js, upstream main): exit(1) unless
  `FONT_DATA_DIR` env is set **and** the dir exists **and** contains `AllFonts.js`;
  `editors/sdkjs/slide/themes` must exist; `x2t` binary from `resolveX2TPath`
  must exist. On success logs `[oo-editors:STARTUP] server running at
  http://localhost:38123/ version=<pkg.version>` plus `FONT_DATA_DIR=`,
  `THEME_DIR=`, `x2t=` lines (asserted in `office-extension-exit.test.ts`).
  Binds via `startListeningWithRetry` (`server-lifecycle.js`); on `EADDRINUSE`
  retries and kills the holder unless `OO_EDITOR_KILL_PORT_ON_CONFLICT` is
  `0/false/no`.
- **Shutdown:** client `shutdownOfficeExtension()` (lines 974-1028) sends
  `SIGTERM` to the child then `gracefulTerminateChild` (`termTimeoutMs: 1500`,
  `killTimeoutMs: 1000`; `SIGKILL` fallback).
  Server: `SIGTERM/SIGINT/disconnect → shutdownServer(reason, 0)` with a 5 s
  force-exit timer and Sentry flush; `uncaughtException/unhandledRejection →
  shutdown(kind, 1)`; stdio `EPIPE` → `shutdown('<stream>-epipe', 0)` (server.js;
  `server-lifecycle.js` `createStdIoState/handleProcessFailure/`killPortProcess`).
  Client exit classification suppresses shutdown/app-quit/renderer-gone-cascade/
  second-instance/Windows `1073807364` (DBG_TERMINATE_PROCESS) noise
  (`office-extension-exit.ts`).

## 3. x2t converter + font-data dependencies

- **x2t provenance:** `download-converter.js` (upstream) pins
  `BASE_URL=https://github.com/ONLYOFFICE/DesktopEditors/releases/download/v9.1.0`:
  macOS arm64 ← `ONLYOFFICE-arm.dmg`, macOS x64 ← `ONLYOFFICE-x86_64.dmg`,
  Windows x64 ← `DesktopEditors_x64.zip` ("Windows MUST use x64 ... 0xC0000135").
  It extracts the `converter/` directory into the release root. Header comment:
  changing this version **requires** re-pinning the `sdkjs/` subtree (pins
  `sdkjs @ d169f841...` for v9.1.0) — mismatched SDK/UI causes font/chart/API bugs.
- **x2t resolution at runtime:** `resolveX2TPath(rootDir)` (`server-utils.js:252`):
  win32 candidates `[<root>/converter/x2t.exe, <root>/converter/x2t]`,
  posix `[<root>/converter/x2t]`; first existing wins. Missing binary → server
  `STARTUP x2t binary not found` + exit(1). Test log sample in
  `office-extension-exit.test.ts:81`:
  `x2t=C:\Users\Example\...\oo-editors\converter\x2t.exe`.
- **Font data:** `FONT_DATA_DIR` env (absolute or relative to server root).
  Server requires `AllFonts.js` inside it; serves it verbatim at
  `/fonts-info.js` and as the `/sdkjs/common/AllFonts.js` override, and passes
  `m_sFontDir=FONT_DATA_DIR`, `m_sThemeDir=<root>/editors/sdkjs/slide/themes`
  into every x2t XML job (`server.js` CONVERT/CONVERTER/SAVE paths).
- **Client side:** font dir is fixed at
  `<userData>/office-extension-fontdata` (`getFontDataDir`, line 247-249);
  required files are `AllFonts.js` + `font_selection.bin`
  (`office-extension-font-metadata.ts:9-28`). If absent at startup, the client
  spawns `<installDir>/scripts/generate_office_fonts.js` with the same Electron
  Node runtime + server env, then asserts both files exist (lines 683-742).
  Upstream build pipeline (`package.json` scripts): `bun download-converter.js
  && bun scripts/build_allfontsgen.js && cross-env
  FONT_DATA_DIR=assets/onlyoffice-fontdata bun ./scripts/generate_office_fonts.js`.
  Upstream `scripts/` contains `generate_office_fonts.js`, `build_allfontsgen.js`,
  `patches/` (contents API).

## 4. Minimum `distribution.documentEngine` config (from `office-extension.ts`)

- **Schema:** `shared/productConfig.ts:29-32` —
  `documentEngine: { releaseRepository: string; installDirectoryName: string }`.
- **Community default (`product.json`):**
  `documentEngine: { releaseRepository: "", installDirectoryName: "document-engine" }`
  (empty repo = "no compatible document engine configured" state).
- **`releaseRepository`** (`office-extension.ts:168-172, 193-196, 309-314`):
  trimmed; empty → `GITHUB_RELEASES_URL = ''` → `fetchLatestGitHubRelease()`
  returns `null` → `installOoEditors()` **throws**
  `No compatible document engine is configured for this distribution. Configure
  one in product.json or use code-and-skills document workflows.`
  (update checks degrade to no-op instead). **Hacienda minimum: non-empty
  `"openinterpreter/oo-editors"`.**
- **`installDirectoryName`** (`office-extension.ts:236-245`):
  `getOoEditorsDir() = join(app.getPath('userData'), installDirectoryName)`;
  every install/extract/validate/start path keys off
  `<userData>/<installDirectoryName>/{server.js, package.json}`.
  (Existing tests/logs assume the `oo-editors` layout, e.g.
  `.../oo-editors/server.js` in `office-extension-exit.test.ts:383`.)
  **Hacienda minimum: set to the install folder name the distribution owns
  (expected `"oo-editors"`); exact value is a later-ticket decision — this ticket
  records only the contract.**
- **Explicitly out of scope for #224:** editing `product.json` or app code,
  version-pinning policy, license judgment (later tickets).

## Sources

- `gh api repos/openinterpreter/oo-editors/releases`
  (`v1.0.13`–`v1.0.40` asset-name list) and `.../releases/latest --jq`
  (tag/published/assets/sizes/URLs).
- `https://raw.githubusercontent.com/openinterpreter/oo-editors/main/server.js`
  (1634 lines, sha `9121118`), `server-lifecycle.js` (293 lines),
  `server-utils.js` (`resolveX2TPath`, `getX2TFormatCode`), `package.json`
  (v1.0.40, scripts), `download-converter.js` (v9.1.0 pin, sdkjs re-pin procedure),
  `README.md` (Document Flow, AGPL-3.0 line).
- This repo: `electron/services/office-extension.ts` (port, release fetch,
  install/start/stop/convert), `office-extension-startup.ts` (Node runtime, env),
  `office-extension-font-metadata.ts` (required files),
  `office-extension-exit.ts` + `office-extension-exit.test.ts` (log markers),
  `office-extension-port.test.ts`, `shared/productConfig.ts`, `product.json`.
