# Research: GLiNER2 multi with transformers.js (client-side WASM)

**Date:** 2026-09-06
**Ticket:** R2 — Research: GLiNER2 multi with transformers.js (client-side WASM)

## 1. GLiNER2 Multi vs Standard GLiNER2 — What Makes It "Ultra-Optimized"?

### Model Variants

GLiNER2 comes in two architectures:

| Model | Parameters | Encoder | Language |
|-------|------------|---------|----------|
| `fastino/gliner2-base-v1` | 205M | DeBERTa-v3-base | English |
| `fastino/gliner2-large-v1` | 340M | DeBERTa-v3-large | English |
| `fastino/gliner2-multi-v1` | ~205M | mDeBERTa-v3-base | Multilingual |

The **"multi"** variant uses `mDeBERTa-v3-base` instead of English-only `DeBERTa-v3-base`, enabling **multilingual NER** across 6 languages. The README notes this as the multilingual span checkpoint.

### "Ultra-Optimized" Claim

The "ultra-optimized" terminology in the ticket does not appear in official GLiNER2 documentation. What IS optimized:

- **CPU-first design**: GLiNER2 is designed for fast local inference without GPU — no external API dependencies, 100% local processing.
- **Two architectures**: The newer **GLiNER2.5** ("boundary") uses sparse start/end pairing instead of a fixed span-width grid, allowing any span length within the encoded window. This is more flexible than the original span architecture.
- **Quantization support**: Python-side `quantize=True` enables fp16 weights on GPU.

Sources:
- [GLiNER2 README — Available Models](https://github.com/fastino-ai/GLiNER2)
- [GLiNER2.5 Multi HuggingFace page](https://huggingface.co/fastino/gliner2.5-multi-v1)

---

## 2. Loading and Running GLiNER2 via `@huggingface/transformers` (transformers.js) in Browser/WASM

### Current State

**GLiNER2 does NOT have native transformers.js support.** Key findings:

1. **transformers.js supports NER via `token-classification` pipeline**: The library supports token classification tasks in the browser via WASM or WebGPU. You can run `pipeline('token-classification', model_id)` for NER tasks generally.

2. **GLiNER2 models are NOT exported to ONNX format**: transformers.js runs ONNX models. The official GLiNER2 models on HuggingFace are in **Safetensors format** only — they do not have ONNX exports.

3. **Model file inspection**: The `fastino/gliner2.5-multi-v1` model directory contains:
   - `model.safetensors` (1.15 GB)
   - `tokenizer.json` (16 MB)
   - `config.json`
   - No `.onnx` files

4. **Available quantized versions**: Both `fastino/gliner2-multi-v1` and `fastino/gliner2.5-multi-v1` have quantized derivatives (10 and 3 variants respectively, per HuggingFace model tree), but these are PyTorch quantization — not ONNX quantization compatible with transformers.js.

### What IS Possible

If ONNX export were added (requires GLiNER2 team to export), transformers.js would support it like:

```javascript
import { pipeline } from '@huggingface/transformers';

// Only works if model has ONNX export
const ner = await pipeline('token-classification', 'fastino/gliner2-multi-v1', {
  device: 'wasm',  // or 'webgpu'
  dtype: 'q4',      // for 4-bit quantization
});
```

The default dtype for WASM is **q8** (8-bit quantization), which is the recommended format for resource-constrained environments.

Sources:
- [transformers.js README — Quick tour](https://github.com/huggingface/transformers.js)
- [transformers.js — Browser device setup with WASM fallback](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/src/backends/onnx.js)
- [transformers.js — Dynamic quantization selection](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/guides/dtypes.md)

---

## 3. Memory Footprint and First-Load Time / IndexedDB Caching

### Model Sizes

| Model | Parameters | Approx. Size (FP32) | Approx. Size (FP16) |
|-------|------------|---------------------|---------------------|
| `gliner2-multi-v1` | 205M | ~820 MB | ~410 MB |
| `gliner2.5-multi-v1` | 287M | ~1.15 GB | ~575 MB |
| `gliner2.5-base-v1` | 194M | ~776 MB | ~388 MB |
| `gliner2.5-small-v1` | 74M | ~296 MB | ~148 MB |

The `fastino/gliner2.5-multi-v1` directory is **1.17 GB** total (1.15 GB safetensors + tokenizer).

### Memory in Browser/WASM

- **WASM default (q8)**: transformers.js defaults to `q8` for WASM. This is 8-bit quantized.
- **WebGPU (fp16)**: The default for WebGPU is `fp16` (half-precision).
- **Q4 option**: 4-bit quantization is available and recommended for browser use.

A rough memory estimate for the multi-v1 model in WASM with q8: ~300-400 MB working memory.

### IndexedDB Caching

**Yes, models ARE cached via the browser's Cache API by default.**

transformers.js automatically uses the browser's Cache API (same origin, `transformers-cache` key) for model files. This means after first load, subsequent visits use cached weights.

```javascript
import { env } from '@huggingface/transformers';

// Cache is enabled by default (env.useBrowserCache = true)
// Custom cache directory:
env.cacheDir = "./.cache";
```

First load still requires downloading ~300-400 MB (quantized). Subsequent loads are near-instant.

Sources:
- [transformers.js — Browser cache selection (Cache API)](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/src/utils/cache.js)
- [transformers.js — Configure Model Cache Directory](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/tutorials/node.md)

---

## 4. Running NER Prediction (Detect PII Entities)

### GLiNER2 Python API (for reference)

```python
from gliner2 import AutoExtractor

model = AutoExtractor.from_pretrained("fastino/gliner2.5-multi-v1")

text = "Email john.smith@acme.com or call +1 415 555 0199."
result = model.extract_entities(text, ["email", "phone_number", "person"])
# {'entities': {'email': ['john.smith@acme.com'], 'phone_number': ['+1 415 555 0199']}}
```

### For Client-Side WASM

**This is NOT currently possible** because GLiNER2 lacks an ONNX export needed by transformers.js.

### Alternative: Use the PII-specific Model

The dedicated PII redaction model is:
- **`fastino/gliner2-privacy-filter-PII-multi`** — 205M parameters, multilingual, 42 PII entity types

This model also lacks ONNX export from the official repo.

### Workaround: Use a Transformers.js-Compatible NER Model

For client-side NER today, you would need an ONNX-exported model. Example compatible models on HuggingFace:
- `Xenova/bert-base-multilingual-cased-ner-hipe` (multilingual NER)
- `dslim/bert-base-NER` (English NER)

These are not specialized for PII but support general entity types.

Sources:
- [GLiNER2 PII Model HuggingFace](https://huggingface.co/fastino/gliner2-privacy-filter-PII-multi)
- [transformers.js README — Supported tasks](https://github.com/huggingface/transformers.js)

---

## 5. Pre-Quantized `.q8` or Similar Variants

### Quantization Formats in transformers.js

transformers.js supports these dtypes:
- `fp32` — full 32-bit float (default for WASM fallback)
- `fp16` — half-precision float (default for WebGPU)
- `q8` — 8-bit integer quantization (default for WASM)
- `q4` — 4-bit quantization (recommended for browser)
- `q4f16` — 4-bit float16 quantization
- `int8`, `uint8` — 8-bit integer variants
- `bnb4` — BitsAndBytes 4-bit

### Quantized Versions on HuggingFace

The GLiNER2 model tree shows quantized derivatives:

| Model | Quantizations Available |
|-------|------------------------|
| `fastino/gliner2-multi-v1` | 10 quantized variants |
| `fastino/gliner2.5-multi-v1` | 3 quantized variants |
| `fastino/gliner2-privacy-filter-PII-multi` | 9 quantized variants |

However, these are **PyTorch-quantized** models (via `torch.quantization.quantize_dynamic`), NOT ONNX-format quantized models that transformers.js can consume.

To use `dtype: 'q4'` in transformers.js, the model needs to have pre-converted ONNX files with quantization baked in, or transformers.js must do on-the-fly conversion (which it does for some models from the Hub if they have ONNX exports).

### Summary

Pre-quantized ONNX variants for GLiNER2 do not currently exist in the Hub. The quantization options in the model tree are for Python-side PyTorch use, not transformers.js browser use.

Sources:
- [transformers.js — Using quantized models (dtypes)](https://github.com/huggingface/transformers.js/blob/main/packages/transformers/docs/source/guides/dtypes.md)
- [GLiNER2.5 Multi — Quantizations in model tree](https://huggingface.co/fastino/gliner2.5-multi-v1)

---

## 6. Entity Types Supported by the Multi Model Out of the Box

### GLiNER2.5 Multi (Boundary Architecture)

`fastino/gliner2.5-multi-v1` is a **generalist multi-task model**. It does NOT have predefined entity types — you specify entities at inference time (zero-shot). This is the core GLiNER2 design philosophy: "one schema, many tasks."

Example entity types you can request:
- `["company", "person", "product", "location"]`
- `["medication", "dosage", "symptom", "time"]`
- Any arbitrary label with optional descriptions for better precision

The model supports:
- **Entity extraction** (NER)
- **Text classification** (sentiment, topics, etc.)
- **Structured data extraction** (JSON records)
- **Relation extraction** (works_for, located_in, etc.)
- **Span attributes** (sentiment on entity spans)

### GLiNER2 PII Multi (Specialized)

`fastino/gliner2-privacy-filter-PII-multi` is specifically trained for PII detection with **42 predefined entity types**:

**Person / names:**
`person`, `full_name`, `first_name`, `middle_name`, `last_name`, `date_of_birth`

**Contact / address:**
`email`, `phone_number`, `address`, `street_address`, `city`, `state_or_region`, `postal_code`, `country`

**Government / tax IDs:**
`government_id`, `national_id_number`, `passport_number`, `drivers_license_number`, `license_number`, `tax_id`, `tax_number`

**Banking / payment:**
`bank_account`, `account_number`, `routing_number`, `iban`, `payment_card`, `card_number`, `card_expiry`, `card_cvv`

**Digital identity:**
`username`, `ip_address`, `account_id`, `sensitive_account_id`

**Secrets / credentials:**
`password`, `secret`, `api_key`, `access_token`, `recovery_code`

**Sensitive dates:**
`sensitive_date`, `document_date`, `expiration_date`, `transaction_date`

This model achieves **0.477 span-level F1** on the SPY benchmark, with best recall among compared systems (critical for redaction where missed spans = data leaks).

Sources:
- [GLiNER2 README — Available Models](https://github.com/fastino-ai/GLiNER2)
- [GLiNER2 PII Model — Supported PII Labels (42 types)](https://huggingface.co/fastino/gliner2-privacy-filter-PII-multi)
- [GLiNER2.5 Multi — Model details](https://huggingface.co/fastino/gliner2.5-multi-v1)

---

## Summary Findings

| Question | Finding |
|----------|---------|
| GLiNER2 multi vs standard | Multi = multilingual (mDeBERTa), supports 6 languages vs English-only |
| transformers.js loading | **NOT CURRENTLY POSSIBLE** — GLiNER2 has no ONNX export |
| Memory / IndexedDB | Quantized (~400MB q8) with automatic browser Cache API |
| NER prediction | Not via transformers.js; Python SDK available; need ONNX export for JS |
| Pre-quantized variants | PyTorch quantizations exist but not ONNX-format for transformers.js |
| Entity types | Zero-shot (specify any at inference); PII model has 42 predefined |

## Gap: ONNX Export Needed

The core blocker for client-side WASM deployment is that **GLiNER2 does not provide ONNX model exports**. To use GLiNER2 with transformers.js in a browser, the GLiNER2 team would need to:

1. Export models to ONNX format
2. Include quantized variants (q8, q4) in the HuggingFace Hub
3. Or provide a conversion script that transformers.js can use

**Recommendation for the ticket**: If client-side WASM is required, consider:
1. Filing a feature request with GLiNER2 for ONNX export
2. Using the Python SDK in a server-side context
3. Or evaluating alternative NER models that DO have transformers.js support (e.g., dslim/bert-base-NER)

---

*Research conducted using Context7 (HuggingFace transformers.js docs, GLiNER2 GitHub/README) and HuggingFace model pages.*
