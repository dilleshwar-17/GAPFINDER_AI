# Test Results

Results below are for the current working tree in the Windows development
environment. No production database was touched.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | PASS | Completed without lint errors after the auth and theme changes. |
| `npm run typecheck` | PASS | Completed without TypeScript errors after the auth and theme changes. |
| `npm test` | PASS | Vitest: 9 files passed, 130 tests passed. Tests use in-memory SQLite and disabled external AI providers. Vite emitted a non-fatal warning about the CommonJS/ESM configuration loader. |
| `npm run build` | PASS | Next.js 16.4.3 production build compiled all app routes. |
| Desktop browser visual check | PASS, limited | Local dashboard rendered; blue glass surfaces were visible. No responsive/mobile visual suite was run. |

The initial build failed because Next.js detected both `src/middleware.ts` and
`src/proxy.ts`. Supabase session refresh and route-guard behavior were
consolidated in `src/proxy.ts`; the duplicate middleware file was removed, and
the production build then passed.

## Not run or blocked

| Check | Result | Reason |
| --- | --- | --- |
| `npm run smoke` | NOT TESTED | Not run against this set of auth/theme changes. |
| Live Supabase Auth | BLOCKED | Supabase URL and public key were not configured in this environment. |
| Supabase email confirmation/password recovery | BLOCKED | No live project/email configuration was available. |
| Vercel deployment | NOT TESTED | No deployment was authorized or performed; no Vercel token was configured. |
| Durable Vercel data behavior | BLOCKED | Application data still uses local SQLite; no Postgres/Supabase data adapter exists. |
| Live Gemini/RAG provider checks | BLOCKED | No Gemini API key was configured. |
| Mobile, keyboard, screen-reader, load, and concurrency suites | NOT TESTED | No automated browser, accessibility, or load suite was run. |

Vitest uses local deterministic embeddings and an in-memory database. Its
passes do not verify real Supabase, hosted persistence, live Gemini responses,
or production deployment behavior.
