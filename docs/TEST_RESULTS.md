# Test Results

## Current validation and deployment

Checks below were run on the local tree deployed directly to Vercel Production.
The working tree included the Settings-page change noted in the deployment
record; only the database TLS/docs changes were included in commit `d272293`.
Automated tests use local in-memory SQLite and deterministic/offline AI unless
otherwise stated.

| Check | Result | Evidence and limitations |
| --- | --- | --- |
| `npm run typecheck` | PASS | `tsc --noEmit` completed with exit code 0. |
| `npm run lint` | PASS | `eslint .` completed with exit code 0. |
| `npm test` | PASS | Vitest: 12 files and 147 tests passed. PostgreSQL adapter tests cover strict CA TLS configuration but do not connect to a server. |
| `npm run build` | PASS | Next.js 16.4.3 production build compiled, type-checked, generated static pages, and listed application routes. |
| `git diff --check` | PASS | No whitespace errors in the final worktree changes. |
| `npm run smoke` | NOT TESTED | Not run against the deployed site. |
| Hosted PostgreSQL connection and migration | PASS | Strict TLS was verified and the additive schema migration was applied to the inspected empty database; local SQLite records were not copied. |
| Production `/api/health` | PASS | Protected `vercel curl` returned `status: ok`, `database: ok`. |
| Production login page / dashboard guard | PASS, limited | `/login` returned HTTP 200; unauthenticated `/dashboard` returned HTTP 307 to `/login`. |
| Production shared-demo sign-in | PASS, limited | `/api/auth/demo` returned HTTP 200 with `isDemo: true`; no account values or session tokens were reported. |
| Production error logs | PASS, limited | No error records returned for the available 30-minute window. Longer log retention was unavailable on the Hobby plan. |
| Full hosted student workflow | NOT TESTED | No regular-user login, upload, retrieval, diagnostic, answer submission, report, or revision-plan workflow was run. |
| Live Gemini generation / embeddings | NOT TESTED | Production health reports the providers configured, but no live generation or embedding request was made. |

Vitest displayed a non-fatal Vite config-loader warning. No tests were weakened
or disabled.

## Historical deployment checks

The following table records checks from earlier deployments before the
PostgreSQL production configuration and TLS fix. These historical failures are
superseded by the current health check above.

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

## Remaining verification gaps

| Check | Result | Reason |
| --- | --- | --- |
| `npm run smoke` | NOT TESTED | The smoke script was not run against the current production deployment. |
| Regular-user Supabase Auth flows | NOT TESTED | Only the shared demo sign-in endpoint was exercised; signup, callback, sign-out, and recovery were not. |
| Supabase email confirmation/password recovery | NOT TESTED | No confirmation or recovery email flow was triggered or verified. |
| Hosted learner data workflows | NOT TESTED | Database health passed, but no regular learner upload, retrieval, diagnostic, answer submission, report, or revision workflow was run. |
| Live Gemini/RAG provider checks | NOT TESTED | Production health reports providers configured, but no live generation or embedding request was made. |
| Mobile, keyboard, screen-reader, load, and concurrency suites | NOT TESTED | No automated browser, accessibility, or load suite was run. |

Vitest uses local deterministic embeddings and an in-memory database. Its
passes do not verify complete authenticated Supabase flows, live Gemini
responses, or the end-to-end student workflow. Production is healthy for
database connectivity, but these broader workflows remain unverified.
