# 02: scripts/build_allfontsgen.js — implement Linux g++ compilation

**What to build:** Implement the Linux compilation path in `scripts/build_allfontsgen.js`. Currently it errors with `"Linux build not implemented"`. Replace the stub with a working `g++` compilation that:

1. Clones or reuses the existing OnlyOffice/core checkout at the pinned commit
2. Compiles `DesktopEditor/AllFontsGen/main.cpp` with the same include paths and defines as the macOS clang path
3. Uses `-l` flags instead of macOS `-framework` flags, linking against the `.so` shared libraries in `converter/`
4. Places the resulting binary at `converter/allfontsgen`
5. Cleans up the DesktopEditors directory after compilation

The macOS and Windows paths must remain unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Running `scripts/build_allfontsgen.js` on Linux produces `converter/allfontsgen`
- [ ] `allfontsgen --help` or equivalent runs without error on Linux
- [ ] `generate_office_fonts.js` (which already has a Linux `locateBinary()` path) finds and runs the binary without modification
- [ ] The macOS and Windows compilation paths are unaffected
