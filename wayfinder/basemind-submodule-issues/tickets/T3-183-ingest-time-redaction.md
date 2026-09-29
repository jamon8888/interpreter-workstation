# T3: Ingest-time redaction in basemind

**GitHub:** [#183](https://github.com/jamon8888/interpreter-workstation/issues/183)
**Label:** wayfinder:task
**Part of:** [#174](https://github.com/jamon8888/interpreter-workstation/issues/174)

## What

Build the mechanism decided in [#177](https://github.com/jamon8888/interpreter-workstation/issues/177)
(ingest-time scan redaction) in basemind's own repo (`submodules/basemind`).

### Tasks

- Run `redact_capturing_rehydration_map` in basemind's scan boundary
  (xberg's pipeline `redact()` destroys the map).
- Persist extraction-time rehydration maps (key-space per [#178](https://github.com/jamon8888/interpreter-workstation/issues/178)
  vault key-space unification).
- Thread `rehydration_ref` from the re-read blob at both LanceDB write
  sites (`scanner_docs.rs:410`, `web/ingest.rs:107`).
- Wire the dead `pii_lineage` keyspace via `translate_findings` (GDPR
  Art. 30 records written by the scan lane).
- Add the markdown `output_format` knob and an opt-in per-workspace
  redaction knob.
- Invalidate cached plaintext blobs when redaction config flips
  (`cached_doc_is_reusable` trap flagged in #175).

### Findings

`docs/research/basemind-pseudonymization-wiring.md` on branch
`research/basemind-pseudonymization-wiring`.

## Context

Decisions that feed into this:
- [#177](https://github.com/jamon8888/interpreter-workstation/issues/177): Ingest-time scan redaction chosen (CLOSED)
- [#178](https://github.com/jamon8888/interpreter-workstation/issues/178): Vault key-space unified (CLOSED)
- [#175](https://github.com/jamon8888/interpreter-workstation/issues/175): Research on basemind wiring at pinned rev (CLOSED)
