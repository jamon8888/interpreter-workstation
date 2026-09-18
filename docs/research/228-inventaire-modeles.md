# #228 — Inventaire modèles HF : Qwen3 vs trio xberg-io

Date : 2026-09-18. Trio actuel confirmé par `server/handlers/basemindDownload.ts`, `server/utils/hubCache.ts`, `src/components/onboarding/screens/BasemindSetupScreen.tsx` : embeddings `xberg-io/embedding-models` (bge-base-en-v1.5, 113 Mo affichés), reranker `xberg-io/reranker-models` (bge-reranker-v2-m3, 1,1 Go), NER `xberg-io/gliner-pii-models` + `knowledgator/gliner-pii-edge-v1.0` + `xberg-io/gliner-models` (gliner_small-v2.5, 673 Mo). `hubCache.ts` ne valide une ressource que par la présence d'un `.onnx` en cache — tout candidat non-ONNX exige un export + câblage basemind.

| Modèle (repo HF) | Poids disque / RAM CPU estimée | Licence redistribution | Format ONNX / candle | Exige AVX2 ? | CPU-only offline ? |
|---|---|---|---|---|---|
| Qwen3-Embedding-0.6B (`Qwen/Qwen3-Embedding-0.6B`) | ~1,2 Go bf16 / 4–8 Go RAM | Apache-2.0 (fiche HF) | safetensors transformers uniquement, pas d'ONNX officiel ; export manuel | Non (si candle/transformers), mais lent sans AVX2 | Oui après download |
| Qwen3-Embedding-4B / 8B | ~8 Go / ~15 Go poids ; RAM 16 Go+ / 32 Go+ | Apache-2.0 (série Qwen3) | Idem, export manuel ; dim 2560/4096 vs 1024 | Idem | Oui mais hors gabarit onboarding local |
| Qwen3-Reranker-0.6B/4B/8B (`Qwen/Qwen3-Reranker-*`) | 0.6B ~1,2 Go / 4–8 Go ; 4B/8B comme ci-dessus | Apache-2.0 | safetensors uniquement, pas d'ONNX officiel ; surclasse bge-reranker-v2-m3 sur MTEB-R/MMTEB-R (fiche Qwen) | Idem | Oui, même réserve |
| bge-base-en-v1.5 (`BAAI/`, via `xberg-io/embedding-models`) | 109 M params ; 113 Mo affichés UI (ONNX) | MIT (FlagEmbedding, usage commercial gratuit) | ONNX officiel (optimum `onnx/model.onnx`) + `onnx-community` | Oui via ORT stock → couvert par build noavx2 | Oui |
| bge-reranker-v2-m3 (`BAAI/`, via `xberg-io/reranker-models`) | 0,6 B params ; 1,1 Go affichés UI | Apache-2.0 (fiche HF) | ONNX via `onnx-community/bge-reranker-v2-m3-ONNX` | Oui via ORT → build noavx2 | Oui |
| gliner_small-v2.5 (via `xberg-io/gliner-models`) | 664 Mo pytorch upstream ; 673 Mo ONNX fp32 affichés | Apache-2.0 (héritée `gliner-community`) | ONNX fp32 span-mode opset 19 prêt (`models/gliner_small-v2.5/span/fp32/model.onnx` + sha256) | Oui via ORT → build noavx2 | Oui |
| gliner-pii-edge-v1.0 (`knowledgator/`, préséed par `basemindPreseed.ts`) | `onnx/model.onnx` 181 Mo ; variantes FP16 330 Mo / UINT8 197 Mo | Apache-2.0 (fiche HF) | ONNX natif dans le repo (`onnx/`) | Oui via ORT → build noavx2 | Oui, optimisé edge (rappel légèrement < small, latence/empreinte meilleures) |

Sources : fiches HF Qwen3-Embedding/Reranker (README + API `Qwen/Qwen3-Embedding-0.6B` : Apache-2.0, 595 776 512 params BF16), `BAAI/bge-base-en-v1.5` (MIT, usage ONNX), `BAAI/bge-reranker-v2-m3` (Apache-2.0), `xberg-io/gliner-models` (Apache-2.0, manifest ONNX fp32 + sha256), `knowledgator/gliner-pii-edge-v1.0` (Apache-2.0, `onnx/model.onnx` 181 Mo), `docs/research/avx-free-onnxruntime.md` (ORT stock exige AVX2).

## Décision (2026-09-18, corpus européen focus FR)

Corpus européen focus FR ⇒ presets anglais-only écartés (`fast`, `balanced`, `jina-turbo-en`, `ettin`, `bge-reranker-base` = EN+ZH).

- **Embeddings** : `fast` (24 Mo) et `balanced` (113 Mo) hors jeu (EN). Piste légère FR : `Infojura/mmlw-retrieval-e5-small-onnx` (~135 Mo, 384-dim, Apache-2.0, déjà dans `KNOWN_CUSTOM_DIMENSIONS`) — couverture FR à valider en #229. Presets multilingues officiels trop lourds : e5-base 1,1 Go, arctic 1,25 Go, qwen3-embedding 2,4 Go.
- **Reranker : GTE retenu** — `onnx-community/gte-multilingual-reranker-base`, fichier `onnx/model_int8.onnx` (**~341 Mo**), Apache-2.0, vrai cross-encoder multilingue. Écartés : `jina-v2-multilingual int8` (280 Mo, efficacité ≈ bge-v2-m3, mais licence CC-BY-NC-4.0 incompatible redistribution), `mmarco-mMiniLMv2` (~470 Mo, pas d'ONNX natif), `futur/*-model2vec-onnx` (bi-encodeurs statiques, pas des rerankers).
- **Câblage** : `RerankerModelType::Custom { model_id, model_file: "onnx/model_int8.onnx", head: CrossEncoder }` + ajout dépôt dans `MODEL_RESOURCE_REPOS`/`basemindDownload` — pas de preset existant.
- **#229 mesure** : GTE-int8 vs bge-v2-m3 sur corpus FR (qualité + latence CPU + RAM).
