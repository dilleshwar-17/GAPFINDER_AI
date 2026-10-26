# Test Results

## Current working-tree validation

These checks were run after adding the optional PostgreSQL adapter, converting
database-dependent services and callers to async-safe operations, and adding
adapter regression tests. They ran locally and do not represent a Vercel
deployment or a live PostgreSQL/Supabase integration.

| Check | Result | Evidence and limitations |
| --- | --- | --- |
| `npm run typecheck` | PASS | `tsc --noEmit` completed with exit code 0. |
| `npm run lint` | PASS | `eslint .` completed with exit code 0. |
| `npm test` | PASS | Vitest: 12 files and 143 tests passed. Tests use in-memory SQLite and deterministic/offline AI paths. PostgreSQL tests cover placeholder conversion, generated schema conversion, and safe BIGINT parsing; they do not connect to PostgreSQL. |
| `npm run build` | PASS | Next.js 16.4.3 compiled, type-checked, generated 25 static pages, and listed the application routes. |
| `npm run smoke` | NOT TESTED | Not run against the existing Next dev server because another server was already running on port 3001; an isolated server could not start due to Next's shared dev lock. The existing server was not accessed or stopped. |
| `npm run db:migrate:postgres` | BLOCKED / NOT RUN | `DATABASE_URL` is absent from the current process and `.env.local`; no hosted database was connected or modified. |
| Live Supabase Auth and hosted student workflow | NOT TESTED | No live login, upload, persistence, diagnostic or plan workflow was performed. |
| Vercel deployment and production alias | NOT RUN | These working-tree changes have not been deployed; no alias was changed. The prior deployment record below remains historical. |

Vitest displayed a non-fatal Vite config-loader warning. No tests were weakened
or disabled.

## Historical deployment checks

The following table records checks from the previously deployed code before the
current PostgreSQL adapter changes. A GitHub-triggered Production deployment at
commit `2907ca9` was rolled back; after explicit authorization, commit
`0866985` was deployed to Production and assigned to the public alias. No
production database was modified.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | PASS at the time | Vitest: 11 files passed, 138 tests passed before the current PostgreSQL adapter regression tests. Tests use in-memory SQLite and disabled external AI providers. Vite emitted a non-fatal warning about the CommonJS/ESM configuration loader. |
| `npm run lint` | PASS | Completed after the Supabase key and session-handling changes. |
| `npm run typecheck` | PASS | Completed after the Supabase key and session-handling changes. |
| Supabase configuration/session regression tests | PASS | Seven focused tests cover fail-closed production configuration, legacy anon and publishable keys, missing-session redirects, and propagation of other Supabase errors. |
| Desktop browser visual check | PASS, limited | Local dashboard rendered; blue glass surfaces were visible. No responsive/mobile visual suite was run. |
| Local `npm run build` | BLOCKED | Next.js failed to unlink a `.next/static` file with `EPERM` while a local `next start` process was running. No process was stopped. |
| Vercel Preview build | PASS | The latest Preview deployment built remotely in 25s and `vercel inspect` reported target `preview`, status `Ready`. |
| Vercel Production build | PASS | `vercel deploy --prod --yes` deployed commit `0866985`; Vercel reports deployment `dpl_CxUmknxa9hA6VH8cvaaYrKkHtgCB` as `READY`, target `production`. `vercel alias ls` maps the public domain to this deployment. |
| Preview homepage, login, signup | PASS, limited | `vercel curl` returned HTTP 200 for `/`, `/login`, and `/signup` on the latest Preview URL. No credentials were submitted. |
| Preview protected dashboard | PASS, limited | An unauthenticated `HEAD /dashboard` returned HTTP 307 to `/login?next=%2Fdashboard`, confirming the no-session path no longer returns 500. This does not verify a signed-in session. |
| Preview health endpoint | FAIL | `GET /api/health` returned `status: degraded` and `database: error`. The handler catches the SQLite exception, so its underlying cause is not exposed by this check. |
| Production homepage and login | PASS, limited | Authenticated `vercel curl` requests returned HTTP 200. |
| Production protected dashboard | PASS, limited | Unauthenticated `HEAD /dashboard` returned HTTP 307 to `/login?next=%2Fdashboard`. |
| Production health endpoint | FAIL | `GET /api/health` returned `status: degraded` and `database: error`. |

The initial build failed because Next.js detected both `src/middleware.ts` and
`src/proxy.ts`. Supabase session refresh and route-guard behavior were
consolidated in `src/proxy.ts`; the duplicate middleware file was removed, and
the production build then passed.

## Not run or blocked

| Check | Result | Reason |
| --- | --- | --- |
| `npm run smoke` | NOT TESTED | Not run against this set of auth/theme changes. |
| Live Supabase Auth login, callback, and recovery | NOT TESTED | Preview has Auth configuration and its no-session path works, but no credentials were submitted and no auth flow was exercised end-to-end. |
| Supabase email confirmation/password recovery | NOT TESTED | No confirmation or recovery email flow was triggered or verified. |
| Durable Vercel data behavior | FAIL / BLOCKED | Preview and Production health checks for the previously deployed build report database error. The current working tree contains an optional PostgreSQL adapter, but it is unconfigured, un-migrated and not live-verified. |
| Live Gemini/RAG provider checks | NOT TESTED | Preview has provider configuration, but no paid/provider-backed AI request was made. |
| Mobile, keyboard, screen-reader, load, and concurrency suites | NOT TESTED | No automated browser, accessibility, or load suite was run. |

Vitest uses local deterministic embeddings and an in-memory database. Its
passes do not verify authenticated Supabase flows, hosted persistence, live
Gemini responses, or end-to-end student workflow behavior. The Preview is
protected by Vercel Authentication. Production is live but not healthy for
database-backed features and has not been end-to-end verified.
