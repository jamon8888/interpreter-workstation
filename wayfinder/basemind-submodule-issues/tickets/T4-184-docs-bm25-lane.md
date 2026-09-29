# T4: Docs BM25 lane in basemind

**GitHub:** [#184](https://github.com/jamon8888/interpreter-workstation/issues/184)
**Label:** wayfinder:task
**Part of:** [#174](https://github.com/jamon8888/interpreter-workstation/issues/174)

## What

Build the upstream half of the search decision from [#179](https://github.com/jamon8888/interpreter-workstation/issues/179)
(document search surface) in basemind's own repo (`submodules/basemind`).

### Tasks

- BM25/keyword lane for the `documents` table, mirroring code search
  (native Okapi BM25, postings in Fjall).
- RRF fusion across the docs lanes (reuse `search/rrf.rs` pattern).
- Exercise the document rerank pass (`bge-reranker-v2-m3`) via the
  shared `rerank_hits` helper — configured but never called for
  documents today.
- Keep the vector-KNN `search_documents` scope+mime filter intact.

## Context

Code search already has the full hybrid pattern (vector + BM25 + RRF +
rerank); the docs lane mirrors it. Built alongside the basemind wiring
ticket (#183).

Decision that feeds into this:
- [#179](https://github.com/jamon8888/interpreter-workstation/issues/179): Upstream BM25 lane for documents (CLOSED)
