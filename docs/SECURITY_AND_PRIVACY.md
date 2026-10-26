# Security and Privacy

GapFinder stores learner material (uploads), assessment answers, and account
data. The design gives each record an owner and makes the server the only trust
boundary. This document states what is implemented, how it was checked, and what
is **not** covered.

---

## 1. Authentication

When `NEXT_PUBLIC_SUPABASE_URL` and either
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set,
sign-in, registration, password updates, and recovery use Supabase Auth through
the SSR client. Password storage, confirmation, and reset tokens are managed by
Supabase; this repository does not receive or log plaintext credentials beyond
the submitted auth request.

With Supabase unconfigured in development/tests, the legacy local path remains
available: it stores scrypt hashes (`N=16384, r=8, p=1`, 64-byte key, 16-byte
random salt) and uses `timingSafeEqual`. Production proxy requests fail closed
when Supabase Auth configuration is missing.

Existing local accounts are not automatically imported into Supabase Auth.
`syncSupabaseUser` links a confirmed Supabase identity to a same-email local
profile while preserving its application owner id; legacy scrypt hashes are
not reusable as Supabase credentials, so existing users need to set/reset a
Supabase password as part of a separately planned migration.

### Sessions

- Supabase mode uses the SSR package's cookie adapter and refreshes provider
  sessions in `src/proxy.ts`; server code validates identity with
  `supabase.auth.getUser()`.
- Local fallback mode uses a 256-bit random token; only its SHA-256 hash is
  stored in `sessions.token_hash`. The `gf_session` cookie is HttpOnly,
  SameSite=Lax, and Secure on HTTPS.
- `SESSION_TTL_DAYS` applies to local sessions only. Supabase token lifetime is
  configured in the Supabase project.
- Supabase sign-out calls `auth.signOut({ scope: "local" })`. Local fallback
  sign-out deletes the token-hash row and clears `gf_session`.

### Route protection

`src/proxy.ts` refreshes and verifies the Supabase user when Supabase Auth is
configured, then redirects unauthenticated protected-page requests. Local
development without Supabase uses the legacy cookie as a fast redirect check.
This is not the authorization boundary: `requireUser`/`requirePageUser` and
service ownership checks run server-side too. A forged cookie alone grants no
access.

## 2. Authorization and ownership

Every content table has `owner_id`. Services take `ownerId` from the verified
session and filter in SQL. Examples:

- documents, chunks, subjects, topics, questions, attempts and plans are read
  under `owner_id = ?`;
- questions and answers are joined through `attempt_id` and `owner_id`;
- retrieval candidates are selected with `c.owner_id = ? AND c.subject_id = ?`
  before any text is scored;
- citation resolution only accepts chunks from that same retrieval set.

Cross-user access is reported as **404 Not Found** rather than 403, so a caller
cannot confirm that another learner's resource exists. This was tested with a
second account and an independent service-level fixture
(`tests/ownership.test.ts`, `tests/workflow.test.ts`).

Foreign keys use `ON DELETE CASCADE` so deleting a user or subject cannot leave
orphaned rows that might later be mis-associated.

## 3. Cross-site request protection

Every mutating route handler calls `requireSameOrigin(request)`:

- if an `Origin` header is present, its host must match the request host
  (`x-forwarded-host` or `host`);
- a malformed origin is rejected with `403`;
- non-browser clients that send no `Origin` are allowed, because they must still
  present a valid session cookie (and, for demo entry, pass rate limits).

Session cookies are `SameSite=Lax`, so they are not attached to cross-site
`POST`/`PATCH`/`DELETE` requests. Together these block classic CSRF. This was
verified by a smoke test that sends a cross-origin write and expects `403`.

This is a host-comparison check, not a full token-based CSRF system. A hardened
production deployment should add a per-session CSRF token and a strict
`Origin` allow-list.

## 4. Rate limiting

`src/lib/rate-limit.ts` is an in-process fixed-window limiter:

| Action | Limit |
| --- | --- |
| Login | 10 attempts / 15 min per IP + email |
| Registration | 8 / 15 min per IP |
| Demo entry | 6 / 10 min per IP |
| Assistant | per-route limit (see the route) |

Buckets are pruned periodically. This bounds abuse on a single Node process.
**It is not shared across instances**; a multi-instance deployment needs Redis or
an equivalent shared store. This is listed in the limitations.

## 5. Upload safety

- Extension/MIME allow-list: PDF, `.txt`, `.md`, `.markdown`.
- Size ceiling `MAX_UPLOAD_MB` (default 8 MB, max 25).
- PDFs must start with `%PDF-`; text files must be valid UTF-8 and must not
  contain NUL bytes in the first 4096 bytes.
- Text extraction happens server-side; uploaded files are never served as static
  assets and never executed.
- The original bytes are retained in `documents.file_data` so a failed
  extraction can be retried. They are **not** encrypted at rest by the
  application (see limitations).
- Duplicate detection uses a per-owner SHA-256 of the bytes.
- Corrupt, encrypted and image-only PDFs fail with a clear message and a `failed`
  row rather than an empty index.

## 6. AI-specific safety

- Retrieved passages are inserted inside `<passage>` tags and the system
  instruction explicitly says to treat them as untrusted data, never as
  instructions.
- Model output is requested as JSON constrained by a response schema and then
  validated again with Zod.
- Citation labels are resolved only against the exact chunks retrieved for that
  request. Unknown labels invalidate the question or the explanation.
- A model cannot widen its retrieval scope, read another subject, trigger a
  write, or return an answer key before submission.
- The quiz view omits `correct_index` and `expected_answer` while an attempt is
  `in_progress`; the smoke test and workflow tests assert this.
- Provider failures return `502 PROVIDER_UNAVAILABLE` for embeddings, so a
  learner is never shown retrieval results computed from a failed embedding call.
- `ai_events` stores provider/model/status/reason only — no prompts, passages,
  answers or model text.

## 7. Shared demo isolation

- The demo account is a normal row with `users.is_demo = 1`.
- In local mode, its password is a 32-byte random value generated at
  provisioning time, stored only as a scrypt hash, and never printed, logged,
  or returned in an API response. Supabase mode uses the configured
  server-only demo credentials and requires trusted `app_metadata.is_demo`.
- Entry is via `POST /api/auth/demo`: local mode issues a `gf_session`;
  Supabase mode establishes the provider's SSR session.
- Writes are blocked server-side by `assertWritableAccount` for uploads,
  document delete/retry, subject create/update/delete, topic extraction/creation,
  preferences, plans, profile and password.
- Interactive diagnostics and assistant questions are allowed, but demo practice
  submissions skip shared mastery/plan mutation unless an internal seeding flag
  is set. One visitor cannot permanently damage the shared reference data or
  overwrite another visitor's mastery.
- The UI shows a persistent "shared demo" banner and read-only affordances are
  disabled with an explanation.

## 8. Privacy

### What is stored

- account: email, display name, local password hash (a dummy value for
  Supabase-only profiles), Supabase auth user id when linked, demo flag,
  timestamps;
- local sessions: token hash, expiry, timestamps (Supabase sessions use the
  Supabase SSR cookie flow);
- uploads: original bytes, filename, MIME type, size, SHA-256, extracted text and
  chunks;
- learning data: topics, questions (including answer keys), attempts, answers,
  scores, feedback, mastery snapshots, plans and tasks;
- operational: AI event metadata without content.

### What is not collected

- No analytics, advertising, tracking pixels or third-party scripts.
- `NEXT_PUBLIC_` values contain only public Supabase URL/anon-key configuration;
  service-role credentials must never be exposed through them.
- No document text or learner answers are sent to a provider unless a Gemini key
  is configured and generation/evaluation is invoked. Supabase Auth still
  contacts Supabase when configured; with neither provider configured, the
  fallback auth and AI paths run locally.

### Data location and retention

- Data lives in the SQLite file at `DATABASE_PATH` (default
  `data/gapfinder.db`), on the server's filesystem.
- There is no automated retention or deletion policy in this build. Deleting a
  document cascades to its chunks and question-source links. Deleting a user
  cascades to all owned data. There is no self-service "delete my account" flow.
- `npm run db:reset` deletes the local database file.

### Legal pages

`/privacy` and `/terms` describe the actual behaviour of this build, including
its limitations. They are plain-language project pages, not legal advice or a
regulatory compliance programme.

## 9. Error handling and information leakage

- `AppError` exposes a safe message and stable code; unexpected errors become a
  generic `500` without stack traces.
- Server pages map missing resources to the custom 404.
- Auth pages do not reveal whether an email exists during registration beyond
  the unavoidable "already exists" conflict.
- The health endpoint reports status, database reachability, demo enablement and
  runtime mode — not secrets, paths or user counts.

## 10. Verified checks

The existing automated tests and previously executed base-app smoke run include
(the smoke run was not rerun after the Supabase/theme changes):

- unauthenticated `/dashboard` redirects, unauthenticated API returns `401`;
- cross-origin write returns `403`;
- local session cookie is issued on demo entry and login;
- local logout removes the DB session and a stale cookie cannot render dashboard data;
- cross-user reads return 404 for documents, quiz views, gap reports, topic
  context and progress;
- answer key absent from the in-progress quiz payload;
- duplicate submissions rejected with `409`;
- demo subject creation blocked with `403`;
- invalid assistant input rejected with `400`;
- demo citations resolve to seeded documents.

## 11. Not covered (honest gaps)

- **Supabase Auth is not live-verified.** This environment had no project URL,
  public key, configured email provider, or redirect allow-list to test.
- **No durable application database adapter.** Supabase Auth is not Supabase
  Postgres: records, uploads, and embeddings still use local SQLite, which is
  not durable/shared on Vercel.
- **No Supabase Row Level Security policies are present.** Current resource
  isolation depends on authenticated server code and owner-scoped SQL queries.
- **No completed account/data migration.** The local `auth_user_id` field only
  supports linking in the local database; it does not migrate records to hosted
  Postgres or provision/import Supabase users. Existing local users must set or
  reset a Supabase password when a separately planned migration is performed.
- **Email delivery depends on Supabase project configuration.** Recovery and
  confirmation have not been exercised against a live provider.
- **No encryption at rest.** The SQLite file and any backups rely on OS/disk
  encryption.
- **No MFA**, no account lockout beyond rate limiting, no breached-password
  checks.
- **No audit log** of who read what beyond `ai_events` and session rows.
- **No CSRF token** (origin check + SameSite only).
- **No shared rate-limit store** for multi-instance deployments.
- **No PII export/delete workflow** or retention scheduler.
- **No penetration test or third-party security audit** was performed.
- **No production secret manager.** Keys come from environment variables.
- The application logs may contain request errors; it does not intentionally log
  document text, but a hosting platform's own request logging is outside this
  code's control.
