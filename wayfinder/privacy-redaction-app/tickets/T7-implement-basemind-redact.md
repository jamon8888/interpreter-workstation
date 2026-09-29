# T7 — Implement `basemind redact` CLI command in the Basemind fork

## Question

How do we add a `basemind redact` CLI command to the Basemind fork that exposes the existing PII pipeline as a standalone text-processing tool?

## Context

T4 found: Basemind has no text redaction CLI command. The PII pipeline (`src/pii.rs`, `src/pii/pipeline.rs`) exists but is only callable during document scanning (which requires a git repo). We need a command that takes arbitrary text and returns redacted text.

The existing building blocks:
- `PiiEntity` struct (`src/pii.rs:180`) — stores category, value_hash, DetectedSpan
- `DetectedSpan` (`src/pii/pipeline.rs:152`) — char offsets into source text
- `dedupe_spans()` (`src/pii/pipeline.rs:163`) — merges overlapping detections
- `confidence_threshold()` (`src/pii/pipeline.rs:10`) — per-category thresholds
- `RedactionStrategy` (`config/documents.rs:426`) — `token_replace`, `mask`, `hash`, `drop`
- `xberg::text::redaction` — redaction with rehydration map support

## Method

1. **New file: `src/cli/redact.rs`**
   - `#[derive(clap::Args)] struct RedactArgs`:
     - `--text` (string) — text to redact; mutually exclusive with `--file`
     - `--file` (PathBuf) — read text from file; mutually exclusive with `--text`
     - `--strategy` (enum) — `token-replace` (default) | `mask` | `hash` | `drop`
     - `--categories` (CommaDelimitedStrings) — filter to specific PiiCategory names
     - `--custom-patterns` (repeatable) — `label,pattern` pairs for user-defined regex
     - `--json` — output machine-readable JSON (default when stdout is not a TTY)
   - `run_redact(args: RedactArgs) -> anyhow::Result<()>`
   - Calls the PII detection pipeline directly (regex patterns from `src/pii/patterns.rs` + NER from `xberg/ner-onnx`)
   - Applies `dedupe_spans()` to merge overlapping detections
   - Produces `[TYPE_N]` tokens for `token_replace` strategy
   - Builds rehydration map as `Record<[TYPE_N], originalValue>`
   - Outputs JSON: `{ redactedText, rehydrationMap, detections }`

2. **Wire into `src/main.rs`**:
   - Add `Redact(RedactArgs)` to `Cmd` enum
   - Add `redact.rs` module
   - Call `run_redact()` in main dispatch

3. **Wire into `src/cli/mod.rs`** (for parity with other tools if `ToolCmd` pattern is used)

4. **Test**: `basemind redact --text "Contact john@example.com or call 555-1234" --json`

## Resolution

- Post the confirmed CLI interface and JSON output shape.
- Close T4 (which was blocked on this finding).
