# Deployment

This document records what was actually run for this build, what is required to
run it elsewhere, and the honest deployment blockers.

**Status: not deployed.** No hosting credentials or authorization were available.

---

## 1. Local development

### Prerequisites

- Node.js **>= 22.5** (verified on v26.5.1). `node:sqlite` is built in.
- npm (verified on 12.0.2).
- No Docker, external database, or API key required.

### Run

```bash
npm install
# optional: cp .env.example .env.local   (Windows: copy .env.example .env.local)
npm run dev
```

Open `http://localhost:3000`. The SQLite file is created automatically at
`data/gapfinder.db` (or `DATABASE_PATH`).

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
| `DATABASE_PATH` | `data/gapfinder.db` | recommended | Directory must be writable; use a durable volume |
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

If you switch embedding providers, existing chunks are excluded from retrieval
(model/dimension mismatch). Re-process the documents (document detail →
**Retry processing**) or reset and re-upload.

---

## 4. Verification results for this build

Environment: Windows, Node **v26.5.1**, npm **12.0.2**, Next.js **16.4.3**,
React **19.3.1**, Vitest **5.0.5**.

| Command | Result |
| --- | --- |
| `npm run lint` | **Passed** — no output, no errors |
| `npm run typecheck` | **Passed** — no output, no errors |
| `npm test` | **Passed** — 8 test files, **127 tests** |
| `npm run build` | **Passed** — compiled successfully; 21 static generation tasks reported (actual prerendered public/app routes are fewer; all routes compiled) |
| `npm run smoke` against production server | **Passed — 49 passed, 0 failed** |

Re-verified after the UI retheme, BUDDY voice/theme work, and live transcription:
lint, typecheck, 127 Vitest tests, production build (21 static generation tasks) and
the 49-check smoke suite all passed. Those runs confirm delivery and server
rendering; they do not exercise microphone capture, speech playback, word
boundary captions or theme transitions in a real browser (see
`KNOWN_LIMITATIONS.md` §1.6).

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
- No live Gemini call (no key).
- No deployment.
- No cross-platform (Linux/macOS) run.
- No load or concurrency test.

---

## 5. Deployment blockers (current)

### 5.1 No hosting credentials or authorization

No Vercel CLI, `VERCEL_TOKEN`, `GITHUB_TOKEN`, or explicit approval to deploy was
available. No URL is claimed.

### 5.2 SQLite is not durable on serverless

`node:sqlite` writes a local file. On Vercel (or any ephemeral/serverless host)
the filesystem is not durable or shared, so sessions, uploads and learner data
would disappear or diverge between instances. This build is therefore suitable
for a **single long-lived Node process with a persistent disk**, not for
serverless.

### 5.3 No hosted Postgres/pgvector

The schema is Postgres-shaped, but a Postgres adapter and pgvector index were not
implemented or provisioned. `DATABASE_URL`-style credentials were not available.

### 5.4 No email provider

Password reset is intentionally non-functional without an email provider. Do not
promise password recovery in a deployment.

---

## 6. Recommended production architecture (not implemented here)

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

## 7. Single-server deployment (works with current code)

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

## 8. Deployment checklist

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

## 9. Rollback

- Application: redeploy the previous build artifact.
- Database: restore the last SQLite backup (or Postgres snapshot). There are no
  migrations beyond the idempotent `CREATE TABLE IF NOT EXISTS` schema, so a
  schema rollback may require restoring the database as well.
- Demo: `npm run db:reset` on a non-production instance re-provisions on next
  demo entry.
