# 03: .github/workflows/release.yml — add Linux to build matrix

**What to build:** Add `ubuntu-latest` as a build target in the CI release workflow. The new matrix entry produces `oo-editors-linux-x64.zip` containing `converter/` + `editors/` + `bundle/` + `scripts/`, matching the layout of the macOS and Windows artifacts.

The Linux job should:
1. Install Bun dependencies (`bun install --production`)
2. Download the Linux converter (`TARGET_PLATFORM=linux bun download-converter.js`)
3. Build `allfontsgen` for Linux (`bun scripts/build_allfontsgen.js`)
4. Generate font metadata (`FONT_DATA_DIR=assets/onlyoffice-fontdata bun ./scripts/generate_office_fonts.js`)
5. Bundle and zip using the existing Unix bundle step

The zip artifact must be uploaded as `oo-editors-linux-x64.zip` and included in the GitHub Release.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] CI runs a `ubuntu-latest` job alongside the existing macOS and Windows jobs
- [ ] The job produces `oo-editors-linux-x64.zip` as a release artifact
- [ ] The zip contains `converter/x2t`, `editors/`, `server.js`, and all other required files
- [ ] The macOS and Windows CI paths are unaffected
