# #232 — Couverture RGPD + AI Act du RAG local + pseudonymisation

Part of #227 · Ticket `wayfinder:research` (AFK) · Branche throwaway `research/rgpd-ai-act-232`
Fichier unique : `docs/research/232-rgpd-ai-act.md`

Question : base légale, minimisation via `.redacted/`, vault chiffré + `recordReveal`,
fail-closed `needsRedactionForProvider`, statut AI Act, registre/DPIA/journalisation.
Références locales : `server/services/vault.ts`, `rehydrationPersistence.ts`,
`runtimeRedaction.ts`, `src/lib/pii/redaction.ts`, `server/handlers/workspaceScan.ts`,
`CONTEXT.md` (+ `vaultKey.ts`, `piiAuditLog.ts`, `piiDetection.ts`, `src/lib/pii/labels.ts`, `vaultScope.ts`, `server/routes/ipc.ts`).

## 1. Ce que fait le code aujourd'hui (constats vérifiés)

- Vocabulaire `CONTEXT.md` : pseudonymisation = boucle complète (detect → tokenize →
  persist → reveal) ; redaction = aller seul (`[LABEL_N]` + rehydration map) ;
  vault key = localisation d'un blob chiffré (`doc-{path}` / `thread-{threadKey}`).
- Minimisation d'indexation : `workspaceScan.ts` scanne par défaut `paths = ['.redacted']`
  via `basemindScan({ root, paths, json })`. Le corpus indexé/embeddé est le shadow corpus,
  pas les originaux. `getWorkspaceScanStatus()` expose `redactionActive = binaire basemind présent`.
- Détection : `piiDetection.ts` = un seul moteur, `redact_text` basemind (pipeline xberg),
  pas de second GLiNER dans Electron. `isPiiModelReady()` = signal readiness via présence
  `.onnx` sous `basemind-hub/models--xberg-io--*`. Filtrage par `resolveMinConfidence()`
  (seuils par catégorie, question encore ouverte sur la map).
- Aller : `labels.ts buildRedactedText()` — tokens `[LABEL_N]`, déduplication contre
  littéraux pré-existants + `reservedTokens` du thread, fusion NER > regex
  (`mergeDetections`), map token → original.
- Runtime : `runtimeRedaction.ts` — hook `ToolManager.callTool → maybeRedactToolResult`
  sur file-read tools (allowlist explicite `read_file` + `builtin-fs fileAccess.mode=read` ;
  `builtin-test-filesystem` exclu). Non-texte (`\0`, >30 % non-imprimables) → fail-closed
  vers `[redaction deferred…]`, images non touchées (OCR hors scope #110). NER si ready,
  sinon fallback regex seul. Maps en mémoire par thread + tombstones anti-recréation
  après suppression.
- Fail-closed provider : `src/lib/pii/redaction.ts needsRedactionForProvider()` —
  `TRUSTED = {mistral, local}`, inconnu/`null` → `true` (redact). Commentaire serveur
  (`maybeRedactToolResult`) : seul `local` on-device saute la redaction côté serveur ;
  le distinguo « Mistral local vs Mistral API distante » est une notice renderer, pas
  une raison serveur de laisser passer du brut. `shouldBlockAttachmentSend()` : pièces
  jointes bloquées si `nerFailed` (pas de fallback regex-only pour les attachments).
- Vault : `vault.ts + vaultKey.ts` — passphrase 32 octets aléatoire, stockée chiffrée
  OS (`safeStorage`) en `{userData}/vaults/.vault-key.enc` (0600), jamais en clair.
  Blobs `{userData}/vaults/{docId}.enc` via outil basemind `vault encrypt/decrypt`.
  Sans OS store → erreur explicite `VAULT_DEGRADED_MESSAGE`, pas de bypass silencieux.
  `rehydrationPersistence.ts` : merge composer + runtime en un blob `thread-{threadKey}.enc`
  (mutex par thread, préservation post-restart), persistance « never fails a send »
  (dégradé = mémoire session + message, jamais de renvoi en clair).
- Retour : `vaultManager.decrypt(docId)` côté main, jamais de clé au renderer ;
  `deleteVaultBlob`, `listVaultBlobDocIds`, GC orphelins (`vaultGc`, triggered au premier
  accès, non-fatal). `threadVaultDocId()` partagé main/renderer via `src/lib/pii/vaultScope.ts`.
- Journalisation : `piiAuditLog.ts recordPiiReveal()` (`server/routes/ipc.ts pii.recordReveal`) —
  JSONL local append-only `{timestamp, scope, scopeType, token, category, surface}`,
  **jamais l'original déchiffré**, fichier copiable pour DPO, rotation 5 Mo → un seul `.1`,
  `never throws` (un échec log ≠ échec reveal, avec `console.warn`).

## 2. RGPD — analyse (sources 2026)

Sources : CNIL chap. IV (art. 25, 28, 30, 32, 35) ; EDPB Guidelines 01/2025
pseudonymisation + résumé ; ICO ch. 3 pseudonymisation ; avis CNPD minimisation/art. 89.

- **Champ d'application même en local-only.** Le RGPD s'applique dès qu'il y a
  traitement de données personnelles, même sans réseau. L'exception domestique
  (art. 2(2)(c)) ne couvre pas un usage professionnel du workspace. Ici l'utilisateur
  est le responsable du traitement de ses documents ; Workstation (OSS local) est le
  moyen, pas un sous-traitant hébergeur — il n'y a aucun transfert vers l'éditeur.
  Dès qu'un provider distant est appelé, il y a transfert à un destinataire
  (sous-traitant au sens art. 28, contrat + mesures requises côté provider).
- **Pseudonymisation ≠ anonymisation.** Art. 4(5) : token + information additionnelle
  (vault) = toujours données personnelles (EDPB 01/2025, ICO). Donc tout le dispositif
  reste dans le RGPD, mais c'est exactement la mesure attendue : art. 25 (privacy by
  design/default), art. 32(a) (pseudonymisation + chiffrement), principe minimisation
  art. 5(1)(c). EDPB : pas de base légale séparée pour la pseudonymisation elle-même ;
  la base du traitement principal s'étend à la transformation.
- **Base légale du traitement principal.** Le code n'a pas à la « choisir » — elle
  dépend de l'usage (exécution d'un contrat, intérêt légitime, consentement, obligation
  légale). Ce que le produit doit faire : (a) ne pas ajouter de finalité propre
  (pas de télémétrie PII — déjà séparé de `server/telemetry.ts`), (b) permettre à
  l'utilisateur d'appuyer son intérêt légitime / consentement (notice + registre
  modèle + minimisation prouvable). La pseudonymisation facilite le recours à
  l'art. 6(1)(f) (EDPB résumé) mais ne le remplace pas.
- **Minimisation via `.redacted/`.** Bon alignement : seul le shadow corpus part en
  embeddings/index/search ; originaux jamais envoyés au modèle distant. Points de
  vigilance : fallback regex-only (sans NER) laisse passer noms/adresses NER-only ;
  `shouldBlockAttachmentSend` existe mais doit être câblé sur tous les chemins send ;
  binaire non-texte = fail-closed (bon) mais marker non chiffré ; seuils
  `piiConfidencePolicy` encore ouverts (carte #227) — un seuil trop haut = fuite,
  trop bas = vault gonflé.
- **Vault chiffré + `recordReveal`.** Bon alignement art. 32 : clé OS + blobs chiffrés,
  séparation renderer/main, audit sans original (sinon l'audit déferait la mesure).
  Points de vigilance : clé liée à l'utilisateur/machine (message déjà explicite) ;
  GC orphelins best-effort silencieux ; rotation 5 Mo à un seul backup (acceptable
  pour reveals occasionnels, à documenter) ; `recordPiiReveal` ne throw jamais —
  une perte de ligne n'est visible que console, pas de compteur d'intégrité.
- **Fail-closed `needsRedactionForProvider`.** Bon alignement minimisation/confidentialité
  (EDPB §48 : pseudonymiser avant transmission à destinataire externe). Point dur :
  `mistral` est dans TRUSTED côté `redaction.ts` alors que le commentaire serveur dit
  que seule la variante on-device devrait sauter la redaction et que « Mistral API
  distante » est une notice renderer. Si `provider='mistral'` distant passe sans
  redaction, c'est un transfert de brut hors device contraire à l'intention affichée.
  À trancher : trust au niveau `ModelProvider` précis (local on-device vs API), pas
  au label flou `mistral`.
- **Registre / DPIA / journalisation.**
  - Registre art. 30 : le produit ne tient pas le registre de l'utilisateur à sa place,
    mais doit fournir le modèle pré-rempli (finalités, catégories, destinataires par
    provider, durées, mesures art. 32). Aujourd'hui : pas de gabarit livré.
  - DPIA art. 35 : a priori **non obligatoire** pour un RAG local personnel (pas
    d'évaluation systématique, pas de données sensibles à grande échelle au sens
    art. 35(3)), mais **recommandée** dès qu'un provider distant reçoit des
    pseudonymes réversibles + vault persistant (risque résiduel ré-identification).
  - Journalisation : `pii-audit.jsonl` couvre les reveals (exigence accountability),
    pas les envois pseudonymisés ni les échecs redaction. Suffisant pour un usage local,
    à compléter par durées + export/effacement documentés.

## 3. AI Act — statut (août 2026, sources Commission/AI Office/CSA/WSGR)

- **Pas un système à haut risque.** Annexe III : emploi, crédit, éducation, services
  essentiels, biométrie, infrastructures critiques, justice, migration… Un RAG local
  + NER + embeddings + rerank bureautique n'y figure pas → régime **risque minimal**.
  Pas d'évaluation conformité, pas de marquage CE, pas d'enregistrement base EU (art. 49),
  pas de logs 6 mois art. 26(6) / art. 12 requis. L'Omnibus numérique (mai 2026) a
  repoussé les obligations haut-risque autonomes au 2 déc. 2027 — sans effet ici.
- **Pas provider GPAI.** Les obligations GPAI (art. 53/55, applicables depuis août 2025,
  enforcement AI Office depuis 2 août 2026 : doc technique, copyright, résumé training,
  + risques systémiques >10^25 FLOP) pèsent sur Qwen / xberg-io, pas sur Workstation
  qui **déploie** des poids locaux. Devoir côté produit : tracer provenance/licence
  des 3 modèles (sujet #228) et répercuter leurs notices d'usage.
- **Reste applicable : transparence art. 50 (enforcement 2 août 2026, grâce partielle
  jusqu'au 2 déc. 2026 pour contenus déjà sur le marché).** Chatbot / contenu synthétique :
  informer l'interaction IA + signaler provenance (watermark/métadonnée). Pour ce RAG :
  mention « réponse assistée, sources locales pseudonymisées », distinction
  texte restauré vs brut, pas de présentation de tokens `[LABEL_N]` comme contenu final.
- **Pratiques interdites art. 5** (enforcement 2 août 2026, jusqu'à 35 M€ / 7 % CA) :
  non concerné en usage bureautique normal.
- **Bascule à surveiller :** si le RAG sert tri CV, notation employés, accès crédit/
  formation, aide à décision de justice → requalification haut-risque côté **déployeur**
  (art. 26 : supervision humaine, données d'entrée pertinentes, monitoring, logs ≥6 mois,
  information travailleurs, DPIA art. 35 RGPD via info art. 13). À interdire ou cadrer
  dans la notice d'usage.

## 4. Changements produit — exigés vs recommandés

### Exigés (bloquants pour une couverture honnête)

1. **Trancher le trust `mistral`.** `needsRedactionForProvider` doit distinguer
   `local` on-device (bypass OK) de `mistral-api` distante (redact obligatoire).
   Aujourd'hui le label `mistral` bypass côté `redaction.ts` contredit l'intention
   fail-closed du serveur. Exigé car transfert potentiel de brut.
2. **Câbler `shouldBlockAttachmentSend` partout.** Aucun payload attachment sur
   fallback regex-only ; texte seul peut dégrader, attachments bloquent. Vérifier
   chaque seam send.
3. **Garantir `.redacted/`-only vers l'index/embeddings distant.** `workspaceScan`
   default `['.redacted']` est bon ; auditer qu'aucun autre chemin (rescan, search,
   rerank distant) n'envoie des originaux ou des embeddings d'originaux.
4. **Notice + registre modèle livrés.** Notice locale (rôles : utilisateur responsable ;
   aucun transfert éditeur ; destinataires = providers configurés ; droits ;
   durées) + gabarit registre art. 30 pré-rempli (finalités, catégories, vault,
   audit, mesures art. 32). Sans ça, l'utilisateur ne peut pas prouver sa conformité.
5. **Durées + effacement documentés et effectifs.** Règle par blob
   (`doc-*`, `thread-*`, `.vault-key.enc`, `pii-audit.jsonl`) : suppression thread/
   document = `deleteVaultBlob + deleteRuntimeRehydrationMap` ; export/effacement
   audit expliqués (rotation 5 Mo/`.1` assumée).
6. **Transparence art. 50 minimale.** Mention interaction IA + provenance dans chat/
   viewer (contenu restauré signalé, tokens jamais exposés comme définitifs).

### Recommandés (non bloquants, à ticker après)

- DPIA légère écrite (même si non obligatoire) : périmètre local + cas provider
  distant, risques ré-identification, mesures (vault OS, audit sans original, fail-closed).
- Seuils `piiConfidencePolicy` par label + tests fuite/sur-redaction (lien Q map).
- Compteur d'intégrité du journal reveals (lignes tentées vs écrites) sans y mettre
  d'originaux ; export DPO un-clic (copie `pii-audit.jsonl` + registre).
- Interdire/cadrer les usages haut-risque Annexe III dans la notice (recrutement,
  crédit, justice) pour éviter une requalification art. 26.
- Tracer licences/provenance modèles (#228) pour la part GPAI (Qwen/xberg-io).
- Chiffrer au repos les shadow `.redacted/` si le workspace est sensible (défense
  en profondeur, au-delà du vault), ou documenter pourquoi non.

## 5. Réponse courte à la question du ticket

Base légale portée par l'usage de l'utilisateur (pas de base propre à la
pseudonymisation, EDPB) ; minimisation assurée par `.redacted/`-only + fail-closed
provider à corriger sur `mistral` ; vault OS-chiffré + audit sans original = mesure
art. 32 conforme ; pas de système haut-risque ni GPAI côté Workstation, seule la
transparence art. 50 s'applique ; manque un gabarit registre/DPIA légère/durées
pour que l'utilisateur prouve sa conformité. Liste ci-dessus en §4.

## Sources

- Locales : fichiers cités en tête (lus dans cette branche).
- CNIL — RGPD chap. IV (art. 25/28/30/32/35) ; EDPB Guidelines 01/2025 +
  résumé ; ICO ch. 3 pseudonymisation ; avis CNPD minimisation/art. 89.
- Commission — GPAI obligations ; AI Act art. 13/26/50 ; AI Office FAQ
  transparence ; CSA GPAI enforcement mai+août 2026 ; WSGR enforcement 2 août 2026.
- Recherches web 2026-09-18 (sessions `ses_f4ba97329ffeMOLVuV0UeUpW8u`).
