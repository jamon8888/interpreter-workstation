# Add Linux Build to oo-editors

## Problem Statement

The oo-editors project bundles OnlyOffice's document converter (`x2t`) and SDK for embedded DOCX/XLSX/PPTX viewing and editing. The release artifact is downloaded by the Interpreter Desktop app at runtime. Currently, only macOS (arm64, x64) and Windows (x64) builds are released. Linux is excluded because:

1. The `download-converter.js` script has no Linux download path (throws `"Unsupported platform: linux"`)
2. The CI release workflow builds only macOS and Windows
3. The `build_allfontsgen.js` script has a Linux stub that exits with an error

The result: when a Linux user opens an Office document in the Interpreter Desktop app, `getArch()` throws `"Unsupported platform: linux-x64"`, and the document preview fails with a user-facing error instead of rendering.

## Solution

Extend the oo-editors release pipeline to produce a Linux build alongside the existing macOS and Windows builds. The Linux build packages the same `x2t` converter and `allfontsgen` font utility from OnlyOffice's pre-built Linux artifacts, without requiring compilation from source.

## User Stories

1. As a Linux desktop user, I want to open DOCX/XLSX/PPTX files in the Interpreter Desktop app, so that I can preview Office documents without installing LibreOffice or other external tools.

2. As a Linux desktop user, I want Office document previews to work the same way on Linux as on macOS and Windows, so that I am not reminded of platform limitations during normal use.

3. As a distribution maintainer, I want oo-editors to ship with my platform's architecture in the release artifacts, so that I do not need to patch the download URL at packaging time.

4. As a developer, I want the Linux build to use the same extraction and bundling pattern as macOS and Windows, so that the release script remains coherent and maintainable.

5. As a CI maintainer, I want the Linux build to run on a standard GitHub Actions runner without special hardware or licensing, so that the build remains reproducible and free.

6. As a user on a headless Linux server, I want document conversion to work without a graphical display, so that the desktop app functions on headless Linux setups (where applicable).

7. As a Linux desktop user with a HiDPI display, I want the font metadata generator (`allfontsgen`) to run on Linux, so that font rendering in Office previews is correct and not substituting fallback fonts.

## Implementation Decisions

### Converter download

OnlyOffice publishes `DesktopEditors-x86_64.AppImage` in each release (e.g. `v9.1.0`). The AppImage is a self-extracting archive; the `converter/` directory and its contents (including `x2t` and supporting shared libraries) can be extracted by running the AppImage with `--appimage-extract`.

The `download-converter.js` script will be extended with:

- A `TARGET_PLATFORM=linux` download URL pointing to `DesktopEditors-x86_64.AppImage`
- An `extractAppImage(destPath)` function that runs `DesktopEditors-x86_64.AppImage --appimage-extract` and copies the `squashfs-root/` contents to `converter/`
- After extraction, the `converter/` directory will contain `x2t` and other binaries that work without a display server

### Font metadata generator

The `build_allfontsgen.js` script currently errors on Linux with `"Linux build not implemented"`. OnlyOffice does not ship a pre-built Linux `allfontsgen` binary, but the source is available in the OnlyOffice/core repository (same commit already pinned by the macOS/Windows builds).

The Linux `allfontsgen` will be compiled using `g++` against the same core sources, with the same include paths and defines as the macOS clang build. The script will be updated to:

- Detect Linux platform and skip the macOS-specific `-F` and `-framework` flags
- Use `g++` with `-l` library flags instead of `-framework` flags
- Link against the `.so` shared libraries found in the extracted AppImage's `converter/` directory

### Release workflow

The `.github/workflows/release.yml` matrix will add:

```yaml
- os: ubuntu-latest
  platform: linux-x64
  zip_name: oo-editors-linux-x64.zip
```

The Linux runner will run on `ubuntu-latest`, consistent with the existing SDK build and test jobs.

The Unix bundle creation step will be adapted to handle the Linux output directory (the `converter/` structure is identical across platforms, so the existing zip step works as-is).

### Font metadata runtime

The `generate_office_fonts.js` script already has a Linux code path in `locateBinary()` that looks for `converter/allfontsgen`. Once the binary is placed there by the build step, no runtime changes are needed.

### Platform detection compatibility

The `getArch()` function in the Interpreter Desktop app (`office-extension.ts`) currently throws on Linux. Once a `oo-editors-linux-x64.zip` release artifact exists, the following change will enable it:

- In `office-extension.ts`: extend `ARCH_ASSET_PATTERNS` to include `'linux-x64': ['linux-x64', 'linux']`
- In `office-extension-startup.ts`: `isSupportedPlatform()` currently returns `false` for Linux — this will become `true` once the above pattern is registered, and the background install will proceed automatically

No changes to the startup logic itself are needed — the spawn, environment, and stdout/stderr handling are platform-agnostic.

### AppImage extraction considerations

The `DesktopEditors-x86_64.AppImage` requires execution permission and extracts via `fuse` (squashfs). On GitHub Actions runners, `apt-get install fuse` may be needed; alternatively, `appimage-tool` can be used to extract non-interactively. The extraction produces a `squashfs-root/` directory whose structure mirrors the macOS `ONLYOFFICE.app/Contents/Resources/` layout.

The `x2t` binary in the AppImage links against glibc and Qt libraries present on standard Linux desktop distributions. It does not require a display server for conversion operations.

## Testing Decisions

### Unit tests

The existing `__tests__/server-utils.test.js`, `__tests__/server-lifecycle.test.js`, and `__tests__/generate-office-fonts-path.test.js` are platform-agnostic and do not need modification.

A new test file `__tests__/download-converter-linux.test.js` will verify:

- `getDownloadUrl()` returns the AppImage URL when `TARGET_PLATFORM=linux`
- `extractAppImage()` produces a `converter/x2t` binary
- The extracted `converter/` directory contains the expected files (`x2t`, kernel and graphics shared libraries)

### End-to-end tests

The `test:e2e` suite (Playwright-based) will be extended to run on Linux against the local Linux build, testing:

- Document open: a DOCX served from `http://localhost:38123/open?filepath=...` renders without error
- Font metadata: `generate_office_fonts.js` runs without error and produces valid `AllFonts.js`

### CI coverage

The existing `test` job (ubuntu-latest, Bun, `bun run test:unit`) will automatically cover the new Linux code paths once they are added, since it already runs on Linux.

## Out of Scope

- Adding a Linux build to the Interpreter Desktop app's Electron main process — that change belongs in this repository and will be addressed separately
- Supporting ARM32 Linux (`armhf`) — OnlyOffice does not ship a 32-bit Linux build, and the demand is minimal
- Supporting non-glibc Linux distributions (Alpine Linux with musl) — the OnlyOffice binaries are glibc-linked
- Modifying the Interpreter Desktop app's `OfficeReadOnlyViewer` fallback chain — the fallback to `@file-viewer/react` remains unchanged while oo-editors is unavailable on Linux
- Backporting a Linux build to prior oo-editors releases — only current and future releases will include Linux artifacts
- Changing the release artifact naming scheme beyond adding the Linux variant
- Building a snap or Flatpak package — AppImage is the distributed format; packaging into snap/Flatpak is a distribution concern outside the oo-editors release process

## Further Notes

The OnlyOffice `x2t` converter does not require a display server to run — it is a CLI converter that accepts input paths and writes output files. This means the Linux converter will work in headless environments as well as on desktop Linux, subject to font availability.

The `allfontsgen` binary must be compiled from source since OnlyOffice does not distribute it pre-built for Linux. The compilation step is fast (~30 seconds on a standard runner) and has no external network dependencies beyond the already-pinned OnlyOffice/core git commit.

The AppImage extraction approach (running with `--appimage-extract`) requires the `fuse` package on the GitHub Actions runner. A fallback using `appimage-tool extract` from the `AppImageKit` releases can be used if fuse is unavailable.
