# basemind/xberg Feature Reference

## What's Currently Enabled in basemind's Release Binary

basemind's `full` feature = `documents` + `memory` + `crawl` + `comms` + `shells` + `code-intel` + `code-search`

This maps to xberg's `full` feature, which includes:

### Formats (107 formats, 371 languages)
| Feature | What it covers |
|---------|---------------|
| `pdf` | PDF extraction (native engine) |
| `excel` | .xlsx, .csv, .tsv via calamine |
| `office` | .docx, .pptx, .odt, .biblatex, .org, .typst, .dbase |
| `notebook` | Jupyter .ipynb |
| `hwp` | Korean HWP documents |
| `hwpx` | Korean HWPX documents |
| `iwork` | Apple Pages/Numbers/Keynote |
| `email` | .eml, .pst (Outlook), MIME |
| `html` | HTML → Markdown conversion |
| `xml` | XML parsing |
| `archives` | .zip, .tar, .7z, .gz |
| `sqlite` | SQLite database extraction |
| `mdx` | MDX (Markdown + JSX) |
| `svg` | SVG parse/sanitize/rasterize |
| `heic` | HEIF/HEIC/AVIF image decoding (libheif) |
| `wordperfect` | WordPerfect .wpd documents |

### Analysis
| Feature | What it covers |
|---------|---------------|
| `language-detection` | whatlang-based language ID |
| `chunking` | ICU segmenter + tokenizers for RAG chunking |
| `quality` | Unicode normalization, charset detection |
| `keywords` | YAKE + RAKE keyword extraction |
| `markdown-footnotes` | Footnote/citation parsing |
| `diff` | Text diffing via `similar` |

### ML / AI (ORT-dependent)
| Feature | What it covers | Model |
|---------|---------------|-------|
| `embeddings` | Dense vector embeddings | bge-base-en-v1.5 |
| `reranker` | Cross-encoder reranking | bge-reranker-v2-m3 |
| `sparse-embeddings` | SPLADE sparse vectors | — |
| `late-interaction` | ColBERT multi-vector | — |
| `ner-onnx` | Named Entity Recognition | gliner_small-v2.5 |
| `layout-detection` | Document layout (YOLO + RT-DETR) | — |
| `auto-rotate` | Document orientation detection | PP-LCNet |
| `transcription` | Audio/video speech-to-text | Whisper ONNX |
| `paddle-ocr` | PaddleOCR (table detection) | — |
| `sceptre-ocr` | CRAFT/CRNN text detection | — |

### OCR Backends
| Feature | Engine | Notes |
|---------|--------|-------|
| `ocr` | Tesseract (via xberg-tesseract) | Native, vendored build |
| `paddle-ocr` | PaddleOCR + ORT | Table structure recognition |
| `sceptre-ocr` | CRAFT/CRNN + ORT | Hand-written text detection |
| `candle-vlm-ocr` | Candle (pure Rust) | TrOCR, PaddleOCR-VL, GLM-OCR, DeepSeek-OCR |
| `candle-trocr` | TrOCR via Candle | Pure Rust, no ORT |
| `candle-paddleocr-vl` | PaddleOCR-VL via Candle | Pure Rust |
| `candle-glm-ocr` | GLM-OCR via Candle | Pure Rust |
| `candle-deepseek-ocr` | DeepSeek-OCR via Candle | Pure Rust |

### Text Processing
| Feature | What it covers |
|---------|---------------|
| `liter-llm` | LLM structured extraction (OpenAI, Anthropic, etc.) |
| `structured` | LLM-based structured extraction |
| `classification` | Document classification via LLM |
| `captioning` | Image captioning via LLM |
| `summarization` | TextRank extractive summarization |
| `summarization-llm` | LLM-based abstractive summarization |
| `translation` | LLM-based translation |
| `ner-llm` | LLM-driven zero-shot NER |
| `redaction` | Pattern-based PII detection |
| `redaction-ml` | NER-backed PII detection (PERSON/ORG/LOC) |
| `redaction-rehydrate` | Encrypted rehydration maps |

### Code Intelligence
| Feature | What it covers |
|---------|---------------|
| `tree-sitter` | 371-language code map |
| `code-intel-js` | JavaScript/TypeScript AST (oxc) |
| `code-intel-stack` | Stack graphs for scope analysis |

### Infrastructure
| Feature | What it covers |
|---------|---------------|
| `api` | HTTP API server (axum) |
| `mcp` | MCP (Model Context Protocol) server |
| `otel` | OpenTelemetry observability |
| `prometheus` | Prometheus /metrics endpoint |
| `crawl` | Web page ingestion (crawlberg) |
| `url-ingestion` | URL → content extraction |
| `comms` | Streamable-HTTP MCP transport |
| `shells` | Terminal multiplexer (rmux) |

---

## Features NOT Currently Enabled (Available but Not in basemind's `full`)

### Pure-Rust Alternatives to ORT Features
| Feature | What it replaces | Status |
|---------|-----------------|--------|
| `static-embeddings` | `embeddings` (ORT) | Pure Rust (model2vec-rs), works on old CPUs |
| `layout-tract` | `layout-detection` (ORT) | Pure Rust (tract), RT-DETR + table classifier |
| `auto-rotate-tract` | `auto-rotate` (ORT) | Pure Rust (tract), PP-LCNet orientation |
| `paddle-ocr-tract` | `paddle-ocr` (ORT) | Pure Rust (tract), PaddleOCR |
| `sceptre-ocr-tract` | `sceptre-ocr` (ORT) | Pure Rust (tract), CRAFT/CRNN |
| `sceptre-ocr-candle` | `sceptre-ocr` (ORT) | Pure Rust (candle), CRAFT/CRNN |
| `ner-candle` | `ner-onnx` (ORT) | Pure Rust (candle), GLiNER2 |
| `ner-llm` | `ner-onnx` (ORT) | LLM-based, already in `full` |

### Additional Capabilities (Not in basemind's `full`)
| Feature | What it covers | Why not enabled |
|---------|---------------|-----------------|
| `formula-recognition` | LaTeX formula OCR (RapidLaTeXOCR) | ORT-dependent, experimental |
| `transcription` | Audio/video speech-to-text | Already in `full` |
| `heic` | HEIF/HEIC/AVIF | Requires libheif (native C++) |
| `wordperfect` | WordPerfect .wpd | Requires libwpd (native C++) |
| `pdf-pdfium` | PDF via pdfium (alternative backend) | Experimental, not default |
| `sqlite` | SQLite database extraction | Already in `full` via `documents` |

### GPU Acceleration
| Feature | What it covers |
|---------|---------------|
| `candle-cuda` | Candle backends on NVIDIA GPU |
| `candle-metal` | Candle backends on Apple Metal |
| `candle-accelerate` | Candle backends on Apple Accelerate |
| `candle-mkl` | Candle backends on Intel MKL |
| `cuda` | ONNX Runtime CUDA EP |
| `tensorrt` | ONNX Runtime TensorRT EP |
| `coreml` | ONNX Runtime CoreML EP (macOS) |

### Observability & Services
| Feature | What it covers |
|---------|---------------|
| `otel` | OpenTelemetry tracing |
| `prometheus` | Prometheus metrics endpoint |
| `api` | REST API server |
| `mcp-http` | MCP over HTTP |

---

## What Would Make the Backend Optimal for Regulated Industries

### Already Available (Just Need Enabling)
1. **`redaction` + `redaction-ml` + `redaction-rehydrate`** — PII detection + encrypted rehydration maps. Critical for HIPAA/GDPR compliance.
2. **`quality`** — Charset detection, unicode normalization. Important for document integrity.
3. **`ner-onnx`** — Named entity recognition for PII detection.
4. **`summarization-llm`** — Automated document summarization for compliance review.
5. **`classification`** — Document classification for routing and access control.
6. **`structured`** — LLM-based structured extraction for standardized reporting.

### Would Need New Features/Integration
1. **Audit logging** — OpenTelemetry (`otel`) provides tracing, but regulated industries need immutable audit logs of who accessed what.
2. **Encryption at rest** — `redaction-rehydrate` encrypts rehydration maps, but document content encryption would be a new layer.
3. **Access control** — No RBAC/ABAC system in basemind today.
4. **Digital signatures** — No document signing capability.
5. **Retention policies** — No document lifecycle management.

### OCR Excellence for Regulated Documents
The OCR pipeline is already comprehensive:
- **Tesseract** — General OCR (371 languages via tree-sitter)
- **PaddleOCR** — Table structure recognition
- **Sceptre** — Hand-written text detection
- **Candle VLM OCR** — TrOCR, PaddleOCR-VL, GLM-OCR, DeepSeek-OCR (pure Rust)
- **Auto-rotate** — Document orientation detection
- **Layout detection** — YOLO + RT-DETR for document structure

For optimal document treatment, enable:
- `candle-vlm-ocr` — Best quality OCR (pure Rust, no ORT needed)
- `layout-detection` — Document structure understanding
- `auto-rotate` — Correct orientation before OCR
- `formula-recognition` — LaTeX formula extraction (if needed)

---

## Feature Groups for Different Use Cases

### Minimal (AVX2-less CPU, no ORT)
```
features = ["static-embeddings", "ner-candle", "layout-tract", "auto-rotate-tract", "paddle-ocr-tract"]
```
- Pure Rust, works on any x86_64 CPU
- Missing: reranker, sparse embeddings, late interaction, transcription

### Balanced (AVX2-less CPU, with ORT via custom build)
```
features = ["full", "ort-dynamic"]
```
- Build ONNX Runtime from source without AVX2
- All features available

### Maximum Quality (AVX2 CPU, GPU optional)
```
features = ["full", "candle-vlm-ocr", "candle-cuda"]
```
- Best OCR quality via Candle VLM backends
- GPU acceleration for Candle inference
