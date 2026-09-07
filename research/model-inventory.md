# Model inventory: NER, embeddings, reranker artifacts for basemind 0.29

Answers jamon8888/interpreter-workstation#60 (wayfinder:research, part of #55):
which real artifacts provision the vector-semantic, NER-PII, and rerank lanes,
where basemind expects them on disk, and how each lane activates once present.

## Scope note: what "0.29" is

- "basemind 0.29" is **jamon8888/basemind v0.29.0** (released 2026-09-07),
  not upstream Goldziher/basemind (latest there is v0.26.0).
  Source: `gh release list --repo Goldziher/basemind` vs `--repo jamon8888/basemind`;
  `gh release view v0.29.0 --repo jamon8888/basemind` (empty body, 5 platform tarballs).
- v0.28.0→v0.29.0 diff is **PII-pattern work only** (EU national-ID validators,
  IBAN MOD-97, code-secret regexes, sensitivity tiers); no model/preset changes.
  Source: `gh api repos/jamon8888/basemind/compare/v0.28.0...v0.29.0`
  (8 commits, files under `src/pii*`, `src/config/documents*`, tests).
- v0.29.0 pins **xberg 1.1.0 @ `71297af`** — identical to the `Cargo.lock` in the
  local `basemind/` checkout, so the preset tables below are exactly 0.29's.
  Source: `gh api repos/jamon8888/basemind/contents/Cargo.lock?ref=v0.29.0`
  (`name = "xberg"`, same git rev as local lock).
- The release binary (`~/.local/bin/basemind`, reports `0.29.0`) is built with
  **`--features full`**, i.e. all lanes compiled in.
  Source: fork `Cargo.toml` (`full = ["documents","memory","crawl","comms","shells",
  "code-intel","code-search"]`) and `.github/workflows/publish.yaml`
  (`cargo build --release --features full --bin basemind`).
  Activation is therefore **config-gated, not feature-gated**, in the release binary.

## Embeddings (vector / semantic lane)

Source of truth: `EMBEDDING_PRESETS` in xberg 1.1.0
`crates/xberg/src/embeddings/mod.rs`, repo **`xberg-io/embedding-models`**
pinned at revision **`4b127809f88a5aa1569d1238032b5ff40e5879bc`**
(`EMBEDDING_MODEL_REVISION`; files verified against `presets.sha256sum` at download).
All presets are **ONNX** except `lightweight` (static model2vec, pure Rust, no ORT).
Base URL pattern: `https://huggingface.co/xberg-io/embedding-models/resolve/main/<model_file>`.

| basemind preset | HF path(s) | dim | on-disk size (Content-Length, 2026-09-07) | upstream lineage / license |
|---|---|---|---|---|
| `fast` | `all-MiniLM-L6-v2/model_quantized.onnx` | 384 | ~23 MB | sentence-transformers all-MiniLM-L6-v2, **Apache-2.0** |
| `balanced` (**basemind default**, code + documents) | `bge-base-en-v1.5/model.onnx` | 768 | ~436 MB | BAAI bge-base-en-v1.5, **MIT** |
| `quality` | `bge-large-en-v1.5/model.onnx` | 1024 | ~1.34 GB | BAAI bge-large-en-v1.5, **MIT** |
| `multilingual` | `multilingual-e5-base/model.onnx` | 768 | ~1.11 GB | intfloat multilingual-e5-base, **MIT** |
| `gte-modernbert-base` | `gte-modernbert-base/model.onnx` | 768 | ~596 MB | Alibaba-NLP gte-modernbert-base, **Apache-2.0** |
| `arctic-embed-m-v2.0` (+ `.data` sidecar) | `arctic-embed-m-v2.0/model.onnx` + `model.onnx.data` | 768 | ~2 MB + ~1.23 GB | Snowflake Arctic-Embed-M v2.0, **Apache-2.0**; asymmetric — queries prefixed `"query: "` |
| `qwen3-embedding-0.6b` (+ `.data`) | `qwen3-embedding-0.6b/model.onnx` + `model.onnx.data` | 1024 | ~4.7 MB + ~2.38 GB | Qwen3-Embedding-0.6B, **Apache-2.0**; last-token pooling |
| `lightweight` | `potion-base-8m/model.safetensors` | 256 | ~30 MB | minishlab potion-base-8M lineage, **MIT**; static backend, no ONNX Runtime |

Licenses verified via `huggingface.co/api/models/<upstream>` `cardData.license`
(MiniLM Apache-2.0; BGE base/large MIT; E5 MIT; ModernBERT Apache-2.0;
Qwen3-Embedding Apache-2.0; potion MIT). Sizes via `curl -sIL …/resolve/main/…`
`content-length`; GLiNER sizes additionally cross-checked against the
`model_size_bytes` constants in xberg source (exact match).

## Reranker lane

Source of truth: `RERANKER_PRESETS` in xberg `crates/xberg/src/reranking/mod.rs`
("mirrors the fastembed-rs `RerankerModel` catalog verbatim"), repo
**`xberg-io/reranker-models`** pinned at **`3d655b40f2e1e087460434a143b11afac4947318`**
(`RERANKER_SHA256_MANIFEST`). All **ONNX cross-encoders** except `qwen3-reranker-0.6b`
(generative yes/no head).

| preset | HF path(s) | params / notes | size | upstream license |
|---|---|---|---|---|
| `bge-reranker-base` (**code CLI `--rerank-preset` default**) | `bge-reranker-base/model.onnx` | EN+ZH, max-len 512 | ~1.11 GB | BAAI bge-reranker-base, **MIT** |
| `bge-reranker-v2-m3` (**documents `[reranker]` default**, 568M, 100+ langs, max-len 8192) | `bge-reranker-v2-m3/model.onnx` + `model.onnx.data` | mirror of official BAAI model, split weight blob | ~108 KB + ~2.27 GB | BAAI bge-reranker-v2-m3, **Apache-2.0** |
| `jina-reranker-v1-turbo-en` | `jina-reranker-v1-turbo-en/model.onnx` | ~37M, max-len 8192, low-latency | ~151 MB | jinaai v1-turbo-en, **Apache-2.0** |
| `ettin-reranker-150m` | `ettin-reranker-150m/model.onnx` | 150M, ModernBERT long-context EN, max-len 7999 | ~599 MB | (xberg mirror; check repo card before redistributing) |
| `qwen3-reranker-0.6b` | `qwen3-reranker-0.6b/model.onnx` + `model.onnx.data` | 0.6B generative head, max-len 512 | ~5.7 MB + ~2.38 GB | Apache-2.0 lineage |

Aliases: `fast`→jina-turbo, `balanced`→ettin-150m, `quality`/`multilingual`→v2-m3.
Note: **`jina-reranker-v2-base-multilingual` was REMOVED from the catalog over
licensing** (truncated `NOTE` comment in `reranking/mod.rs`; Jina v2 is non-commercial
CC-BY-NC, unlike v1-turbo-en Apache-2.0) — do not re-add it for EU/multilingual use;
`bge-reranker-v2-m3` is the sanctioned multilingual default.

## NER / PII lane (two layers — do not conflate)

**Layer 1 — pattern redaction (no download, always available).**
`src/pii.rs` + `src/config/documents/pii_patterns.rs` in the 0.29 tree:
EU national IDs (FR NIR, NL BSN, BE NISS, AT SVNR, IE PPS, PT NIF), IBAN MOD-97,
code secrets (AWS keys, JWT, SSH keys, DB strings, env secrets), sensitivity tiers
for post-RRF suppression. Pure regex/checksum — works with zero models on disk.

**Layer 2 — GLiNER ONNX NER (download on first use, opt-in).**
xberg `crates/xberg/src/text/ner/gline.rs` via `xberg-gliner` (span-mode ONNX),
repo **`xberg-io/gliner-models`** pinned at **`afb0faaa3c8e7d0de7796bd37e625026ff635fe0`**
(`GLINER_SHA256_MANIFEST` = `gliner-models.sha256`; lineage `gliner-community`,
**Apache-2.0** verified via `api/models/gliner-community/gliner_small-v2.5`).

| id (aliases) | HF path (+ `tokenizer.json`, ~8.6 MB each) | size |
|---|---|---|
| `gliner_small-v2.5` (`fast`) | `models/gliner_small-v2.5/span/fp32/model.onnx` | ~665 MB |
| `gliner_medium-v2.5` (`balanced` = **xberg default**, `multilingual`) | `models/gliner_medium-v2.5/span/fp32/model.onnx` | ~836 MB |
| `gliner_large-v2.5` (`quality`) | `models/gliner_large-v2.5/span/fp32/model.onnx` | ~1.84 GB |

Default entity labels when `categories` is empty: person, organization, location,
date, email. Zero-shot custom labels supported (surface as `Custom(_)`).

## Where basemind expects artifacts on disk

- **Models: `~/.cache/huggingface/hub/` — NOT `~/.cache/basemind/`.**
  xberg downloads via the `hf-hub` 1.0.0 client (`resolve_cache_dir()` =
  `$HF_HUB_CACHE` → `$HUGGINGFACE_HUB_CACHE` → `$XDG_CACHE_HOME/huggingface/hub`
  → `~/.cache/huggingface/hub`; content-addressed `models/<repo>/snapshots/<rev>/…`).
  `~/.cache/basemind/` not existing is **expected** — nothing in basemind or xberg
  references that path (verified by source search). `XBERG_CACHE_DIR` overrides
  xberg *module* caches (ocr, tessdata, paddle-ocr), not the hf-hub model path.
- **basemind's own cache: `~/.local/share/basemind/cache/`** on Linux
  (`directories::ProjectDirs::from("","","basemind")`, `$BASEMIND_DATA_HOME` override):
  global content-addressed `blobs/` + per-workspace `workspaces/<blake3-of-root>/`
  (views, `index.msgpack`, LanceDB vector store, `.chunk.msgpack` sidecars).
  Source: `src/store_layout.rs` (`cache_root()`, `workspace_cache_dir()`).
- No model downloads until a lane that needs one is enabled (see below); a fresh
  `~/.cache/huggingface/` + keyword-only `matched_lanes: ["keyword"]` is the
  coherent default-state signature, not a broken install.

## How each lane activates once present

All defaults below are from `src/config/code.rs`, `src/config/documents.rs`
(`RerankerConfig`, `NerConfig`), `src/scanner_code.rs`, `src/mcp/helpers_code_search.rs`,
`src/embeddings.rs` (`SharedEmbedder::load`, `cache_dir: None` → hf-hub default).

- **Keyword lane (BM25 + exact-symbol): always on.** Built at scan into Fjall;
  `lane: "keyword"` works with zero models. `matched_lanes: ["keyword"]` =
  vector lane absent, not an error.
- **Vector / semantic lane (code): OFF by default** (`[code_search] embed = false`;
  docs: "local embeddings on *code* aren't worth their cost … flip to `true` only
  if you specifically want vector search over code"). Activate: set
  `[code_search] embed = true` in `basemind.toml` (+ optionally
  `[documents] embedding_preset`, default `"balanced"`), rescan — first scan
  downloads the preset ONNX (~436 MB for `balanced`) to `~/.cache/huggingface/hub/`,
  writes LanceDB rows; then `--lane hybrid` (default) fuses vector+keyword+exact via
  RRF and `matched_lanes` gains `"vector"`. Code reuses the *documents* preset
  (`scanner_code.rs` loads `config.documents.embedding_preset`); there is no
  separate code preset knob.
- **Vector lane (documents/memory MCP): ON by default** (`[documents] embed = true`,
  preset `"balanced"`); same download-on-first-scan behavior. Needs the `documents`
  feature — present in the `full` release build.
- **Rerank lane: OFF by default in both tiers** (`enabled = false`; documents default
  preset `bge-reranker-v2-m3`, `top_k = 20`; code CLI `--rerank-preset` default
  `bge-reranker-base`). Activate per-query (`code semantic --rerank`,
  `rerank: true` / `reranker_enabled`) or persistently
  (`[code_search.reranker] enabled = true`, `[documents.reranker] enabled = true`);
  first reranked query downloads the preset ONNX (~2.27 GB for v2-m3, ~1.11 GB for
  base). Scores surface as `rerank_score`; unknown preset names fail closed.
- **NER PII lane:** pattern redaction runs without models; the GLiNER ONNX leg is
  OFF by default (`[documents] ner.enabled = false`, backend `onnx`, `model = None`
  → xberg default alias `balanced` = `gliner_medium-v2.5`, ~836 MB). Activate:
  `[documents] ner.enabled = true` (+ optional `model`, `categories`,
  `custom_labels`); first NER pass downloads model + tokenizer.
  The `llm` backend alternative routes through `[llm]` config and costs API tokens.
- **Practical provisioning order for this workstation** (keyword-only today):
  1. `export HF_HUB_CACHE` if the default `~/.cache/huggingface/hub/` is wrong;
  2. `[code_search] embed = true` + rescan (~436 MB, `balanced`) for code vectors;
  3. `--rerank` trial (~1.11 GB base) before committing to v2-m3 (~2.27 GB);
  4. `[documents] ner.enabled = true` (~836 MB medium) only if pattern redaction
     proves insufficient. ONNX Runtime ships with the `full` build for steps 2–4.

## Verification status

- Preset tables, repos, revisions, aliases, defaults, gates: read directly from
  xberg 1.1.0 @ `71297af` (pinned in fork v0.29.0 lockfile) and the `basemind/`
  checkout (read-only; uncommitted PII work untouched).
- Sizes: live `content-length` from huggingface.co `…/resolve/main/…` (2026-09-07);
  GLiNER sizes match xberg's in-source `model_size_bytes` exactly.
- Licenses: upstream HF `cardData.license` for each lineage model
  (BGE MIT, E5 MIT, MiniLM Apache-2.0, ModernBERT Apache-2.0, Qwen Apache-2.0,
  potion MIT, BGE-reranker-base MIT, BGE-reranker-v2-m3 Apache-2.0,
  Jina-v1-turbo Apache-2.0, GLiNER Apache-2.0); `ettin-reranker-150m` upstream
  license not individually confirmed — check the repo card before redistributing.
- NOT run: no model was downloaded and no `--features full` rebuild was done here;
  end-to-end lane activation (rescan → `matched_lanes` contains `"vector"`) remains
  for the implementer with disk/bandwidth for the ~0.4–2.4 GB artifacts.
