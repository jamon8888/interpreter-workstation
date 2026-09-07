# R7 — Research: Basemind Rust fork — NER pipeline, API, and Vercel Edge deployment

**Research date:** 2026-09-06
**Source:** `basemind/` in this checkout (`https://github.com/jamon8888/basemind.git`, fork of `https://github.com/Goldziher/basemind.git`)

---

## 1. NER Pipeline — Entity Types, Redaction, Per-Request Configuration

### Entity Types Detected

The Basemind fork has a well-developed PII module at `src/pii.rs` with **~40 `PiiCategory` variants** covering:

**Personal identifiers:**
- `PersonFullName`, `PersonFirstName`, `PersonLastName`
- `DateOfBirth`
- `Email`, `PhoneNumber`
- `Address`, `City`, `PostalCode`

**EU National IDs** (with format validators):
- `NationalIdFr` — French NIR (regex: `r"\b[12]\d{2}(?:0[1-9]|1[0-2])(?:\d{2}|2[AB])\d{8}\b"`)
- `NationalIdNl` — Dutch BSN
- `NationalIdBe` — Belgian NISS
- `NationalIdAt` — Austrian SVNR
- `NationalIdIe` — Irish PPS
- `NationalIdPt` — Portuguese NIF
- `NationalIdGeneric`

**Financial:**
- `Iban`, `CreditCard`, `BankAccount`

**Documents:**
- `PassportNumber`, `DriversLicense`, `TaxId`

**Secrets / Credentials (all `SensitivityTier::HARD_BLOCK`):**
- `AwsAccessKey`, `AwsSecretKey`, `GcpCredentials`, `AzureCredentials`
- `ApiKey`, `JwtToken`, `BearerToken`, `OAuthToken`
- `SshPrivateKey`, `GpgPrivateKey`, `TlsCertificate`
- `DbConnectionString`, `EnvSecret`

**Infrastructure:**
- `IpAddress`, `InternalHostname`, `InternalUrl`, `MacAddress`, `CookieId`

**Other:**
- `Organization`, `Location`

**Source:** `src/pii.rs:52–97` (`PiiCategory` enum) and `src/pii/patterns.rs:13–44` (regex patterns for EU national IDs) and `src/pii/patterns.rs:53–151` (code security credential patterns).

### How Redaction Marking Works

- The `PiiEntity` struct (`src/pii.rs:180–201`) stores a **`value_hash`** (SHA-256 digest of the actual value), NOT the plain value — enabling GDPR Article 30 accountability without retaining the raw PII.
- `soft_erase()` (`src/pii/pipeline.rs:192–194`) replaces `value_hash` with `"ERASED"` for right-to-erasure compliance, preserving audit trail (category, locations, detected_at).
- `DedectedSpan` (`src/pii/pipeline.rs:152–157`) stores char offsets into the source text; `dedupe_spans()` merges overlapping GLiNER + regex detections.

### Per-Request Configuration

- Confidence thresholds per entity type defined in `confidence_threshold()` (`src/pii/pipeline.rs:10–44`): secrets/legal at 0.95, names at 0.75, generic at 0.80.
- GLiNER label thresholds in `gliner_label_threshold()` (`src/pii/pipeline.rs:54–59`): lenient for secrets (0.3 recall), strict for names (0.7).
- No evidence of per-request custom entity pattern injection in the current codebase — the patterns are static const arrays. Custom patterns would need a new configuration mechanism.

### NER Model

- Uses **`xberg/ner-onnx`** feature — ONNX-runtime NER model via the `xberg` crate (`Cargo.toml:58`).
- xberg is at `https://github.com/xberg-io/xberg.git` (pinned rev `71297af8da8913d38a3f43b81eed35e29aafa6b7`).
- GLiNER label thresholds suggest a GLiNER model is used (`gliner_label_threshold` in `src/pii/pipeline.rs:54`).

---

## 2. API Interface — Existing HTTP API, gRPC, or Edge Wrapper

**No existing HTTP API.** Basemind is an MCP server (stdio transport) or CLI binary.

- MCP server: `basemind serve` — stdio JSON-RPC, no HTTP.
- CLI: `basemind scan`, `basemind code …`, etc.
- The npm package (`npm-package/bin/basemind.js`) is a Node.js wrapper that downloads/shells out to the native binary.

**`server/utils/xbergPipelineBinary.ts`** is a stub — `resolveXbergPipelineBinary()` returns `''` (empty string). No Basemind integration exists yet.

**For Vercel Edge deployment**, a new HTTP wrapper (Edge Function) would need to be built. The current architecture has no HTTP serving layer.

---

## 3. Binary Handling — PDF, Images, Word Docs vs Raw Text

**With the `documents` feature enabled** (the default for deployments), basemind uses **`xberg`** for document extraction:

- `xberg/formats` — handles PDF, Office (Word, Excel, PowerPoint), HTML, email, images via OCR
- `xberg/paddle-ocr` — OCR for images
- `xberg/layout-detection` — layout analysis for PDFs/images
- `xberg/redaction` — redaction capability within xberg itself
- `xberg/redaction-rehydrate` — placeholder token replacement post-redaction

**Without `documents`**, basemind only processes **raw text** via tree-sitter parsing (code files).

**The pipeline layers (`src/extract/`):**
- `l1.rs` — symbols, imports, implementations (tree-sitter)
- `l2.rs` — calls, doc comments
- `l3.rs` — cross-file references
- `doc.rs` — xberg document extraction integration

xberg is NOT a submodule — it's a git dependency fetched from `https://github.com/xberg-io/xberg.git`.

---

## 4. Vercel Edge — Existing `@vercel/edge` Wrapper or Deployment

**No existing Vercel Edge deployment.** This is a native Rust binary; there is no Edge Function wrapper.

Searched the entire codebase for `vercel`, `edge`, `wasm32`, `webassembly` — no matches related to edge deployment. The `wasm` mentions in the codebase are exclusively:
- Denylist entries for `.wasm` binary files (not to be scanned/indexed)
- A `sysres.rs` note that `wasm` target has no `cgroup` support

**xberg's ONNX dependency** (`xberg/ner-onnx`) is the main challenge for edge deployment — ONNX Runtime can run on WASM, but xberg's specific ONNX model usage would need evaluation for WASM compatibility.

---

## 5. Deployment — Wasm Compilation, Separate Service, or Binary

Basemind is deployed as a **native binary** — no WASM, no Vercel Edge today.

**Deployment channels:**
- Homebrew: `brew install Goldziher/tap/basemind`
- npm: `npm install -g basemind` (downloads platform binary from GitHub Releases)
- pip: `pip install basemind`
- cargo: `cargo install basemind --locked` or `cargo install basemind --features full --locked`
- GitHub Releases: pre-compiled binaries for macOS (x86_64 + arm64), Linux, Windows

**For Vercel Edge**, the path would be:
1. Compile Rust to WASM (`cargo build --target wasm32-unknown-unknown`) — requires `wasm32` toolchain
2. Bundle the ONNX model into the WASM or serve it as a separate asset
3. Wrap in a Vercel Edge Function (`@vercel/edge`)

This is not currently implemented.

---

## 6. Code Location — Submodule, Repo URL, Fork Status

**Not a git submodule.** The `basemind/` directory is a regular git checkout within this repo.

- **Upstream:** `https://github.com/Goldziher/basemind.git` (original basemind)
- **Fork origin:** `https://github.com/jamon8888/basemind.git` (jamon8888 fork, used as `origin` in this checkout)
- **This checkout's `upstream`:** `https://github.com/Goldziher/basemind.git`

The fork appears to have custom PII/entity detection additions (the `src/pii*` modules) that are not in the upstream — these are the "Basemind Rust fork" modifications for this project's privacy redaction use case.

---

## Summary Table

| Question | Answer |
|---|---|
| Entity types | ~40 PiiCategory variants (EU national IDs, credentials, personal data, financial, infrastructure) |
| Redaction mechanism | SHA-256 `value_hash` stored (not raw value), `soft_erase()` for GDPR right-to-erasure, char-offset spans |
| Per-request config | Static pattern arrays; per-type confidence thresholds; no dynamic custom pattern injection yet |
| NER model | `xberg/ner-onnx` (GLiNER-style ONNX model via xberg crate) |
| API | MCP server (`basemind serve`, stdio JSON-RPC) + CLI. No HTTP API exists. |
| Document formats | PDF/Office/images via xberg with `documents` feature; raw text only without it |
| Vercel Edge | **Not implemented.** Native binary only. Would need Rust→WASM compilation + ONNX WASM runtime + Edge wrapper. |
| Code location | `basemind/` in this checkout, git remote `origin` = `https://github.com/jamon8888/basemind.git`, fork of `https://github.com/Goldziher/basemind.git`. Not a submodule. |

---

## Open Questions (Not Yet Answered from Available Sources)

1. **Custom entity patterns** — Can a user add custom regex patterns per request? The current patterns are `const` arrays. Would need a config extension.
2. **ONNX model file** — Which specific GLiNER model is used? Size? Is it bundled or downloaded at runtime?
3. **Redaction placeholder format** — What token replaces a redacted entity? `[REDACTED-IBAN]`? `[EMAIL]`? Not visible in the current source.
4. **Vercel Edge API contract** — What does the HTTP request/response look like between Next.js and the Edge function? Not yet designed.
