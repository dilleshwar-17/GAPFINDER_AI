# Deployment

This document records the local setup, Supabase Auth configuration, Vercel
deployment prerequisites, and the remaining release blockers.

**Status: Production deployment active; application not healthy.** On
2026-10-26, commit `0866985` was deployed to Production at
`https://gapfinder-ai-dilleshwar-rao.vercel.app` as deployment
`dpl_CxUmknxa9hA6VH8cvaaYrKkHtgCB`. Vercel reports it Ready and its alias is
assigned to this deployment. The homepage and login returned HTTP 200 and an
unauthenticated dashboard request redirected to login. The health endpoint
reports a database error, so the site is not fully working like local
development.

The same working tree was also deployed to Preview at
`https://gapfinder-qcvgrogr0-dilleshwar-17s-projects.vercel.app`. Vercel
reported the deployment Ready; the homepage, login, and signup returned HTTP
200, and an unauthenticated dashboard request redirected to login. The health
endpoint reported a database error, so this deployment is not verified as a
working data-backed application.

This Preview is protected by Vercel Authentication. Do not treat route
availability as proof that Supabase login, learner data persistence, uploads,
or the student workflow work end-to-end. A GitHub-triggered Production
deployment from `main` commit `2907ca9` was observed and rolled back with
explicit approval. After a further explicit Production-deployment approval,
commit `0866985` was directly deployed and assigned to the public Production
alias. The alias was confirmed with `vercel alias ls`.

---

## 1. Local development

### Prerequisites

- Node.js **>= 22.5** (verified on v26.5.1). `node:sqlite` is built in.
- npm (verified on 12.0.2).
- Supabase is optional for local deterministic development. Without Supabase
  Auth variables, development uses the existing local SQLite auth path.
- No AI API key is required for deterministic local mode.

### Run

```bash
npm install
# optional: cp .env.example .env.local   (Windows: copy .env.example .env.local)
npm run dev
```

Open `http://localhost:3000`. The SQLite file is created automatically at
`data/gapfinder.db` (or `DATABASE_PATH`).
To exercise Supabase Auth locally, configure `NEXT_PUBLIC_SUPABASE_URL`,
either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` in `.env.local`.

### Useful commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
npm run db:reset
```

`npm run db:reset` deletes the configured database file. Stop the server first.

---

## 2. Production build and serve

```bash
npm ci
npm run build
npm start            # default port 3000
```

To serve on another port:

```powershell
# PowerShell
$env:PORT="3100"
npm start
```

```bash
# POSIX
PORT=3100 npm start
```

The build uses Next.js 16 with Turbopack. Server-only modules (`unpdf`,
`node:sqlite`) are kept out of the client bundle; `next.config.ts` marks `unpdf`
as a server external package.

---

## 3. Environment

Copy `.env.example` and set values. The important ones:

| Variable | Default | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | unset | Supabase Auth | Project URL; public configuration |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | unset | Supabase Auth | Preferred public key; never a service-role key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | unset | Supabase Auth | Legacy public key; used when publishable key is unset |
| `NEXT_PUBLIC_SITE_URL` | localhost URL | production auth links | Canonical HTTPS site origin |
| `SUPABASE_DEMO_EMAIL` | unset | hosted demo | Server-only demo identity |
| `SUPABASE_DEMO_PASSWORD` | unset | hosted demo | Server-only secret |
| `DATABASE_PATH` | `data/gapfinder.db` | local | Local SQLite only; not durable/shared on Vercel |
| `GEMINI_API_KEY` | unset | no | Without it, deterministic fallbacks are used |
| `GEMINI_MODEL` | `gemini-2.5-flash` | no | |
| `EMBEDDING_PROVIDER` | auto | no | `local` forces offline embeddings |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | no | |
| `EMBEDDING_DIMENSIONS` | `768` | no | 128–3072 |
| `LOCAL_EMBEDDING_DIMENSIONS` | `512` | no | 64–2048 |
| `MAX_UPLOAD_MB` | `8` | no | 1–25 |
| `RETRIEVAL_TOP_K` | `6` | no | 1–20 |
| `RETRIEVAL_MIN_SCORE` | `0.15` | no | 0–1 |
| `MIN_EVIDENCE_CHARS` | `240` | no | 40–4000 |
| `SESSION_TTL_DAYS` | `7` | no | 1–30 |
| `DISABLE_DEMO` | `0` | no | `1` disables demo access |
| `DEMO_EMAIL` | `demo@gapfinder.local` | no | Reserved address |

**Never commit `.env.local` or a real key.** `.gitignore` excludes `.env`,
`.env.local`, `.env.*.local`, `data/`, `.next/`, and `.vercel/`.

In production, `src/proxy.ts` fails closed if either Supabase Auth public
configuration value is missing. Auth callback URLs require
`NEXT_PUBLIC_SITE_URL` with HTTPS in production. Supabase Auth must allow the
exact `/auth/callback` path for the configured site and preview origins, and
email confirmation/recovery delivery must be enabled for those flows.

The sign-in, sign-up, callback, sign-out, password-change, and password-recovery
paths use Supabase Auth when configured. App profile and learner records still
use the repository's SQLite database. The added `auth_user_id` mapping is a
non-destructive SQLite schema change; it is not a Postgres migration or a data
transfer.

## 4. Preview verification record

The following commands were run against the exact Preview URL above:

```powershell
vercel deploy --yes
vercel inspect https://gapfinder-qcvgrogr0-dilleshwar-17s-projects.vercel.app
vercel curl https://gapfinder-qcvgrogr0-dilleshwar-17s-projects.vercel.app/ -I
vercel curl https://gapfinder-qcvgrogr0-dilleshwar-17s-projects.vercel.app/login -I
vercel curl https://gapfinder-qcvgrogr0-dilleshwar-17s-projects.vercel.app/signup -I
vercel curl https://gapfinder-qcvgrogr0-dilleshwar-17s-projects.vercel.app/dashboard -I
vercel curl https://gapfinder-qcvgrogr0-dilleshwar-17s-projects.vercel.app/api/health
```

`vercel inspect` reported target `preview` and status `Ready`; `/`, `/login`,
and `/signup` returned HTTP 200. An unauthenticated `/dashboard` request
returned HTTP 307 to the login page. A prior Preview request had returned 500
because `AuthSessionMissingError` was thrown as a server failure; missing
sessions are now treated as anonymous while other Supabase errors still
surface. `/api/health` returned `status: degraded` and `database: error`. Its
handler suppresses the underlying SQLite exception, so the specific runtime
cause is not established by this check. No Supabase credentials were submitted
and no mutating student-workflow actions were run. Vercel Preview readiness
means the deployment built and was assigned; it does not mean application
health or production readiness.

## 5. Production deployment and rollback records

The supplied build log showed a Production deployment from GitHub `main`
commit `2907ca9`. Vercel inspection showed it had moved the production alias.
Following explicit approval, it was rolled back with:

```powershell
vercel rollback https://gapfinder-91wkw35oa-dilleshwar-17s-projects.vercel.app --yes
vercel inspect https://gapfinder-ai-dilleshwar-rao.vercel.app
```

No production database was changed by the rollback. Later, with explicit
approval, local commit `0866985` was directly deployed to Production:

```powershell
vercel deploy --prod --yes
vercel alias set https://gapfinder-q8i82p754-dilleshwar-17s-projects.vercel.app gapfinder-ai-dilleshwar-rao.vercel.app
vercel alias ls
```

Vercel reports deployment `dpl_CxUmknxa9hA6VH8cvaaYrKkHtgCB` as Ready and the
alias list maps the public Production domain to that deployment. Its health
endpoint still reports `database: error`; this deployment does not make the
current SQLite data layer durable.

If you switch embedding providers, existing chunks are excluded from retrieval
(model/dimension mismatch). Re-process the documents (document detail →
**Retry processing**) or reset and re-upload.

---

## 6. Verification results for this build

Environment: Windows, Node **v26.5.1**, npm **12.0.2**, Next.js **16.4.3**,
React **19.3.1**, Vitest **5.0.5**.

| Command | Result |
| --- | --- |
| `npm run lint` | **Passed** — no lint errors |
| `npm run typecheck` | **Passed** — no TypeScript errors |
| `npm test` | **Passed** — 11 test files, **138 tests** |
| Local `npm run build` | **Blocked** — Windows `EPERM` unlinking `.next/static` while a local Next server was running |
| Vercel Preview build | **Passed** — latest deployment Ready |
| Vercel Production build | **Passed** — deployment `dpl_CxUmknxa9hA6VH8cvaaYrKkHtgCB` Ready |
| Production homepage and login | **Passed, limited** — HTTP 200 |
| Production unauthenticated dashboard | **Passed, limited** — HTTP 307 redirect to login |
| Production health | **Failed** — `/api/health` reports `database: error` |
| `npm run smoke` | **Not run** for the current auth/theme changes |
| Live Supabase Auth flow | **Not tested** — no credentials submitted; only the unauthenticated guard was checked |
| Vercel Preview health | **Failed** — `/api/health` reports a SQLite database error |

The current unit suite uses an in-memory SQLite database and does not contact
Supabase or Gemini. The blue glass theme was visually inspected in the
integrated browser at a desktop viewport; a separate responsive/mobile visual
test was not run.

### Exact smoke procedure

```powershell
# stop anything already bound to 3100 first
$env:DATABASE_PATH="data/smoke-final.db"
$env:PORT="3100"
$env:DISABLE_DEMO="0"
npm start
```

In a second shell:

```powershell
$env:BASE_URL="http://localhost:3100"
npm run smoke
```

The database file was deleted before the run, so this was a **fresh database**
with no prior seeded rows. Recorded summary:

```
Smoke testing http://localhost:3100
... 49 checks ...
49 passed, 0 failed
```

One check only runs on a fresh workspace: once the demo account already has a
resumable diagnostic, the suite reuses it and reports **48** checks instead of
49. Both totals must have zero failures; re-verified after the BUDDY/theme work.

The 49 checks cover:

- health, DB query, demo enablement;
- landing page and all public pages;
- unauthenticated redirects and API rejection;
- cross-origin write rejection (`403`);
- demo session issuance and cookie;
- dashboard/subjects/reports rendering and the demo banner;
- subject discovery and every seeded dynamic page;
- topic → learn page;
- grounded BUDDY request, resolved citations, authorised document IDs,
  invalid-input rejection;
- materials → document detail;
- diagnostic results and runner;
- demo write blocking;
- logout and stale-session rejection;
- custom 404.

### What was not run

- No browser automation (Playwright/Puppeteer not installed).
- No live Gemini/RAG request (no provider-backed call was made).
- No end-to-end Supabase login, upload, or learner workflow on Preview.
- No cross-platform (Linux/macOS) run.
- No load or concurrency test.

---

## 7. Deployment blockers (current)

### 7.1 Preview deployment does not establish production readiness

A Preview and a Production deployment have both been built. Public page status
and unauthenticated redirects were checked, but both health checks report a
SQLite database error. Production has not been verified end-to-end for login,
uploads, persistence, or the student workflow.

### 7.2 SQLite is not durable on serverless

`node:sqlite` writes a local file. On Vercel (or any ephemeral/serverless host)
the filesystem is not durable or shared, so sessions, uploads and learner data
would disappear or diverge between instances. This build is therefore suitable
for a **single long-lived Node process with a persistent disk**, not for
serverless.

### 7.3 No Supabase Postgres application-data adapter

Supabase Auth is integrated, but the application's relational data path remains
synchronous SQLite. No Postgres adapter, migration runner, pgvector index, or
Supabase Storage integration exists. Auth-only configuration does **not** make
student records durable on Vercel.

### 7.4 Supabase email and account migration are unverified

Password reset and email confirmation require Supabase Auth email delivery and
redirect allow-list configuration; neither was live-tested. Existing local
scrypt password hashes are not importable as Supabase passwords. A migration
must preserve learner data, map verified identities, and require existing users
to set/reset a Supabase password. No production database or account records
were changed here.

---

## 8. Vercel setup (after the data-layer blocker is resolved)

Vercel automatically detects this Next.js App Router project; no custom
`vercel.json` is currently required. Use the repository root, npm, and the
existing `npm run build` script. Keep server routes on the Node.js runtime;
the app depends on `node:sqlite` and PDF processing, and does not target Edge
runtime.

Before connecting the production domain:

1. Provision the durable application database and file-storage migration; do
   not rely on `DATABASE_PATH` on Vercel.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, either public key variable, and
   environment-specific `NEXT_PUBLIC_SITE_URL` in Vercel. Never expose a
   service-role key through `NEXT_PUBLIC_`.
3. Add the production and preview `/auth/callback` origins to Supabase Auth's
   redirect allow list; configure email confirmation and password recovery
   delivery.
4. Set optional AI and demo secrets only in Vercel Environment Variables,
   scoped to the intended environments.
5. Run lint, typecheck, tests, and a production build in CI; verify sign-up,
   confirmation, sign-in, sign-out, reset, ownership isolation, upload,
   extraction, retrieval, and citations against the real services on a preview
   deployment.
6. Promote only after persistent data, storage, backups, monitoring, and
   rollback procedures are in place.

These are deployment instructions, not evidence of a completed deployment.

## 9. Recommended production architecture (not implemented here)

```
CDN / TLS
   │
Next.js (Node runtime, >= 22.5)
   ├── Postgres + pgvector   (users, sessions, content, embeddings)
   ├── Object storage        (original uploads)
   ├── Queue/worker          (extraction + embedding)
   ├── Email provider        (verification, reset)
   └── Shared rate-limit store (Redis)
```

Required code work:

1. Replace `src/lib/db/index.ts` with a Postgres adapter exposing the same
   `get/all/run/transaction` surface.
2. Move `embedding BLOB` to `vector(N)` and add an HNSW/IVF index; update
   `retrieve.ts` to use SQL similarity rather than an in-process scan.
3. Move `documents.file_data` to object storage; store a key instead.
4. Add a worker for extraction/embedding and a document status poller.
5. Add CSRF tokens, a shared rate limiter, and secret management.
6. Add email verification and single-use reset tokens.
7. Add backups, retention, monitoring, and alerting.

---

## 10. Single-server deployment (works with current data layer)

If you have a VM or container with a persistent disk:

1. Install Node >= 22.5.
2. `npm ci && npm run build`.
3. Set `DATABASE_PATH` to a path on the persistent volume (outside the build
   directory).
4. Run `npm start` behind a reverse proxy that terminates TLS and sets
   `X-Forwarded-Proto: https` and `X-Forwarded-Host`.
5. Keep the process alive with a supervisor (systemd, PM2, container restart
   policy).
6. Back up the SQLite file regularly (stop writes or use SQLite's backup API).
7. Set `DISABLE_DEMO=1` unless you intentionally want a shared demo.
8. Set `GEMINI_API_KEY` only if you want neural AI; verify with a test upload and
   diagnostic afterward.

Because cookies are marked `Secure` when `X-Forwarded-Proto: https`, running
behind TLS is important for production.

---

## 11. Deployment checklist

- [ ] Node >= 22.5 on the host
- [ ] `DATABASE_PATH` on a durable, writable volume
- [ ] `npm ci && npm run build` succeeds
- [ ] `npm run lint`, `npm run typecheck`, `npm test` pass
- [ ] `DATABASE_PATH` points to an empty/fresh DB (or a migrated one)
- [ ] TLS configured; forwarded proto/host headers set
- [ ] `GEMINI_API_KEY` set (or deterministic mode accepted and disclosed)
- [ ] `DISABLE_DEMO=1` for a private deployment
- [ ] Backups scheduled
- [ ] Logs monitored; no secret or document text logged
- [ ] Health endpoint reachable
- [ ] Smoke suite run against the deployed `BASE_URL`
- [ ] Limitations and privacy pages reviewed for the deployment's actual behaviour

---

## 12. Rollback

- Application: redeploy the previous build artifact.
- Database: restore the last SQLite backup (or Postgres snapshot). There are no
  migrations beyond the idempotent `CREATE TABLE IF NOT EXISTS` schema, so a
  schema rollback may require restoring the database as well.
- Demo: `npm run db:reset` on a non-production instance re-provisions on next
  demo entry.
