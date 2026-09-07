# T1 — Decision: GLiNER2 client-side WASM is blocked — what's the alternative?

## Question

GLiNER2 has **no ONNX export**, making client-side WASM via transformers.js impossible. The core privacy promise ("files never leave your device") breaks without client-side inference. What is the path forward?

## Context

R2 research found: GLiNER2 only provides Safetensors; transformers.js requires ONNX format. Client-side WASM is blocked until ONNX export is added upstream or built custom.

Three realistic paths exist:

**Option A — Hybrid serverless (recommended)**
Files are still protected: redacted on a serverless Vercel Edge function before being sent to the LLM. The serverless function does ONLY GLiNER2 inference — no storage, no logging. The LLM never sees raw files. This preserves "LLM never sees unredacted" while getting GLiNER2 running.

**Option B — Alternative ONNX model**
Find an alternative privacy-focused NER model that HAS an ONNX export and can run via transformers.js in the browser. Examples: `🤗 transformers` has ONNX exports for many NER models; we could use a fine-tuned BERT/DeBERTa for PII detection.

**Option C — Request ONNX export upstream**
File a feature request with the GLiNER2 team. This could take months. Not viable for a first version.

**Option D — Manual regex fallback**
Ship with a curated regex pattern library for common PII (emails, phones, SSNs, credit cards, IPs) as a client-side fallback while waiting for ONNX. This is not as good as GLiNER2 but preserves full client-side privacy for basic PII.

## Method

1. Evaluate each option against the privacy guarantee, accuracy, and implementation cost.
2. Recommend Option A or B based on the research.
3. Decide and record.

## Resolution

- Post the decision with rationale.
- If Option A: this creates a new ticket for the serverless GLiNER2 edge function.
- If Option B: this creates a new ticket to find the right ONNX model.
- If Option D: this becomes a parallel fallback path.
