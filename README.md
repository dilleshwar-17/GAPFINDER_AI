# GapFinder AI

**Evidence-Grounded Learning Gap Diagnosis & Adaptive Revision**

GapFinder AI helps students find knowledge gaps, understand difficult concepts,
and build personalized revision plans using their own study materials.

The platform connects document-based knowledge retrieval, structured
assessments, deterministic scoring, and adaptive planning in a single workflow.

**Repository:** [GAPFINDER_AI](https://github.com/dilleshwar-17/GAPFINDER_AI)

**Production site:** [gapfinder-ai-dilleshwar-rao.vercel.app](https://gapfinder-ai-dilleshwar-rao.vercel.app)

## Core workflow

`Upload → Understand → Diagnose → Explain → Prioritize → Revise → Retest → Adapt`

## Key features

- **Learning materials** — Upload PDF, TXT and Markdown documents; extract,
  chunk, embed and retrieve source passages.
- **Learning gap diagnosis** — Generate evidence-grounded questions, score
  submitted answers and track topic mastery.
- **BUDDY assistant** — Ask questions about indexed materials and receive
  grounded responses with validated source citations.
- **Adaptive revision plans** — Prioritize measured gaps and schedule
  time-bounded tasks.
- **Progress tracking** — Review assessment performance, mastery and learning
  history.
- **Authentication and isolation** — Supabase Auth for learner accounts with
  server-side ownership checks.
- **Interactive demo** — Each visit gets a private temporary workspace with
  three sample subjects and five indexed materials per subject.
- **Voice interaction** — Speech input and spoken responses in compatible
  browsers.

## AI and RAG architecture

The application scopes retrieval to the authenticated learner and subject,
extracts text, splits it into retrievable passages, embeds and ranks relevant
chunks, generates a response from the retrieved evidence, validates citations
against stored sources and abstains when evidence is insufficient. When no AI
provider is configured, deterministic local embeddings and source-grounded
generation fallbacks remain available.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | Next.js 16, React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Validation | Zod 4 |
| Authentication | Supabase Auth |
| Local database | SQLite using `node:sqlite` |
| Hosted database | PostgreSQL using `pg` |
| Document processing | `unpdf` |
| Testing | Vitest |

Gemini-based generation and neural embeddings are optional integrations. Local
fallbacks keep the app usable without provider credentials.

## Getting started

### Prerequisites

- Node.js 22.5 or later
- npm

### Install and run

```bash
git clone https://github.com/dilleshwar-17/GAPFINDER_AI.git
cd GAPFINDER_AI
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The local database is
initialized on first use; AI API keys are not required for deterministic local
mode.

To configure optional services, copy `.env.example` to `.env.local` and set
only the values needed for your environment. Never commit secrets or
service-role keys.

### Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the application |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run the offline test suite |
| `npm run smoke` | Run HTTP checks against a running instance; creates a temporary demo workspace and may call configured AI providers |

## Temporary demo

Demo sessions are interactive and isolated per visitor. Each begins with
Biology: Cells and Energy, Algebra: Functions and Equations, and Climate
Science: Earth Systems; each subject has five indexed sample materials,
diagnostics, mastery data and a revision plan. Visitors can use the learning
workflow and change their own temporary data.

Ending the demo deletes its application workspace. Closing the tab requests
best-effort cleanup; sessions expire after four hours and are cleaned up on a
later demo launch if necessary. Application deletion does not erase database
backups or provider/infrastructure retention. See
[`docs/DEMO_ACCESS.md`](docs/DEMO_ACCESS.md) for details.

## Project status

The local application is implemented and verified for material processing,
retrieval, citations, assessment scoring, revision planning and the demo
workspace lifecycle. Hosted PostgreSQL and Supabase Auth are configured for
production. The interactive demo is deployed to the production site; the
production health endpoint reports the database healthy and the demo entry page
shows the updated private-session flow. A live demo session was not launched
during verification, so its hosted first-run seed has not been exercised.
Live Gemini calls and neural embeddings were not part of local test runs.

Hosted object storage is not configured; uploaded files and embeddings are
stored in the database. Provider and database backup retention are managed by
their respective services.

## Documentation

Detailed technical documentation is available in [`docs/`](docs/):

- [Problem Statement](docs/PROBLEM_STATEMENT.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [RAG Pipeline](docs/RAG_PIPELINE.md)
- [AI Workflow](docs/AI_WORKFLOW.md)
- [Scoring and Gap Analysis](docs/SCORING_AND_GAP_ANALYSIS.md)
- [Security and Privacy](docs/SECURITY_AND_PRIVACY.md)
- [Demo Access](docs/DEMO_ACCESS.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Known Limitations](docs/KNOWN_LIMITATIONS.md)
- [Test Results](docs/TEST_RESULTS.md)
- [Release Readiness](docs/RELEASE_READINESS.md)

## Academic project

GapFinder AI is an academic software project focused on evidence-grounded AI
assistance, personalized learning and adaptive revision planning.
