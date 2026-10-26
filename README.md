# GapFinder AI

**Evidence-grounded learning-gap diagnosis and adaptive revision planning.**

GapFinder AI turns a learner's own syllabus and study notes into a searchable
evidence base, generates citation-backed diagnostics, scores them
deterministically, and builds a time-bounded revision plan from the measured
gaps. Every answer the assistant gives is limited to passages retrieved from
that learner's own uploads, and every question links back to the chunk, page
and document it came from.

This repository is a complete, runnable Next.js application. It is **not** a
mock: uploads are parsed and persisted, embeddings are stored, sessions are
server-issued and revoked, ownership is checked in SQL, and diagnostics are
scored from stored answers.

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
| Grounded assistant with citation validation and abstention | Real |
| Server sessions, scrypt passwords, rate limits, CSRF-style origin checks | Real |
| Shared demo workspace via `/api/auth/demo` | Real |
| Gemini LLM / neural embeddings | **Not executed** — no `GEMINI_API_KEY` was available, so the deterministic fallbacks ran |
| Hosted Postgres/pgvector | **Not provisioned** |
| Vercel deployment | **Not deployed** — no CLI/token/authorization |
| Browser automation (Playwright) | **Not run** — not installed |

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

No Docker, no external database, and no API key are required to run the app.

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
- `/forgot-password`, `/reset-password` (honest "email delivery not configured" state)
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
- `/assistant`
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

## Verification results (this build)

Run on Windows, Node v26.5.1, npm 12.0.2:

| Command | Result |
| --- | --- |
| `npm run lint` | **Passed** — no errors or warnings |
| `npm run typecheck` | **Passed** — no errors |
| `npm test` | **Passed** — 8 files, **127 tests** |
| `npm run build` | **Passed** — 21 static pages generated, all routes compiled |
| `npm run smoke` (production server, fresh DB) | **Passed** — 49 checks, 0 failed |

The smoke suite covers public pages, auth guards, cross-origin rejection, demo
session issuance, the shared-demo banner, seeded subject discovery, every seeded
dynamic route, assistant grounding/citation validation, diagnostic results and
runner, the custom 404, demo write blocking, logout, and stale-session
rejection.

The Vitest suite runs with `DATABASE_PATH=:memory:` and the model provider
disabled, so it is deterministic and offline. It includes a full service-level
workflow test: upload → extraction → topic map → diagnostic → scoring →
citation check → mastery → gap report → plan → adaptive re-plan → grounded
assistant → cross-user 404s.

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
- Diagram sources: [`docs/diagrams/system-architecture.mmd`](docs/diagrams/system-architecture.mmd), [`docs/diagrams/ai-workflow.mmd`](docs/diagrams/ai-workflow.mmd)

---

## Technology

Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS 4,
Zod 4, `node:sqlite`, `unpdf` for PDF text extraction, `lucide-react` icons, and
locally bundled Inter. Tests use Vitest 5.

---

## License / use

Academic project. No license file is included; treat it as all-rights-reserved
unless the author states otherwise.
