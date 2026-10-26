# Security and Privacy

GapFinder stores learner material (uploads), assessment answers, and account
data. The design gives each record an owner and makes the server the only trust
boundary. This document states what is implemented, how it was checked, and what
is **not** covered.

---

## 1. Authentication

### Passwords

- Hashed with **scrypt** (`N=16384, r=8, p=1`, 64-byte key, 16-byte random salt).
- Stored as `scrypt$N$r$p$saltHex$hashHex`; the parameters are read from the
  stored string on verification, so they can be upgraded later.
- Verified with `timingSafeEqual`.
- Minimum length 8 characters, maximum 200.
- When an email is unknown, login still verifies against a fixed dummy hash, so
  the response time does not trivially reveal whether an account exists.
- Password change requires the current password afterwards, deletes **all**
  sessions for the user, and issues a fresh session for the current browser.
- The shared demo account cannot change its password (and no password is ever
  published anyway).

### Sessions

- 256-bit random token (`randomBytes(32).toString("base64url")`).
- Only a **SHA-256 hash** of the token is stored in `sessions.token_hash`.
- Lookup requires a hash match **and** `expires_at > now`.
- Cookie `gf_session` is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when
  the request is HTTPS (including `x-forwarded-proto`).
- TTL defaults to 7 days (`SESSION_TTL_DAYS`, 1–30).
- Logout deletes the row server-side and clears the cookie. A copied stale cookie
  no longer resolves.
- Expired rows are simply not selected; there is no background purge in this
  build (see limitations).

### Route protection

`src/proxy.ts` redirects requests to protected prefixes when the session cookie
is **absent**. This is a UX optimisation, not authorization. Every protected
layout, page, route handler and service re-checks the real session. A forged
cookie value grants nothing.

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
- Its password is a 32-byte random value generated at provisioning time, stored
  only as a scrypt hash, and never printed, logged, or returned in an API
  response.
- Entry is via `POST /api/auth/demo`, which issues a standard server session.
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

- account: email, display name, password hash, demo flag, timestamps;
- sessions: token hash, expiry, timestamps;
- uploads: original bytes, filename, MIME type, size, SHA-256, extracted text and
  chunks;
- learning data: topics, questions (including answer keys), attempts, answers,
  scores, feedback, mastery snapshots, plans and tasks;
- operational: AI event metadata without content.

### What is not collected

- No analytics, advertising, tracking pixels or third-party scripts.
- No `NEXT_PUBLIC_` secrets (there are none); server configuration stays on the
  server.
- No document text or learner answers are sent to a provider unless a Gemini key
  is configured and generation/evaluation is invoked. With no key, everything
  runs locally.

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

The automated suites and smoke run include:

- unauthenticated `/dashboard` redirects, unauthenticated API returns `401`;
- cross-origin write returns `403`;
- session cookie is issued on demo entry and login;
- logout removes the DB session and a stale cookie cannot render dashboard data;
- cross-user reads return 404 for documents, quiz views, gap reports, topic
  context and progress;
- answer key absent from the in-progress quiz payload;
- duplicate submissions rejected with `409`;
- demo subject creation blocked with `403`;
- invalid assistant input rejected with `400`;
- demo citations resolve to seeded documents.

## 11. Not covered (honest gaps)

- **No email delivery or password reset token.** The reset pages say so. A
  production system needs a verified email provider and single-use, expiring
  tokens.
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
