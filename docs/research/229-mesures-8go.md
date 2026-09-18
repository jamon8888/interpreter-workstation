# #229 — Mesures locales 8 Go (RAM pic + latence + AVX2)

Date : 2026-09-18. Machine : Intel i5-2400S (2011, 4 cœurs), 7 Go RAM, `basemind cpu-features` → `{"avx2":false,"avx":true}`. onnxruntime pip 1.29.0, mesures via `/usr/bin/time -v` (Maximum resident set size). Chaque sonde = processus séparé (pas de co-chargement mesuré — somme estimée).

## Disque (tailles de téléchargement vérifiées via API HF)

| Modèle | Fichier | Poids |
|---|---|---|
| fast (MiniLM-L6-v2 quantisé) | `all-MiniLM-L6-v2/model_quantized.onnx` | 23 Mo |
| GTE-multilingual int8 (**retenu #228**) | `onnx/model_int8.onnx` (+ tokenizer 17 Mo) | 341 Mo |
| gliner-pii-edge | `onnx/model.onnx` | 181 Mo |
| bge-base-en-v1.5 | `model.onnx` | 113 Mo |
| bge-reranker-v2-m3 | `model.onnx` | 1,1 Go |
| e5-small FR (Infojura, piste) | `onnx/model.onnx` | ~135 Mo |

Constat cache local : `~/.local/share/basemind/hub` ne contient que des pointeurs XET 4 Ko (poids non matérialisés, xet cache 4 Mo) — prévoir le téléchargement réel avant usage offline.

## Mesures (1 paire / 1 phrase FR, CPU-only, sans AVX2)

| Sonde | Latence | RAM pic processus | Statut |
|---|---|---|---|
| Embed fast, 1 phrase FR (1er appel) | 188 ms | 99 Mo | OK, dim 384 |
| Rerank GTE-int8, 1 paire FR (après warmup) | **9 190 ms** | **899 Mo** | OK, score 0,53 (anecdotique, non calibré) |

## Verdict

1. **Tiennent ensemble en RAM** : ~1 Go mesuré (embed + rerank) + NER (~200–400 Mo estimés, non mesuré) < 7 Go. Pas besoin de chargement séquentiel pour la RAM.
2. **Rerank OFF par défaut requis quand même** : 9 s/paire sur CPU 2011 ⇒ top-k=10 ≈ 1,5 min/recherche. Le toggle n'est pas une économie RAM, c'est une économie temps.
3. **AVX2 nuancé** : ORT pip 1.29 tourne sans AVX2 (pas de SIGILL). Le « ORT exige AVX2 » de `docs/research/avx-free-onnxruntime.md` dépend de la version/build ORT embarquée — **la version ORT bundlée par basemind reste à tester** (binaire 0.29.0 installé, non éprouvé ici).
4. GTE-int8 validé fonctionnel (head 1 logit + sigmoïde, layout `onnx/model_int8.onnx` compatible chemin Custom).

## Suivis (non mesurés ici)

- Chargement + latence NER edge via ORT (graphe span GLiNER : inférence brute complexe, à passer par le backend basemind).
- Qualité FR e5-small Infojura (135 Mo) vs multilingues lourds.
- Latence sur CPU moderne (ces chiffres sont un plancher 2011).
- Confirmation avec l'ORT embarqué basemind (vs pip 1.29).

## Protocole reproductible

```bash
mkdir -p /tmp/opencode/probe && cd /tmp/opencode/probe
# Embed fast (xberg-io/embedding-models@4b12780...)
curl -sL -o model_quantized.onnx "https://huggingface.co/xberg-io/embedding-models/resolve/4b127809f88a5aa1569d1238032b5ff40e5879bc/all-MiniLM-L6-v2/model_quantized.onnx"
curl -sL -o tokenizer.json "https://huggingface.co/xberg-io/embedding-models/resolve/4b127809f88a5aa1569d1238032b5ff40e5879bc/all-MiniLM-L6-v2/tokenizer.json"
# Rerank GTE int8
curl -sL -o gte_int8.onnx "https://huggingface.co/onnx-community/gte-multilingual-reranker-base/resolve/main/onnx/model_int8.onnx"
curl -sL -o gte_tokenizer.json "https://huggingface.co/onnx-community/gte-multilingual-reranker-base/resolve/main/tokenizer.json"
pip install --break-system-packages tokenizers  # + onnxruntime déjà présent
/usr/bin/time -v python3 embed_once.py
/usr/bin/time -v python3 rerank_once.py
```

`embed_once.py` (mean-pooling + normalisation) :

```python
import sys, time
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer
tok = Tokenizer.from_file("tokenizer.json")
sess = ort.InferenceSession("model_quantized.onnx", providers=["CPUExecutionProvider"])
texts = ["Bonjour, releve d'identite bancaire FR76 3000 6000 0112 3456 7890 189"]
enc = tok.encode_batch(texts)
ids = np.array([e.ids for e in enc], dtype=np.int64)
mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
tii = np.zeros_like(ids)
inputs = {}
for i in sess.get_inputs():
    n = i.name
    inputs[n] = tii if ("token_type" in n or "segment" in n) else (mask if "mask" in n else ids)
t0 = time.perf_counter(); out = sess.run(None, inputs)[0]; dt = (time.perf_counter()-t0)*1000
maskf = mask[:, :, None].astype(np.float32)
emb = (out*maskf).sum(1)/maskf.sum(1); emb /= np.linalg.norm(emb, axis=1, keepdims=True)
print(f"OK dim={emb.shape[1]} latency_ms={dt:.1f}")
```

`rerank_once.py` (paire FR, warmup + mesure, sigmoïde) :

```python
import time
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer
tok = Tokenizer.from_file("gte_tokenizer.json")
sess = ort.InferenceSession("gte_int8.onnx", providers=["CPUExecutionProvider"])
q = "Comment obtenir un relevé d'identité bancaire ?"
d = "Le relevé d'identité bancaire (RIB) contient l'IBAN FR76 3000 6000 0112 3456 7890 189 et le BIC."
enc = tok.encode(q, d)
ids = np.array([enc.ids], dtype=np.int64); mask = np.array([enc.attention_mask], dtype=np.int64)
tii = np.zeros_like(ids)
inputs = {}
for i in sess.get_inputs():
    n = i.name
    inputs[n] = tii if ("token_type" in n or "segment" in n) else (mask if "mask" in n else ids)
sess.run(None, inputs)
t0 = time.perf_counter(); logit = sess.run(None, inputs)[0]; dt = (time.perf_counter()-t0)*1000
print(f"OK score={float(1/(1+np.exp(-logit.ravel()[0]))):.4f} latency_ms={dt:.1f}")
```
