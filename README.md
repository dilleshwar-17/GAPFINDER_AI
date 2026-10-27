# GapFinder AI

**Evidence-Grounded Learning Gap Diagnosis & Adaptive Revision**

GapFinder AI is an AI-powered learning platform that helps students identify knowledge gaps, understand difficult concepts, and build personalized revision plans using their own study materials.

The platform combines document-based knowledge retrieval, structured assessments, deterministic scoring, and adaptive planning to support a more focused and measurable learning experience.

**Repository:** [GAPFINDER_AI](https://github.com/dilleshwar-17/GAPFINDER_AI)

## Overview

Traditional study tools provide content, but students often struggle to determine what they have not understood and what they should revise next.

GapFinder AI addresses this challenge by connecting learning materials, assessment results, and revision planning in a single workflow.

**Core workflow:**

`Upload → Understand → Diagnose → Explain → Prioritize → Revise → Retest → Adapt`

## Key Features

- **Learning Material Management** — Upload PDF, TXT, and Markdown documents to build a searchable knowledge base.
- **Learning Gap Diagnosis** — Generate assessments and identify areas for improvement from available learning evidence.
- **BUDDY AI Assistant** — Ask questions about uploaded materials and receive evidence-grounded responses with source references.
- **Adaptive Revision Plans** — Prioritize learning gaps and organize revision into time-bounded tasks.
- **Progress Tracking** — Review assessment performance, mastery levels, and learning progress.
- **Source-Aware Responses** — Link answers and assessment evidence to stored document passages and page references where available.
- **Authentication** — Support account access through the configured authentication flow.
- **Voice Interaction** — Support speech input and spoken responses in compatible browsers.

## AI and RAG Architecture

GapFinder AI follows a structured Retrieval-Augmented Generation (RAG) workflow to ground responses in the learner's uploaded materials.

1. **Authorized Source** — Access materials permitted for the current learner.
2. **Extraction** — Extract readable content from supported documents.
3. **Chunking** — Divide content into smaller, retrievable passages.
4. **Embeddings** — Convert passages into representations for retrieval.
5. **Retrieval** — Find relevant passages within the appropriate learner and subject scope.
6. **Context Assembly** — Prepare retrieved evidence for the response.
7. **Generation** — Generate an answer or learning assessment using the available evidence.
8. **Citation Validation** — Verify references against stored source passages.
9. **Response** — Return the supported result, or abstain when sufficient evidence is unavailable.

The platform also combines assessment scoring, mastery tracking, gap analysis, and revision planning to connect retrieved knowledge with the learner's next steps.

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | Next.js 16, React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Validation | Zod 4 |
| Authentication | Supabase Auth |
| Local Database | SQLite using `node:sqlite` |
| Document Processing | `unpdf` |
| Testing | Vitest |

**AI provider note:** Gemini-based generation and neural embeddings are optional integrations. When the provider is not configured, the application uses deterministic local fallbacks.

## Getting Started

### Prerequisites

- Node.js 22.5 or later
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/dilleshwar-17/GAPFINDER_AI.git
cd GAPFINDER_AI
```

Install dependencies:

```bash
npm install
```

Create a local environment file if needed:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The local database is initialized on first use. API keys are not required for deterministic local mode.

### Optional Integrations

Configure the relevant environment variables in `.env.local` to enable supported external services.

- **Supabase Auth:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Gemini:** `GEMINI_API_KEY`

Use `.env.example` as the reference for the available configuration options. Never commit secrets or service-role keys to the repository.

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the application |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run the test suite |
| `npm run smoke` | Run HTTP smoke checks against a running server |

## Project Status

The application has been implemented and locally verified for core learning workflows, including document processing, retrieval, citation resolution, assessment scoring, revision planning, and BUDDY responses.

The following limitations remain relevant:

- Gemini generation and neural embeddings require provider configuration and have not been verified against a live provider in the documented test run.
- Supabase authentication flows require a configured project for live verification.
- Application data and uploaded files currently rely on local storage. A durable shared database and persistent file-storage integration are required before production deployment on platforms such as Vercel.

These limitations distinguish locally implemented functionality from externally configured or production-ready services.

## Documentation

Detailed technical documentation is available in the repository's `docs/` directory:

- [Problem Statement](docs/PROBLEM_STATEMENT.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [RAG Pipeline](docs/RAG_PIPELINE.md)
- [AI Workflow](docs/AI_WORKFLOW.md)
- [Scoring and Gap Analysis](docs/SCORING_AND_GAP_ANALYSIS.md)
- [Security and Privacy](docs/SECURITY_AND_PRIVACY.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Known Limitations](docs/KNOWN_LIMITATIONS.md)
- [Test Results](docs/TEST_RESULTS.md)
- [Release Readiness](docs/RELEASE_READINESS.md)

## Future Scope

Potential areas for further development include:

- Durable cloud database and file storage integration
- Live validation of external AI providers
- Improved learning recommendations based on assessment history
- Expanded evaluation of retrieval quality and citation accuracy
- Additional accessibility and learning-support features

## Academic Project

GapFinder AI is an academic software project focused on evidence-grounded AI assistance, personalized learning, and adaptive revision planning.

---

**Built to help learners understand what they know, discover what they need to improve, and decide what to learn next.**
