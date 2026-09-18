# #231 — Apport GLiNER small 2.5 pour PII en plus de la regex : trancher la fusion

**Date :** 2026-09-18 · **Map :** #227 · **Type :** research (frontière)
**Question :** qu'apporte GLiNER small 2.5 (+ variante gliner-pii-edge 181 Mo) par-dessus
notre regex (`src/lib/pii/regex-detector.ts`, `labels.ts` merge NER>regex,
`submodules/basemind/src/pii/patterns.rs` + `pipeline.rs`, seuils
`server/services/piiConfidencePolicy.ts`) — labels, précision/rappel, FR
multilingue, RAM/latence, seuils ? Trancher regex seule / NER seul / fusion.

**Verdict (1 phrase) : garder la fusion actuelle (NER primaire, regex fallback,
NER gagne sur chevauchement) ; la regex reste source de vérité sur les formats,
le NER n'apporte de valeur que sur noms / org / lieux / adresses.**

Sources locales lues : `src/lib/pii/regex-detector.ts`, `src/lib/pii/labels.ts`,
`server/services/piiDetection.ts`, `server/services/piiConfidencePolicy.ts`,
`submodules/basemind/src/pii/patterns.rs`, `pipeline.rs`, `validators.rs`,
`pii.rs`, `server/utils/hubCache.ts`.
Sources web : `huggingface.co/gliner-community/gliner_small-v2.5`,
`huggingface.co/knowledgator/gliner-pii-edge-v1.0` (+ README, dossier `onnx/`),
`docs.knowledgator.com` (table modèles), `huggingface.co/xberg-io/gliner-models`,
`fastino.ai` + `arxiv.org/abs/2605.09973` (GLiNER2-PII, benchmark SPY).

---

## 1. Ce que fait déjà notre côté sans NER

| Couche | Labels couverts | Comportement |
|---|---|---|
| `regex-detector.ts` (renderer, instantané) | 5 : `email`, `iban`, `phone`, `ipv4`, `credit_card` | 1 passe unique (alternation, IBAN prioritaire sur CC), dédupliqué, `confidence: 1.0`. ~0 RAM, < 1 ms. |
| `labels.ts` `mergeDetections(primary=NER, fallback=regex)` | + `person_full/first/last_name`, `organization`, `location`, `address`, `city`, `ipv6`, `ip_address`, `phone_number` (aliases + TOKEN_LABELS) | **NER gagne sur tout chevauchement**, regex bouche les trous. `normalizePiiCategory` neutralise les alias. |
| basemind `patterns.rs` + `validators.rs` | 6 NIR/IDs UE (`national_id_fr/nl/be/at/ie/pt` + `generic`), 19 secrets/infra (`aws/gcp/azure/api_key/jwt/bearer/oauth/ssh/gpg/tls/db/env_secret`, `ipv4/6_private`, `internal_hostname/url`, `mac`, `cookie_id`), `IBAN_REGEX` | Regex pré-filtre + **validateur checksum/format** : NIR MOD-97 (+ Corse 2A/2B → 19/18), BSN elf-proef, NISS 97 (+ variante `2`-préfixe), SVNR MOD-11, PPS alphabet W…V, NIF MOD-11, IBAN MOD-97 + longueur par pays (FR = 27), E.164 (`+` obligatoire, 8–15 chiffres), JWT (`eyJ…` 3 segments base64url), DB string (`user:pass@host` requis), IPv4 privée RFC 1918. |
| `piiDetection.ts` | readiness sur 3 motifs hub (`xberg-io/gliner-pii-models`, `knowledgator/gliner-pii-edge-v1.0`, `xberg-io/gliner-models`), détection via outil unique `basemind redact_text` (pas de 2ᵉ GLiNER dans Electron) | Spans sous le seuil **écartés, pas d'échec** ; `shouldBlockAttachmentSend` ne bloque que si NER n'a pas tourné. |
| `hubCache.ts` | idem + `embeddings`, `reranker` | 3 dirs candidates (XDG data-home `basemind/hub`, legacy `~/.cache/huggingface/hub`, override env), recherche `.onnx` profondeur 4 (snapshots + preset). |

## 2. Les deux modèles comparés

|  | gliner_small-v2.5 (xberg-io export) | gliner-pii-edge-v1.0 (Knowledgator) |
|---|---|---|
| Nature | **NER généraliste zéro-shot** (`gliner-community/gliner_small-v2.5`, Apache-2.0), pas fine-tuné PII. Export xberg ONNX fp32 sans requantification. Poids amont ~ глубина small (classe 74–184 Mo selon variante ; export fp32 **~673 Mo sur disque cité par la map #227**, coût RAM runtime > 1 Go). | **PII fine-tuné** (`deberta-v3-xsmall`, 71 Mo de poids). ONNX **`onnx/model.onnx` = 181 Mo**, FP16 330 Mo, UINT8 ~197 Mo. 60+ catégories PII prédéfinies + zero-shot custom. |
| Précision/rappel | Benchmark NER généraliste (carte HF) : **F1 moy. 46,6 %** (CoNLL 66,6 %, WikiNeural 73,8 %, OntoNotes 29,6 %) — pas une mesure PII. En PII il faut lui passer les labels à chaque inférence (`custom_labels`) et calibrer soi-même. | Carte Knowledgator (jeu synthétique interne, **in-distribution donc optimiste**) : **P 78,96 / R 72,34 / F1 75,50**. small 76,84 · base 80,99 (R 82,78) · large 83,25. Sur **SPY (hors-distribution, exact-match)** la famille Knowledgator plafonne : base P 0,39 / R 0,32–0,37 / F1 **0,35–0,39** (edge non évalué sur SPY, supposé ≤ base). GLiNER2-PII récent fait F1 0,47 / R 0,68–0,72 — pas notre modèle, cité comme borne haute. |
| FR / multilingue | Généraliste multilingue partiel (MultiNERD R 87 %, PolyglotNER F1 43 %) mais **aucune connaissance des formats FR** (NIR, IBAN FR, +33). | EN-centré ; `urchade/gliner_multi_pii-v1` (concurrent F1 76,86) est le seul explicitement multilingue. Les formats FR restent portés par nos validateurs (NIR, IBAN-27, E.164). |
| RAM / latence (CPU-only, budget 8 Go) | ~673 Mo disque + runtime ONNX fp32 → **> 1 Go RAM**, latence la plus haute des trois. **Incompatible avec le trio embeddings + NER + reranker sur 8 Go.** | 181 Mo disque → **~300–500 Mo RAM**, dizaines–centaines de ms/chunk CPU. **Seul viable** sur le budget 8 Go (cf. #229 à mesurer). |
| Labels PII utiles | Tous, mais en mode custom à définir (risque de dérive de schéma). | 60+ natifs : noms, contacts, gov IDs, bancaires, digitaux, secrets, dates. |

## 3. Matrice labels : qui détecte quoi (reco par label)

Légende : ✅ source de vérité · ◐ confirmation/complément · ❌ ne pas confier.

| Label | Regex renderer (5) | Basemind regex+validateurs | NER (edge/small 2.5) | Recommandation |
|---|---|---|---|---|
| `email` | ✅ (1 passe, conf 1.0) | seuil 0.90 | ◐ (NER redondant) | **Regex source de vérité** ; NER ignoré sur chevauchement ou seuil 0.90. |
| `iban` | ✅ (prioritaire sur CC) | ✅ MOD-97 + longueur pays, seuil 0.95 | ◐ raw 0.3 + validation obligatoire | **Regex+validator** ; NER seuil haut 0.85 renderer (un NER faible écarté laisse le regex debout). |
| `credit_card` | ✅ | ✅ seuil 0.95 | ◐ idem IBAN | Idem IBAN. |
| `phone` / `phone_number` | ✅ (format US-centré, élargir vers E.164) | ✅ E.164 strict, seuil 0.85 | ◐ | **Regex+E.164** ; NER 0.85. |
| `ipv4` / `ip_address` / `ipv6` | ✅ ipv4 seul | ✅ privée/publique, seuil 0.85 | ◐ raw 0.3 | Regex ; NER 0.85. |
| secrets (`api_key`, `aws_*`, `jwt`, `bearer`, `oauth`, `ssh/gpg/tls`, `db_*`, `env_secret`, `password`) | ❌ (non couvert !) | ✅ patterns + validateurs (JWT, DB), seuil 0.95 | ◐ raw 0.3 lenient + validation aval | **Basemind regex+validateurs source de vérité** ; NER seuil haut, jamais seul (rappel NER 72 % < filets exacts ~100 % sur formats valides). |
| `national_id_*` (FR NIR + 5 UE) | ❌ | ✅ regex + checksums par pays, seuil 0.95 | ◐ (`government_id`, `national_id_number`…) | **Basemind seul** ; NER ne fait que proposer, le checksum tranche. Cas FR : NIR 15 chiffres MOD-97, Corse 2A/2B, IBAN FR 27, tél +33 E.164 — tous validés côté Rust, pas par le modèle. |
| `person_full/first/last_name`, `person` | ❌ (**angle mort regex**) | seuil 0.75 | ✅ **seul apport décisif du NER** (mais sur-prédit : noms communs/organisations confondus — cf. analyse GLiNER2-PII) | **NER seul**, seuil strict : raw 0.7 (`gliner_label_threshold`) + renderer 0.6 (`piiConfidencePolicy`). Monter à 0.7 renderer si trop de faux positifs FR (prénoms/noms composés, particules). |
| `organization`, `location`, `address`, `city`, `postal_code`, `date_of_birth`, `passport`, `drivers_license`, `tax_id`, `bank_account` | ❌ | partiel (pas de regex renderer) | ✅ seul apport | **NER seul**, seuil pipeline 0.70 (org/location) / défaut 0.80, renderer défaut 0.5. |
| `internal_hostname/url`, `mac_address`, `cookie_id` | ❌ | ✅ seuil médium/low | ◐ | Basemind regex ; NER inutile. |

## 4. Seuils : politique actuelle + ajustements proposés

Actuel (2 couches, divergence connue) :

- Basemind `pipeline.rs` — `gliner_label_threshold` (brut) : `person`/`full_name` **0.7 strict** (sur-prédiction), `api_key`/`password`/`iban`/`ip_address` **0.3 lenient** (la validation aval filtre), défaut 0.5. Puis `confidence_threshold` (pipeline) : secrets/IDs/IBAN/CC **0.95**, `email`/`internal_*` **0.90**, `phone`/`ip` **0.85**, `person_*` **0.75**, `org`/`location` **0.70**, défaut **0.80**. `dedupe_spans` : le plus confiant gagne, égalité → le plus long.
- Renderer `piiConfidencePolicy.ts` (2ᵉ filtre sur `redact_text`) : défaut **0.5**, `iban`/`credit_card` **0.85**, `person_*` **0.6**. `override` remplace toute la politique pour l'appel.

Recommandé (garder la structure, aligner 2 points) :

1. **Secrets / IBAN / CC / national_id : NER ≥ 0.85 renderer + validation format obligatoire.** Un NER faible écarté laisse le regex debout (filet actuel — le garder explicitement).
2. **`email` 0.90, `phone`/`ip` 0.85** (inchangé) ; **`person_*` 0.6 renderer + 0.7 brut** (inchangé, réévaluer à 0.7/0.7 si bruit FR).
3. **`organization`/`location` 0.70, défaut 0.5 renderer / 0.80 pipeline** (inchangé).
4. **Élargir le `phone` renderer vers E.164** (aujourd'hui US-centré `(\d{3})…`) pour les +33 FR ; le validateur strict existe déjà côté Rust.
5. Documenter la divergence voulue : pipeline basemind **stricte (0.95/0.75)** car elle précède les validateurs, renderer **plus permissif (0.85/0.6)** car second filtre + regex en filet. Ne pas « harmoniser » en une seule valeur.

## 5. Coût vs apport, tranché

- **Regex seule ? Non.** Rappel nul sur noms/org/lieux/adresses (le cœur RGPD : identifier une personne sans format fixe). Les secrets/IDs/IBAN seraient couverts, mais tout le PII contextuel passerait.
- **NER seul (small 2.5 ou edge) ? Non.** Régression sur les formats exacts : rappel NER 72–83 % (interne) voire ~35 % (SPY exact-match) contre ~100 % des filets regex+checksum sur formats valides ; surcoût RAM/latence ; sur-prédiction des noms sans seuils par label.
- **Fusion actuelle ? Oui, avec edge comme moteur NER.** `mergeDetections` (NER gagne sur chevauchement, regex bouche les trous) + `dedupe_spans` (plus confiant gagne) est exactement le montage que la littérature GLiNER-PII recommande (seuils par label + validation format aval). **Choisir `gliner-pii-edge-v1.0` (181 Mo), pas `gliner_small-v2.5` (~673 Mo)** : F1 PII mesuré (75,5 vs 46,6 NER généraliste), 60+ labels natifs, seul compatible 8 Go avec embeddings+reranker. Small 2.5 reste un NER généraliste sans fine-tune PII — à réserver à un usage extraction générique, pas à la pseudonymisation.
- FR multilingue : le modèle ne parle pas les formats FR ; ce sont **patterns + validateurs Rust** (NIR, IBAN-27, E.164 +33, PPS/NISS/BSN/SVNR/NIF) qui portent la conformité. Tout test FR doit inclure : « Jean-Pierre Martin-Dupont », « 1 85 07 75 010 000 58 » (NIR), « FR14 2004 1010 0505 0001 3M02 606 », « +33 6 12 34 56 78 », « 192.168.1.10 vs 8.8.8.8 ».

## 6. Limites / à mesurer (#229)

- Chiffres Knowledgator = jeu synthétique interne (optimistes) ; SPY = exact-match sévère (pessimiste). Ni l'un ni l'autre = notre trafic FR réel : **calibrer sur un mini-set FR annoté** avant de figer les seuils `person_*`.
- RAM/latence ci-dessus = ordres de grandeur ONNX CPU (181 Mo → ~300–500 Mo ; fp32 673 Mo → > 1 Go). **Mesures locales 8 Go exigées par #229** (trio chargé, latence/chunk, OFF vs ON).
- `phone` renderer US-centré et `ipv6`/`secrets` absents du renderer : combler via basemind (déjà couvert) plutôt qu'en dupliquant les patterns côté TS.
