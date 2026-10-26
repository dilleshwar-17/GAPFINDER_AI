# RAG Pipeline

The pipeline runs in two phases: **ingestion** (once per upload) and
**retrieval** (per diagnostic topic or assistant question). Everything is
persisted; nothing is recomputed from a transient cache.

```
Upload ─► validate ─► store ─► extract ─► normalise ─► chunk ─► embed ─► persist
                                                                              │
Question/topic ─► embed query ─► authorised vector scan ─► hybrid rank ─► threshold
                                                                              │
                                                            evidence (with provenance)
                                                                              │
                                              generate ─► validate citations ─► store/answer
```

## 1. Ingestion

### 1.1 Validation (`src/lib/services/documents.ts`)

- Subject must belong to the caller (`getSubjectOwned`).
- Shared-demo accounts are blocked unless the internal `allowDemo` seeding flag
  is set.
- File must be non-empty and at most `MAX_UPLOAD_MB` (default 8 MB).
- Extension/MIME must be PDF, `.txt`, `.md`, or `.markdown`.
- Duplicate content is rejected per owner with `409 CONFLICT` using a SHA-256 of
  the bytes (compared across the owner's documents, so the same handout cannot
  be silently indexed twice under one account).
- A `processing` row keeps the original bytes in `file_data`.

### 1.2 Extraction (`src/lib/ingest/extract.ts`)

**PDF**

- Verifies the `%PDF-` signature.
- `unpdf` extracts text page by page (`mergePages: false`).
- Each page is normalised; empty pages are dropped.
- Fewer than 40 characters of text → `EXTRACTION_FAILED`.
- Encrypted, corrupt, or image-only PDFs fail with a clear message rather than
  producing an empty index.

**Text / Markdown**

- Rejects NUL bytes in the first 4096 bytes (binary masquerading as text).
- Requires valid UTF-8 (`TextDecoder(..., { fatal: true })`).
- Strips a BOM.
- If the file contains form feeds (`\f`), each segment becomes a page. A plain
  text file with no page boundaries gets `page_number = null`; the app does not
  invent page numbers.
- Fewer than 20 characters → `EXTRACTION_FAILED`.

### 1.3 Normalisation (`src/lib/domain/chunking.ts`)

`normalizeText`:

- CRLF/CR → LF,
- removes NUL and non-breaking spaces,
- collapses runs of spaces/tabs,
- trims spaces around newlines,
- collapses 3+ newlines to a blank line,
- trims the ends.

### 1.4 Chunking

`chunkPages` is page-aware and heading-aware. A chunk never spans two source
pages, so every citation resolves to exactly one verified page (or `null`).

Configuration (`CHUNKING_CONFIG`):

| Setting | Value | Meaning |
| --- | --- | --- |
| `targetChars` | 1600 | Flush once a chunk reaches this |
| `maxChars` | 2200 | Hard ceiling for appended paragraphs |
| `minChars` | 200 | Chunks below this are merged or dropped |
| `overlapChars` | 260 | Tail carried into the next chunk on the same page |

Algorithm:

1. Split the page into blocks: headings (detected conservatively) and
   paragraphs.
2. Oversized paragraphs are split at sentence boundaries, then hard-split only
   as a last resort.
3. Headings become the active section heading. They are prepended to the chunk
   body so the chunk is self-describing.
4. When adding a paragraph would exceed `maxChars`, the current chunk is emitted
   and up to 260 characters of its tail are carried over (only within one page
   and only if the tail is at least 80 characters).
5. A chunk shorter than `minChars` is merged into the previous chunk on the same
   page when the combined text stays under `1.3 × maxChars`. **The merge keeps
   the full body, including its section heading**, so a merged section is not
   silently detached from its heading — this was a real defect found and fixed
   during verification (see the regression test in `tests/chunking.test.ts`).
6. A remaining chunk under 120 characters is discarded.
7. Chunks with an identical SHA-256 body are deduplicated within the document.

Stored metadata per chunk: `chunk_index`, `text`, `page_number`,
`section_heading`, `char_start`, `char_end`, `embedding`, `embedding_model`,
`embedding_dim`.

### 1.5 Embeddings (`src/lib/ai/embeddings.ts`)

Two interchangeable providers, chosen by `src/lib/env.ts`:

| Provider | When | Model | Dims | Nature |
| --- | --- | --- | --- | --- |
| Gemini | `GEMINI_API_KEY` set and `EMBEDDING_PROVIDER != local` | `gemini-embedding-001` | 768 (configurable 128–3072) | Neural, `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY` task types, batched 16 at a time, retried with backoff on 429/5xx |
| Local | No key, or forced | `gapfinder-hash-v1` | 512 (configurable 64–2048) | Deterministic FNV-1a feature hashing over unigrams + bigrams, L2-normalised |

The local embedder is a **real persistent vector representation**, but it models
lexical overlap, not semantics. The UI and docs label it as non-neural. This was
the configuration used for every verification run in this repository, because no
Gemini key was available.

Vectors are stored as raw `Float32Array` bytes. The model identifier and
dimension are stored with each chunk. Retrieval compares only chunks whose model
and dimension match the current configuration, so switching providers never
silently scores incompatible vectors. (Any documents indexed under another model
are reported to the learner, who can re-process them.)

## 2. Retrieval (`src/lib/retrieval/retrieve.ts`)

### 2.1 Query construction

For a topic, `buildTopicQuery` concatenates the topic name and description plus:

> `Key definitions, processes, mechanisms, and relationships.`

For the assistant, the user's question is appended to the topic query.

### 2.2 Authorised candidate scan

A single SQL query selects chunks where:

- `c.owner_id = ?` and `c.subject_id = ?` (authorization and subject scope),
- `d.status = 'ready'`,
- `c.embedding_model = ?` and `c.embedding_dim = ?` (current provider),
- optionally `c.document_id IN (...)` for a narrower source set,

with a hard `LIMIT 5000`. Ownership is enforced **before** any text is scored, so
an unauthorized chunk is never loaded.

### 2.3 Hybrid scoring

For each candidate:

```
semantic = clamp01(cosine(queryVector, chunkVector))
lexical  = |queryTerms ∩ chunkTerms| / |queryTerms|
combined = 0.75 * semantic + 0.25 * lexical
```

Terms are lowercase alphanumeric words with stopwords removed. Lexical scoring
counts **unigram overlap only**, using terms of at least three characters; the
local embedding model separately hashes unigrams (two or more characters) and
adjacent bigrams. Bigrams therefore influence cosine similarity but not the
lexical term. The weighting is deliberately fixed and documented so ranking is
inspectable and stable rather than tuned invisibly.

Candidates below `RETRIEVAL_MIN_SCORE` (default `0.15`) are dropped. The
remainder is sorted by descending score (filename as a tiebreak) and truncated
to the requested `topK`. `RETRIEVAL_TOP_K` (default `6`) is the fallback used by
BUDDY; the diagnostic passes `topK = 8` explicitly.

### 2.4 Sufficiency gate

`retrieval.sufficient` is true only when there is at least one passage and the
top score meets the threshold **and** the total evidence length is at least
`MIN_EVIDENCE_CHARS` (default `240`). Otherwise `reason` explains which case
applies:

- no chunks at all → upload material first;
- chunks exist but were indexed under a different model → re-index;
- nothing passed the threshold → no relevant passage;
- passages too short → add more complete material.

Callers must respect this flag:

- diagnostics skip the topic (and report why); if every topic is skipped the
  request fails with `INSUFFICIENT_EVIDENCE`;
- the assistant abstains with an empty answer and zero citations.

## 3. Generation and citation validation

- **Questions** are generated from the retrieved evidence only. Each generated
  question must supply one or more chunk IDs. `resolveQuestionSources` rejects
  the question if any cited ID was not in the retrieved set, if the list is
  empty, or if no usable citation remains. Accepted questions persist rows in
  `questions` and `question_sources` (with page and heading snapshots).
- **Explanations** are validated by `validateCitationIds`: any citation not
  resolvable to a retrieved chunk invalidates the response, and the service falls
  back to an extractive, source-linked answer. The model cannot invent a source
  or widen its scope.
- Citation excerpts are collapsed whitespace, cut at a word boundary to 420
  characters, and labelled with document title, page number and section heading.

## 4. Why this is retrieval-augmented rather than "LLM with a prompt"

- Evidence is selected **before** generation and is the only content supplied to
  the model.
- Output is structured JSON validated by Zod; free-form prose with embedded
  pseudo-citations is not trusted.
- Citation IDs are re-checked against the exact evidence set server-side.
- Insufficient evidence produces an abstention, not a confident guess.
- Retrieved text is treated as untrusted data; instructions inside a document
  are not followed (prompt-injection resistance).

## 5. Operational limits and re-indexing

- Retrieval is an exact scan over up to 5000 chunks per subject, not an ANN
  index. This is acceptable for single-learner workspaces and demo data; a
  multi-tenant scale-out would use pgvector with an ANN index.
- A single document is capped at **400 chunks**; a larger upload is rejected
  with a message asking for smaller files. Content hashes are the first 32 hex
  characters of SHA-256 and are used to drop duplicate chunks within one
  document.
- A provider change does not rewrite existing vectors. Documents indexed under
  the old model are excluded from retrieval and the learner is told to re-index.
  The document **Retry processing** action re-extracts and re-embeds the stored
  bytes.
- Embeddings of documents are stored alongside the file bytes, which increases
  database size. That trade-off keeps retries possible and the app
  self-contained.
