# Registre des traitements — modèle pré-rempli (art. 30 RGPD)

Gabarit livré avec Workstation pour l'utilisateur, responsable de traitement de
ses documents (analyse #232). Remplir les crochets avant usage professionnel.

## Traitement : recherche locale et pseudonymisation des documents

- **Responsable** : [nom / organisation de l'utilisateur].
- **Finalités** : recherche sémantique locale ; pseudonymisation avant tout
  envoi à un fournisseur distant.
- **Catégories de données** : contenu des documents du workspace ; PII
  détectées (noms, contacts, identifiants, bancaires — voir NER edge 60+
  catégories + regex/validateurs) ; journal des révélations (sans valeurs).
- **Catégories de personnes** : l'utilisateur, ses contacts, tiers cités.
- **Destinataires** : aucun en local-only. Si provider distant configuré :
  [liste des providers + lien vers leurs accords art. 28] — données
  pseudonymisées uniquement (`[LABEL_N]` + vault local).
- **Transferts hors UE** : [selon providers configurés ; aucun par défaut].
- **Durées** : rehydration maps = durée du thread/document + [choix] ;
  audit `pii-audit.jsonl` = [choix] ; effacement via suppression du vault
  (`deleteVaultBlob`) + `vaultGc`.
- **Mesures art. 32** : pseudonymisation + vault chiffré (clé OS 0600),
  fail-closed (`needsRedactionForProvider`, `shouldBlockAttachmentSend`),
  minimisation (seul `.redacted/` est indexé).
- **Base légale** : [contrat / intérêt légitime / consentement selon usage].

## Activation du reranker GTE (opt-in workspace)

Par défaut le reranker actif est `bge-reranker-v2-m3`. Pour le GTE
multilingue int8 (~341 Mo, Apache-2.0), ajouter au `basemind.toml` du
workspace servi :

```toml
[code_search.reranker.custom_model]
model_id = "onnx-community/gte-multilingual-reranker-base"
model_file = "onnx/model_int8.onnx"

[documents.reranker.custom_model]
model_id = "onnx-community/gte-multilingual-reranker-base"
model_file = "onnx/model_int8.onnx"
```

Un `reranker_preset` explicite par appel garde la priorité sur ce réglage.
