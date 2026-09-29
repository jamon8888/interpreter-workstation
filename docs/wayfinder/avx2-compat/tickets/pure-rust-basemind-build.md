## Question

Build basemind with pure-Rust features only (no ONNX Runtime dependency) as a simpler alternative for the i5-2400S.

**Features to enable**:
- `static-embeddings` — model2vec-rs dense embeddings (pure Rust)
- `ner-candle` — GLiNER2 NER via candle (pure Rust)
- `layout-tract` — RT-DETR layout detection via tract (pure Rust)
- `auto-rotate-tract` — PP-LCNet orientation via tract (pure Rust)
- `paddle-ocr-tract` — PaddleOCR via tract (pure Rust)
- `sceptre-ocr-candle` — CRAFT/CRNN text detection via candle (pure Rust)
- `tree-sitter` — 371-language code intelligence
- `crawl` — Web ingestion
- `comms` — MCP transport
- All format parsers (PDF, Office, Excel, etc.)

**What's lost vs full ORT build**:
- ORT-backed embeddings (bge-base-en-v1.5) — replaced by model2vec
- ORT-backed reranker (bge-reranker-v2-m3) — no pure-Rust replacement
- ORT-backed sparse embeddings (SPLADE) — no pure-Rust replacement
- ORT-backed late interaction (ColBERT) — no pure-Rust replacement
- ORT-backed transcription (Whisper) — no pure-Rust replacement

**Blocked by**: pinned manifest (feature set), dispatcher changes, and safetensors model-format support — not independently buildable as-is.

**This is the "good enough" path** — simpler build, no ORT at all, but missing reranker and some ML features.
