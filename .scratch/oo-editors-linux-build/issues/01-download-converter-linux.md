# 01: download-converter.js — add Linux AppImage download and extraction

**What to build:** Extend `download-converter.js` so that running `TARGET_PLATFORM=linux bun download-converter.js` downloads `DesktopEditors-x86_64.AppImage` from the OnlyOffice DesktopEditors releases, extracts its `converter/` directory via `--appimage-extract`, and produces a working `converter/x2t` binary.

The function `getDownloadUrl()` must return the AppImage URL when `TARGET_PLATFORM=linux`. The `main()` function's platform switch must call a new `extractAppImage()` function for Linux. The `x2tPath` variable in `main()` must account for Linux naming (no `.exe` suffix, same as macOS).

The extraction must work on a standard GitHub Actions `ubuntu-latest` runner (no fuse daemon required — use `--appimage-extract`).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `TARGET_PLATFORM=linux bun download-converter.js` downloads the correct AppImage
- [ ] `converter/x2t` exists and is executable after extraction
- [ ] The `converter/` directory contains required files: `x2t`, kernel and graphics shared libraries
- [ ] `download-converter.js` still works unchanged on macOS and Windows
