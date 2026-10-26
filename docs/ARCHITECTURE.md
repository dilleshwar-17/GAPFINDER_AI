# Architecture

## Overview

GapFinder AI is a server-rendered Next.js 16 App Router application with a
relational persistence layer. There is no separate backend service: React Server
Components read through typed service modules, and mutations go through Route
Handlers (`src/app/api/**/route.ts`) called from small client components.

The design keeps all trust decisions on the server. A page or route handler
resolves the session, then calls a service that enforces ownership in SQL. The
browser never receives another learner's data and never receives an answer key
before submission.

```
Browser
  │  HTML (RSC) + small client islands
  ▼
Next.js App Router  ──────────────►  Service layer  ──────►  SQLite (node:sqlite)
  │  page.tsx / route.ts               src/lib/services        schema in src/lib/db
  │                                    domain rules
  ▼
Server-only configuration (env.ts)
  ├── AI provider (Gemini) or deterministic fallback
  └── Auth (scrypt, hashed session tokens)
```

See [`diagrams/system-architecture.mmd`](diagrams/system-architecture.mmd) and
[`diagrams/ai-workflow.mmd`](diagrams/ai-workflow.mmd) for rendered sources.

## Layers

### 1. Presentation — `src/app`

Three route groups:

- `(public)` — landing, auth, legal and demo-access pages with a marketing
  chrome. Signed-in visitors are redirected away from auth pages.
- `(app)` — the authenticated workspace. `layout.tsx` calls
  `requirePageUser()`, renders the sidebar/mobile navigation and the shared-demo
  banner.
- `onboarding` — a focused first-run wizard outside the main shell.

`src/proxy.ts` performs a cheap first-pass redirect for protected prefixes when
no session cookie is present. It is **not** the security boundary: the layout,
pages, route handlers and services re-check the real session and ownership.

### 2. API — `src/app/api`

Route handlers are thin. Each one:

1. calls `requireSameOrigin(request)` for mutations,
2. resolves `requireUser()` (cryptographic session lookup),
3. validates input with a Zod schema,
4. delegates to a service,
5. returns a typed JSON envelope or a mapped `AppError` via `handleRoute`.

`src/lib/http.ts` centralises `jsonOk`, `readJson`, error mapping, and
`requireSameOrigin`. `src/lib/errors.ts` defines `AppError` with a status, a
stable machine code, a safe message, optional details, and helpers such as
`notFound`, `conflict`, `validationError`.

### 3. Services — `src/lib/services`

Services own business transactions and authorization:

- `auth.ts` — registration, authentication, password change, profile.
- `session.ts` (in `lib/auth`) — token creation, hashing, lookup, revocation.
- `subjects.ts`, `documents.ts`, `topics.ts`, `questions.ts` — content CRUD with
  owner scoping.
- `assessment.ts` — diagnostic start, quiz view, drafts, submission, attempt
  history.
- `gaps.ts` — mastery refresh and gap report generation.
- `plans.ts` — plan creation, versioning, task completion, adaptive refresh.
- `assistant.ts` — retrieval-augmented explanations.
- `progress.ts`, `preferences.ts` — aggregate views and settings.
- `demo.ts` — idempotent demo provisioning and seeding.
- `guards.ts` — `assertWritableAccount`, which blocks shared-demo writes.

Almost every read takes `ownerId` and filters on it in SQL. Cross-user access
therefore fails as **not found** rather than forbidden, which avoids confirming
that another learner's resource exists.

### 4. Domain — `src/lib/domain`

Pure, testable rules with no I/O:

- `chunking.ts` — heading-aware chunking and text hashing.
- `scoring.ts` — marks assignment and deterministic scoring helpers.
- `mastery.ts` — bands, evidence thresholds, aggregation.
- `planner.ts` — priority weights, task limits, horizon calculation.
- `citations.ts` — citation label generation, resolution and validation.
- `question-hash.ts`, `numbers.ts`, `labels.ts`, `types.ts`.

### 5. Data access — `src/lib/db`

`index.ts` wraps `node:sqlite`'s `DatabaseSync` with:

- one connection per process,
- `PRAGMA foreign_keys = ON`,
- schema application on first use,
- `db.get`, `db.all`, `db.run`, and a `transaction(fn)` helper,
- `newId()` (UUID), `nowIso()`, and `resetDatabase()` for tests.

Embeddings are stored as `BLOB` (raw `Float32Array` bytes) alongside
`embedding_model` and `embedding_dim`. Retrieval only compares chunks whose model
and dimension match the *current* configuration, so a configuration change never
silently mixes incompatible vectors.

## Data model

```
users ──┬── sessions
        ├── subjects ──┬── documents ── document_chunks ── topic_sources
        │              ├── topics ── topic_dependencies
        │              └── questions ── question_sources
        ├── quiz_attempts ── answers
        ├── mastery_snapshots
        ├── revision_plans ── revision_tasks
        ├── user_preferences
        └── ai_events
```

Key constraints:

- Every content table carries `owner_id`; foreign keys cascade on delete.
- `topics` is unique per `(subject_id, parent_id, name)`.
- `questions` is unique per `(subject_id, prompt_hash)` to prevent duplicates.
- `answers` is unique per `(attempt_id, question_id)`; submissions are also
  guarded by attempt status.
- `revision_plans` is unique per `(subject_id, version)`.
- `mastery_snapshots.classification` is constrained to
  `not_assessed | weak | developing | strong`.

`file_data` retains the original upload so a failed extraction can be retried
without asking the learner to re-upload.

## Request lifecycle

### Upload

1. Client posts `multipart/form-data` to `POST /api/documents`.
2. Handler checks origin, session, subject ownership, MIME/size and duplicates.
3. `documents.ts` inserts a `processing` row, extracts text (`unpdf` or UTF-8),
   normalises it, and chunks it.
4. Chunks are embedded with the configured model and written transactionally;
   the document becomes `ready` with page/char/chunk counts.
5. On extraction or embedding failure the row becomes `failed` with a safe
   message. The file is retained for a retry.

### Diagnostic

1. `POST /api/assessments` selects leaf topics and calls `retrieveEvidence` per
   topic.
2. If evidence is insufficient, the topic is skipped and reported; if no topic
   yields evidence the request fails with `INSUFFICIENT_EVIDENCE`.
3. Questions are generated (Gemini JSON or deterministic templates), validated,
   deduplicated by prompt hash, and persisted with `question_sources`.
4. `getQuizView` returns prompts, options and source excerpts but **no** answer
   key while the attempt is `in_progress`.
5. `submitAttempt` validates completeness, scores every answer deterministically,
   stores `answers`, marks the attempt `submitted`, refreshes mastery snapshots,
   and refreshes the active plan.

### Plan refresh

`refreshActivePlanAfterAssessment` supersedes the active plan and creates a new
version from the latest mastery, preserving the old plan (and its completed
tasks) as history. The declared time budget and exam date are reused.

## Rendering and state

- Pages are `force-dynamic` where they read session-scoped data.
- Interactive flows (upload, diagnostic runner, assistant, settings, plan tasks)
  are client components using `src/lib/client/api.ts`, which sends same-origin
  JSON and surfaces server error codes.
- Documents with a draft are resumable through `quiz_attempts.draft_json`.
- Markdown from the assistant is rendered by a deliberately small
  `MarkdownLite` renderer (headings, lists, paragraphs, inline citations) rather
  than raw HTML.

## Security boundaries

| Boundary | Mechanism |
| --- | --- |
| Authentication | scrypt password hashes; 256-bit random session tokens stored as SHA-256 hashes |
| Session | `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS, TTL expiry, delete on logout |
| CSRF-style | `Origin`/`Sec-Fetch-Site` check on every mutation |
| Authorization | `owner_id` filters in SQL; not-found responses for foreign IDs |
| Upload | extension/MIME allow-list, size cap, NUL-byte and UTF-8 checks |
| Prompt injection | retrieved text is untrusted data; JSON output validated against a schema; citations re-checked |
| Demo | shared account flagged `is_demo`; writes blocked in services via `assertWritableAccount` |
| Rate limits | in-memory fixed windows for login, registration, demo entry and assistant |

Details and threat notes are in [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md).

## Configuration

`src/lib/env.ts` is the single server-side configuration module. It chooses:

- embeddings: Gemini when `GEMINI_API_KEY` is present and
  `EMBEDDING_PROVIDER != local`, otherwise `gapfinder-hash-v1`;
- LLM: Gemini when configured, otherwise `deterministic-fallback`;
- limits: upload size, retrieval top-K, score threshold, evidence minimum,
  session TTL, demo enablement.

Nothing here uses `NEXT_PUBLIC_`, so no secret or server default is shipped to
the browser.

## Why SQLite, and how to replace it

`node:sqlite` makes the project runnable with zero infrastructure and keeps the
schema relational. The schema avoids SQLite-only constructs, so a Postgres
adapter can implement the same `db.get/all/run/transaction` surface. For
production at scale, replace `src/lib/db/index.ts` with a Postgres/pgvector
adapter, move embeddings to a `vector` column, and add an ANN index. See
[`DEPLOYMENT.md`](DEPLOYMENT.md) and [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).

## Error handling

- `AppError` carries a status and code; `handleRoute` serialises it.
- Server pages catch expected missing-resource errors with
  `pageNotFoundIfMissing` and render the custom 404.
- `app/error.tsx` and `app/global-error.tsx` provide recoverable and fatal
  boundaries; `app/not-found.tsx` is the custom 404.
- Provider failures surface as `502 PROVIDER_UNAVAILABLE` rather than silently
  falling back mid-request, so a learner knows retrieval could not run.
  Deterministic fallbacks are chosen at *generation time* when no key is
  configured, not after a provider error.
