# Known Limitations

This file records what the build does **not** do, what was **not verified**, and
where the implementation would need work before production use. Nothing here is
a hidden defect; where a limitation could mislead a learner, the UI says so too.

---

## 1. Verification gaps

### 1.1 Live Gemini was not exercised

No `GEMINI_API_KEY` was available. Every verification run used:

- deterministic lexical embeddings (`gapfinder-hash-v1`, 512 dims),
- the deterministic question generator,
- deterministic rubric grading,
- extractive assistant answers.

The Gemini code paths (question generation, short-answer evaluation, explanation,
neural embeddings) are implemented, schema-constrained and type-checked, but
**were not run against the live provider**. A configured key is required to
validate latency, quota behaviour, schema compliance and answer quality.

### 1.2 No deployment

The app was **not deployed**. No Vercel CLI, `VERCEL_TOKEN`, GitHub token, or
hosting authorization was available. `docs/DEPLOYMENT.md` describes the intended
path and its blockers; it does not claim a live URL.

### 1.3 No browser automation

Playwright/Puppeteer were not installed. UI verification was done by:

- server-rendering pages over HTTP and asserting status/content (smoke suite),
- service-level tests,
- reading compiled output.

There was no automated interaction test of:
- drag/drop or file-picker behaviour in a real browser,
- client-side validation timing,
- responsive layout at specific breakpoints,
- keyboard-only traversal,
- screen-reader announcements,
- microphone capture or speech-recognition transcription,
- speech-synthesis playback,
- light/dark theme persistence across reloads and every dark surface.

The UI is built with semantic landmarks, labelled controls, visible focus styles
and `aria-live` regions, but it has **not** had a formal accessibility audit
(WCAG conformance is not claimed).

### 1.4 No third-party security review

No penetration test, dependency audit sign-off, or external security assessment
was performed. `npm audit` was not used as a release gate.

### 1.5 Tests use an in-memory database and disabled provider

`DATABASE_PATH=:memory:` and the provider is unset. Tests are fast and
deterministic, but they do not exercise a long-lived file, concurrent processes,
or real network failures.

### 1.6 BUDDY voice features and the dark theme are browser-dependent

- **Voice input** uses the browser's `SpeechRecognition` /
  `webkitSpeechRecognition` API. Several browsers (including common Firefox
  builds) do not implement it; the control is disabled and typing still works.
  Chrome and some Chromium derivatives may send audio to the browser vendor's
  speech service for transcription. That processing happens outside GapFinder;
  the privacy notice says so. There is no server-side audio upload.
- **Spoken replies** use `window.speechSynthesis`. Voice quality, available
  voices and language support depend on the operating system and browser.
- **Theme persistence** uses `localStorage` and a pre-paint script. It is not
  synchronised across devices or browsers, and clearing site data resets it.
- The dark theme re-maps the light palette with CSS, including a compatibility
  layer for the arbitrary colour utilities used in the existing pages. It has
  been checked by source review and the production build, **not** by a visual
  regression suite.

### 1.7 Performance work was not load-tested

Prepared statements are cached, SQLite runs in WAL mode with
`synchronous=NORMAL`, subject aggregates are grouped, session lookup is
request-cached, and extra lookup indexes were added. No production load test,
profiling session or benchmark harness was available, so no percentage
speed-up is claimed. Re-measure on the target host before making performance
claims.

---

## 2. Persistence and scale

### 2.1 SQLite is not a production serverless database

The app uses Node's built-in `node:sqlite` (`DatabaseSync`). This is excellent for
a local demo and a single process, but:

- the database is a **file on local disk**;
- serverless platforms such as Vercel do not provide durable, shared local
  storage between invocations;
- multiple instances would not share writes safely;
- there is no replication, backup, failover or connection pooling.

A production deployment needs Postgres (with pgvector) and a storage adapter.
The schema is relational and avoids SQLite-only SQL, but **a Postgres adapter was
not built**.

### 2.2 Exact vector scan

Retrieval loads up to **5000 chunks per subject** and computes cosine similarity
in application code. There is no ANN index (HNSW/IVF). This is fine for
single-learner material; it will not scale to large multi-tenant corpora.

### 2.3 Uploaded files are stored in the database

`documents.file_data` retains the original bytes so a failed extraction can be
retried. Consequences:

- database size grows with uploads;
- every backup copies learner files;
- there is no object storage, virus scanning, or content-addressed dedupe across
  accounts.

### 2.4 No background jobs

Extraction and embedding run inside the request (`maxDuration = 60` on relevant
routes). Large PDFs can hit platform timeouts. There is no queue, retry worker, or
progress streaming beyond the document status.

### 2.5 Session and event cleanup

Expired sessions are ignored but not purged by a scheduled job. `ai_events` grows
without retention. A long-running deployment needs housekeeping.

---

## 3. Accounts and access

- **No email delivery.** `/forgot-password` and `/reset-password` explicitly state
  that reset email is not configured. There is **no reset-token endpoint**. A
  user who forgets a password cannot recover the account in this build.
- **No email verification.**
- **No MFA/2FA.**
- **No account deletion or data export.**
- **No admin role, moderation, or support tooling.**
- **In-memory rate limiting.** It resets on restart, is per process, and is not
  shared across instances.
- **No CSRF token.** Protection relies on `SameSite=Lax` cookies plus an
  `Origin`/host check. A stricter token-based scheme is recommended.
- **No account lockout** beyond rate limiting; no breached-password check.
- **Email enumeration on registration** is possible through the "already exists"
  conflict, which is a deliberate usability trade-off.
- **No per-user upload quota** beyond the per-file size cap.

---

## 4. Materials and extraction

- Supported types are **PDF, `.txt`, `.md`, `.markdown`** only. No DOCX, PPTX,
  HTML, EPUB, images, or web clipping.
- **No OCR.** Scanned/image-only PDFs fail with a clear message; they are not
  silently indexed.
- **No table or equation reconstruction.** PDF text order is whatever `unpdf`
  extracts; complex layouts can produce poor reading order.
- **Text files must be UTF-8.** Other encodings are rejected rather than guessed.
- **Page numbers for plain text** are `null` unless the file uses form feeds.
  The app does not invent them.
- **Chunking is heuristic.** Heading detection is conservative; an unusual
  syllabus may produce fewer or differently named topics.
- **Topic extraction is deterministic**, based on headings and syllabus patterns.
  It does not semantically parse a prose syllabus.
- **No manual document editing**, no chunk editor, no re-upload with versioning
  (only delete and upload again).
- **Duplicate detection is per owner and exact-byte**, not semantic.

---

## 5. AI and answer quality

- **Local embeddings are lexical, not neural.** They capture token overlap
  (unigrams and bigrams, feature-hashed) and will miss paraphrase and synonymy
  that a neural model handles. The UI labels them as non-neural. Bigrams are
  used for embeddings only, not for the lexical coverage term in hybrid scoring.
- **Deterministic questions are template-based.** They are grounded and
  citation-valid, but less varied and less pedagogically rich than a strong LLM
  would produce. Distractors are drawn from source sentences and can be
  predictable.
- **Deterministic short-answer grading measures concept coverage**, not argument
  quality or semantic correctness. An answer can mention the right words and
  still be wrong; an answer can be correct in different words and be marked
  partial.
- **Question count per topic is small** (max 3 per topic, max 3 topics per quiz).
- **No adaptive item selection** based on item difficulty statistics.
- **Retrieval is single-shot.** There is no query rewriting, reranking model,
  multi-query expansion, or iterative retrieval.
- **Assistant answers are limited to retrieved sentences**; with a weak
  embedder, some answerable questions may abstain.
- **Thresholds are hand-set** (`0.15` score, `240` evidence chars, top-6 for
  BUDDY, top-8 for diagnostics). They were chosen for a deterministic fallback
  and are not empirically tuned.
- **Gemini output variability** is unverified; the schema/citation guards are
  designed to reject bad output, not to guarantee good output.
- **Provider change requires re-indexing.** Documents embedded with a different
  model/dimension are excluded from retrieval and must be reprocessed.
- **No content moderation** of uploaded material beyond type/size checks.
- **No multilingual support**; normalisation and stopwords are English-oriented.

---

## 6. Scoring, mastery and planning

- **Mastery bands (0–49 / 50–79 / 80–100) are provisional**, not validated
  educational cut scores.
- **Mastery is demonstrated performance on generated questions**, not ability or
  syllabus coverage.
- **Evidence minimum is small** (2 answers, 3 marks, 2 distinct questions) — enough
  to avoid one-question conclusions, not enough for statistical confidence.
- **Difficulty weights (1.0 / 1.25 / 1.5)** are a design choice, not calibrated.
- **All submitted history is aggregated.** There is no time decay, recency
  weighting, or forgetting curve.
- **Mastery can move for reasons other than learning** (question difficulty mix,
  generator changes, partial credit rules).
- **No partial credit for MCQ.**
- **Short-answer half-mark rounding** can produce small artefacts.
- **The planner is a heuristic**, not an optimiser. It greedily ranks by priority
  and fills the budget; it does not solve an optimal schedule.
- **Horizon is capped at 14 days and tasks at 12.** An exam months away is planned
  as if it were two weeks away.
- **No calendar integration**, no per-day scheduling, no reminders. Tasks have a
  duration and an order, not a date/time slot.
- **Prerequisite hypotheses are dormant in practice.** The schema and report
  support explicit dependencies, but this build has **no UI or API to create
  them**, and no automatic inference. In the seeded demo none exist, so that
  section is normally empty.
- **Plan adaptation only runs when an active plan exists** and the exam is in the
  future.
- **Completed-task history** is preserved in the superseded plan; there is no
  cross-version completion transfer or streak analytics.

---

## 7. Product and UX

- **No notifications or email digests.**
- **No spaced-repetition scheduler.**
- **No collaborative or classroom features**, no sharing, no teacher view.
- **No import from other tools**, no LMS integration.
- **No offline/PWA support.**
- **No i18n/localisation**; UI copy is English and dates are formatted `en-GB`
  in UTC.
- **No user-facing audit trail** of AI events.
- **Report route uses the subject ID** (`/reports/[reportId]` where `reportId` is
  a subject). This is intentional and documented, but the parameter name is
  broader than its meaning.
- **Some pages render large tables without pagination**; acceptable for demo
  volumes, not for hundreds of attempts.
- **The demo is a single shared account.** A visitor can add practice attempts;
  the shared plan and baseline are protected from mutation, but practice attempts
  by different visitors are visible to later visitors because they share the same
  owner. Do not enter private data into the demo.
- **No topic editing or deletion.** Topics are produced by extraction or by the
  manual create flow; there is no rename, move or delete endpoint.
- **The topic map is capped at 80 topics** from one extraction. Larger
  syllabuses are truncated deterministically.
- **Only a minimal brand asset set.** A single SVG favicon exists; there is no
  full icon set, social card or Open Graph image.
- **Voice live captions are best-effort.** Word highlighting depends on
  `onboundary` support; browsers that omit it show the full reply with an
  indeterminate progress bar. No automated test exercises this.

---

## 8. Operational and platform

- **Node >= 22.5 is required** because of `node:sqlite`. Older Node will fail at
  startup.
- **Not tested on Linux/macOS in this session**; verification was on Windows with
  Node v26.5.1. The code uses portable Node APIs, but cross-platform CI was not
  run.
- **No CI pipeline** is configured in the repository.
- **No Dockerfile.**
- **No structured logging or tracing.** Errors are returned to the client and
  provider outcomes are recorded in `ai_events`, but there is no APM.
- **No health check beyond a basic DB query.**
- **No graceful shutdown hooks** for the database handle.
- **No automated backups.**
- **No secret rotation story.**
- **No load, soak, or concurrency testing.** `DatabaseSync` is synchronous;
  heavy concurrent uploads would block the event loop.
- **No CI or deployment pipeline.** The source is committed and pushed to
  `https://github.com/dilleshwar-17/GAPFINDER_AI` on branch `main`, but no CI
  workflow is configured and no hosting provider was connected.

---

## 9. Legal and content

- `/privacy` and `/terms` are plain-language descriptions of this build, not legal
  advice, and do not constitute GDPR/DPA compliance.
- No data-processing agreement, cookie consent banner (none is needed because no
  analytics cookies are used), or records-of-processing exist.
- Seeded demo content is original text written for this project.
- No license file is included; reuse terms are unspecified.

---

## 10. What would be done next

1. Provision Postgres + pgvector and add a database adapter; migrate embeddings
   to a vector column with an ANN index.
2. Add object storage for uploads and a background worker for extraction and
   embedding.
3. Configure a Gemini key and run a live evaluation of generation, citation
   validity, abstention and grading quality; record the results.
4. Add email delivery and single-use, expiring password-reset tokens.
5. Add CSRF tokens, a shared rate-limit store, MFA, and account deletion/export.
6. Add Playwright end-to-end and axe accessibility tests in CI.
7. Add a per-day scheduler, reminders, and spacing to the planner.
8. Calibrate mastery bands and difficulty weights with real learner data.
9. Add explicit prerequisite authoring so the hypothesis feature is usable.
10. Deploy to an approved host with durable storage, secrets management, backups
    and monitoring.
