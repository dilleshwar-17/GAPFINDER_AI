# GapFinder AI

**Evidence-grounded learning-gap diagnosis and adaptive revision planning.**

GapFinder AI turns a learner's own syllabus and study notes into a searchable
evidence base, generates citation-backed diagnostics, scores them
deterministically, and builds a time-bounded revision plan from the measured
gaps. Every answer BUDDY gives is limited to passages retrieved from
that learner's own uploads, and every question links back to the chunk, page
and document it came from.

This repository is a runnable Next.js application. Local development uses
SQLite and deterministic AI fallbacks. Supabase Auth is available when
configured. The application has a PostgreSQL data adapter selected by `DATABASE_URL`,
while retaining SQLite locally. The Vercel Supabase Postgres resource has been
connected, its additive schema migration applied, and TLS configured with
certificate verification. The current local tree is deployed to the production
URL below; local SQLite data was not copied into the hosted database.

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
| Supabase Auth sign-in, sign-up, callback, sign-out, and password recovery | Implemented; production shared-demo sign-in verified, regular account and recovery flows not verified |
| Legacy local SQLite authentication | Used only when Supabase Auth variables are absent outside production |
| Temporary interactive demo via `/api/auth/demo` | Each entry gets an isolated workspace with three seeded subjects and five indexed materials per subject; lifecycle tests use in-memory SQLite |
| Gemini LLM / neural embeddings | Production health reports providers configured; live generation and embedding calls were not exercised |
| Optional PostgreSQL data adapter | Implemented; Vercel production health reports `database: ok` over TLS-verified Supabase PostgreSQL |
| PostgreSQL schema migration | Explicit additive migration applied to the empty hosted database; no SQLite data was copied |
| Hosted object storage | Missing — original uploads and embeddings are stored as database binary data |
| Vercel production smoke checks | Production alias, database health, login page, unauthenticated route guard, and read-only demo sign-in verified |
| Full hosted student workflow | **Not tested end-to-end** — upload, retrieval, diagnostic, scoring, and revision persistence need a complete authenticated run |

The deterministic fallbacks are honest, working implementations rather than
stubs: lexical hash embeddings (`gapfinder-hash-v1`, 512 dims), extractive
answers assembled from retrieved sentences, and template questions derived from
source sentences. They are labelled as such in the UI and in
[`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).

---

## Requirements

- **Node.js >= 22.5** (this build was verified on Node **v26.5.1**). Local
  development uses built-in `node:sqlite`; hosted PostgreSQL uses `pg`.
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
| `npm run db:migrate:postgres` | Explicitly apply the initial PostgreSQL schema from `DATABASE_URL` |
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
| `npm run lint` | **Passed** on the deployed local tree |
| `npm run typecheck` | **Passed** on the deployed local tree |
| `npm test` | **Passed** — 12 files, **147 tests** |
| `npm run build` | **Passed** — Next.js 16.4.3 production build |
| Vercel Production deployment | **Ready** — `dpl_AdnNASWprBTJJB7es8vwModxLTTL`, build duration 28s |
| Production alias and `/api/health` | **Passed** — `https://gapfinder-ai-dilleshwar-rao.vercel.app`; health reports `database: ok` |
| Production `/login` and unauthenticated `/dashboard` | **Passed** — HTTP 200 and redirect HTTP 307 to login |
| Production shared-demo sign-in | Historical check only — the former shared demo identity was read-only; the current temporary interactive-demo behavior needs deployment verification |
| Production runtime error query | **No error records returned** in the available 30-minute window; Vercel Hobby log retention is limited |
| `npm run smoke` | **Not run** against Production |
| Complete live student workflow | **Not tested** — regular account auth, upload/RAG, diagnostic, and revision persistence remain unverified |

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
| `DATABASE_URL` | unset | hosted PostgreSQL | Server-only PostgreSQL connection string. When set, it selects PostgreSQL instead of SQLite. Configure securely; never add it to `NEXT_PUBLIC_*` variables. |
| `DATABASE_CA_CERT` | unset | Supabase PostgreSQL TLS | Optional public CA certificate in PEM form; use the provider's CA certificate when required. TLS certificate and hostname verification remain enabled. |
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

- **Local / self-hosted:** `npm run build && npm start` (SQLite requires a writable persistent location; set `DATABASE_URL` for PostgreSQL).
- **Vercel:** Production is deployed at `https://gapfinder-ai-dilleshwar-rao.vercel.app` with Supabase PostgreSQL and TLS CA configuration. The schema migration and `/api/health` are verified; full signed-in student workflows, regular Supabase Auth flows, backups, and object storage remain unverified or incomplete. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Troubleshooting

- **Node version:** requires Node >= 22.5 because of `node:sqlite`. Verify with `node -v`.
- **Voice not working:** Speech Recognition/synthesis depend on the browser and OS. If controls are disabled, type the question — no feature requires voice.
- **Empty retrieval / abstentions:** Ensure material is uploaded, extracted and `ready`, or try re-processing after a provider change.
- **Demo missing:** In local mode, check `DISABLE_DEMO` and that `/api/auth/demo` is not rate-limited. With Supabase Auth, configure `SUPABASE_DEMO_EMAIL` and `SUPABASE_DEMO_PASSWORD` for the shared account. Its configured email is marked read-only in the app profile; trusted `app_metadata.is_demo=true` is also recognized. A production demo still needs durable app data.
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
Zod 4, Supabase Auth (`@supabase/ssr`), local `node:sqlite` / hosted PostgreSQL
(`pg`), `unpdf` for PDF
text extraction, `lucide-react` icons, and locally bundled Onest. Tests use
Vitest 5.

---

## License / use

Academic project. No license file is included; treat it as all-rights-reserved
unless the author states otherwise.
