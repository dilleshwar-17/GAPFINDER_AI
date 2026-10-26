# GapFinder AI

**Evidence-grounded learning-gap diagnosis and adaptive revision planning.**

GapFinder AI turns a learner's own syllabus and study notes into a searchable
evidence base, generates citation-backed diagnostics, scores them
deterministically, and builds a time-bounded revision plan from the measured
gaps. Every answer BUDDY gives is limited to passages retrieved from
that learner's own uploads, and every question links back to the chunk, page
and document it came from.

This repository is a runnable Next.js application. Local development uses
SQLite and the deterministic AI fallbacks. Supabase Auth is used when its
environment is configured; service code still depends on the local SQLite
database, so the current app is **not ready for a durable Vercel production
deployment**.

Source: <https://github.com/dilleshwar-17/GAPFINDER_AI> (branch `main`).

---

## What is real (and what is not)

| Capability | Status |
| --- | --- |
| Upload PDF/TXT/MD, extract, chunk, embed, persist | Real, executed in verification |
| Vector retrieval scoped to owner + subject | Real |
| Citation resolution to stored chunks and pages | Real |
| Diagnostic generation + deterministic scoring | Real |
| Mastery bands, gap reports, progress trends | Real |
| Adaptive, time-bounded revision plans with version history | Real |
| Grounded assistant (BUDDY) with citation validation and abstention | Real |
| BUDDY voice input and spoken replies via browser Web Speech APIs | Real in supporting browsers; not exercised by automated tests |
| Blue glassmorphism theme, across public and workspace layouts | Implemented; visually inspected in a desktop browser |
| Supabase Auth sign-in, sign-up, callback, sign-out, and password recovery | Implemented; not live-verified because Supabase environment is unavailable |
| Legacy local SQLite authentication | Used only when Supabase Auth variables are absent outside production |
| Shared demo workspace via `/api/auth/demo` | Implemented locally; Supabase production demo needs a separately configured demo user |
| Gemini LLM / neural embeddings | **Not executed** — no `GEMINI_API_KEY` was available, so the deterministic fallbacks ran |
| Durable Supabase Postgres adapter and object storage | **Missing** — app data and uploads still use local SQLite |
| Vercel production deployment | **Blocked** — local SQLite is not durable/shared on Vercel; no deployment was performed |
| Live Supabase Auth or hosted database verification | **Blocked** — no Supabase environment was configured |

The deterministic fallbacks are honest, working implementations rather than
stubs: lexical hash embeddings (`gapfinder-hash-v1`, 512 dims), extractive
answers assembled from retrieved sentences, and template questions derived from
source sentences. They are labelled as such in the UI and in
[`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).

---

## Requirements

- **Node.js >= 22.5** (this build was verified on Node **v26.5.1**). The
  database driver is the built-in `node:sqlite` module.
- npm (verified with npm **12.0.2**).

No API key is required for local deterministic mode. Supabase environment
variables are required to use Supabase Auth. The local SQLite database is not
a production Vercel persistence option.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Optional: copy environment defaults
#    Windows:  copy .env.example .env.local
#    POSIX:    cp .env.example .env.local

# 3. Start the development server
npm run dev
# -> http://localhost:3000

# 4. In a second terminal, exercise the HTTP smoke suite
npm run smoke
```

The database file is created on first use at `data/gapfinder.db`. Sample data
is **not** auto-created for normal accounts. To explore a seeded workspace, open
[`/demo-access`](http://localhost:3000/demo-access) and choose **Enter the demo
workspace**. See [`docs/DEMO_ACCESS.md`](docs/DEMO_ACCESS.md).

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (`next build`, Turbopack) |
| `npm start` | Serve the production build (`next start`) |
| `npm run lint` | ESLint over the repository |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite (in-memory SQLite, no network) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:reset` | Delete the local SQLite database file |
| `npm run smoke` | HTTP checks against a running server (`BASE_URL` overrides `http://localhost:3000`) |

### Example: production verification

```bash
npm run build
# PowerShell
$env:DATABASE_PATH="data/smoke-final.db"; $env:PORT="3100"; npm start
# then, in another shell
$env:BASE_URL="http://localhost:3100"; npm run smoke
```

---

## Routes

Public:

- `/` landing page
- `/login`, `/signup`, `/demo-access`
- `/forgot-password`, `/reset-password` (Supabase recovery flow when configured; local mode explains that email recovery is unavailable)
- `/privacy`, `/terms`

Authenticated workspace:

- `/onboarding`
- `/dashboard`
- `/subjects`, `/subjects/[subjectId]/topics`
- `/materials`, `/materials/upload`, `/materials/[documentId]`
- `/diagnostics`, `/diagnostics/[assessmentId]`, `/diagnostics/[assessmentId]/results`
- `/reports`, `/reports/[reportId]` (`reportId` is the subject ID)
- `/revision-plan`
- `/learn/[topicId]`
- `/assistant` — BUDDY, the source-grounded study assistant (type, dictate or listen)
- `/progress`
- `/settings`

Plus custom `not-found`, `error`, `global-error`, and loading boundaries.

API route handlers live under `/api`: `auth/{login,register,logout,demo}`,
`subjects`, `subjects/[subjectId]`, `subjects/[subjectId]/topics`,
`subjects/[subjectId]/topics/extract`, `documents`, `documents/[documentId]`,
`documents/[documentId]/retry`, `assessments`, `assessments/[assessmentId]/draft`,
`assessments/[assessmentId]/submit`, `plans`, `plans/tasks/[taskId]`,
`assistant`, `preferences`, `profile`, `password`, and `health`.

---

## Verification results

Run on Windows, Node v26.5.1, npm 12.0.2:

| Command | Result |
| --- | --- |
| `npm run lint` | **Passed** after Supabase auth changes |
| `npm run typecheck` | **Passed** after Supabase auth changes |
| `npm test` | **Passed** — 11 files, **138 tests** |
| Local `npm run build` | **Blocked** — Windows `EPERM` while unlinking `.next/static` with a local Next server running |
| Vercel Preview build | **Passed** — latest Preview reported Ready |
| Preview health | **Failed** — `/api/health` reports `database: error` |
| `npm run smoke` | **Not run** for the current Supabase/theme changes |

The smoke suite covers public pages, auth guards, cross-origin rejection, demo
session issuance, the shared-demo banner, seeded subject discovery, every seeded
dynamic route, BUDDY grounding/citation validation, diagnostic results and
runner, the custom 404, demo write blocking, logout, and stale-session
rejection.

The blue glass theme was visually inspected in the integrated browser at a
desktop viewport. Supabase email confirmation, password recovery, and provider
sessions were not exercised against a live project. See
[`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) and
[`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md).

The Vitest suite runs with `DATABASE_PATH=:memory:` and the model provider
disabled, so it is deterministic and offline. It includes a full service-level
workflow test: upload → extraction → topic map → diagnostic → scoring →
citation check → mastery → gap report → plan → adaptive re-plan → grounded
assistant → cross-user 404s.

### Interface notes

- Typography is **Onest**, bundled locally through `@fontsource-variable/onest`.
- A blue glassmorphism palette is shared across the public site and signed-in workspace. The theme toggle supports light/dark modes and persists the choice in `localStorage`; the root layout applies it before paint. Status colours stay semantic (weak red, developing amber, strong green).
- BUDDY (the assistant at /assistant) shows a live dictation transcript panel while you speak, supports editable dictation through the browser Speech Recognition API, and speaks replies with `speechSynthesis`. A fixed caption dock highlights the current word from `onboundary` events where supported, with a fallback when they are not reported. It also exposes a per-answer **Listen** control and a **Read aloud** toggle.
- Hot paths use cached prepared statements, WAL with `synchronous=NORMAL`, grouped subject aggregates instead of per-subject queries, request-scoped session caching, and added lookup indexes.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Variables prefixed
with `NEXT_PUBLIC_` are browser-visible public configuration; never put service
role keys or other secrets in them.

| Variable | Default | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | unset | for Supabase Auth | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | unset | for Supabase Auth | Public key only; the legacy anon key remains supported. Never use a service-role key. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | production auth links | Must be the canonical HTTPS deployment origin in production. |
| `SUPABASE_DEMO_EMAIL` | unset | for Supabase-hosted demo | Server-only demo account address. |
| `SUPABASE_DEMO_PASSWORD` | unset | for Supabase-hosted demo | Server-only secret; never commit or expose. |
| `DATABASE_PATH` | `data/gapfinder.db` | local only | Use `:memory:` for tests; this database is not durable/shared on Vercel. |
| `GEMINI_API_KEY` | unset | no | Without it, deterministic fallbacks are used. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | no | |
| `EMBEDDING_PROVIDER` | auto | no | `local` forces offline hash embeddings. |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | no | |
| `EMBEDDING_DIMENSIONS` | `768` | no | 128–3072 |
| `LOCAL_EMBEDDING_DIMENSIONS` | `512` | no | 64–2048 |
| `MAX_UPLOAD_MB` | `8` | no | 1–25 |
| `RETRIEVAL_TOP_K` | `6` | no | Fallback for BUDDY; diagnostics use `8`. |
| `RETRIEVAL_MIN_SCORE` | `0.15` | no | 0–1 |
| `MIN_EVIDENCE_CHARS` | `240` | no | 40–4000 |
| `SESSION_TTL_DAYS` | `7` | no | 1–30 |
| `DISABLE_DEMO` | `0` | no | Set to `1` to disable demo entry. |
| `DEMO_EMAIL` | `demo@gapfinder.local` | no | Reserved demo address. |

## Database reset

```bash
npm run db:reset
```

This deletes the configured SQLite file (`DATABASE_PATH`, default `data/gapfinder.db`). The next run creates a fresh schema on first use. To rebuild the shared demo, open `/demo-access` after reset.

## Deployment

- **Local / self-hosted:** `npm run build && npm start` (set `PORT` and `DATABASE_PATH` to a writable persistent location).
- **Vercel:** commit `0866985` is deployed to Production at <https://gapfinder-ai-dilleshwar-rao.vercel.app> and to Preview at <https://gapfinder-qcvgrogr0-dilleshwar-17s-projects.vercel.app>. Routes respond and unauthenticated protected requests redirect to login, but `/api/health` reports a database error. A durable Supabase/Postgres application data adapter is not implemented; the app is not fully functional or production-ready on Vercel until SQLite persistence and uploaded-file storage are migrated. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Troubleshooting

- **Node version:** requires Node >= 22.5 because of `node:sqlite`. Verify with `node -v`.
- **Voice not working:** Speech Recognition/synthesis depend on the browser and OS. If controls are disabled, type the question — no feature requires voice.
- **Empty retrieval / abstentions:** Ensure material is uploaded, extracted and `ready`, or try re-processing after a provider change.
- **Demo missing:** In local mode, check `DISABLE_DEMO` and that `/api/auth/demo` is not rate-limited. With Supabase Auth, configure the demo account variables and mark the Supabase user `app_metadata.is_demo=true`. A production demo still needs durable app data.
- **Port already in use:** Set `PORT` or stop the existing process.


---

## Documentation

- [`docs/PROBLEM_STATEMENT.md`](docs/PROBLEM_STATEMENT.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/RAG_PIPELINE.md`](docs/RAG_PIPELINE.md)
- [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md)
- [`docs/SCORING_AND_GAP_ANALYSIS.md`](docs/SCORING_AND_GAP_ANALYSIS.md)
- [`docs/SECURITY_AND_PRIVACY.md`](docs/SECURITY_AND_PRIVACY.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md)
- [`docs/DEMO_ACCESS.md`](docs/DEMO_ACCESS.md)
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)
- [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md)
- [`docs/BUG_REPORT.md`](docs/BUG_REPORT.md)
- [`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md)
- Diagram sources: [`docs/diagrams/system-architecture.mmd`](docs/diagrams/system-architecture.mmd), [`docs/diagrams/ai-workflow.mmd`](docs/diagrams/ai-workflow.mmd)

---

## Technology

Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS 4,
Zod 4, Supabase Auth (`@supabase/ssr`), local `node:sqlite`, `unpdf` for PDF
text extraction, `lucide-react` icons, and locally bundled Onest. Tests use
Vitest 5.

---

## License / use

Academic project. No license file is included; treat it as all-rights-reserved
unless the author states otherwise.
