# 04: CI integration — verify Linux build artifact serves documents end-to-end

**What to build:** Add a Playwright end-to-end test that runs against the freshly built Linux artifact (downloaded from the GitHub release or built locally). The test must:

1. Download and extract `oo-editors-linux-x64.zip`
2. Start `server.js` with a valid `FONT_DATA_DIR` pointing to generated font metadata
3. Navigate to `http://localhost:38123/open?filepath=<test-docx>`
4. Confirm the page loads without console errors and the document is rendered

This test runs on `ubuntu-latest` in the CI and proves the entire Linux path works: download → extraction → converter → font metadata → HTTP server → document rendering.

The test should live in the existing `test/` or `__tests__/` directory using the same Playwright setup as the macOS/Windows e2e tests.

**Blocked by:** 01 (download-converter.js Linux extraction), 02 (build_allfontsgen.js Linux compilation), 03 (release workflow Linux job)

**Status:** ready-for-agent

- [ ] Test downloads the Linux artifact and starts the server on Ubuntu
- [ ] A DOCX served via `http://localhost:38123/open` renders without console errors
- [ ] Test passes on every subsequent release (regression guard)
