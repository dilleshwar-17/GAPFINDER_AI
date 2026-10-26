# Test Plan

Use the repository's existing npm scripts; no external service is required for
the deterministic unit suite.

## Local checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run smoke` is an HTTP smoke suite and requires a running application at
`BASE_URL`. Do not run `npm run db:reset` unless the operator explicitly
approves deleting the configured local database.

## Coverage areas

- `tests/chunking.test.ts`, `tests/citations.test.ts`: chunk boundaries,
  provenance, and citation-id validation.
- `tests/assessment-store.test.ts`, `tests/scoring.test.ts`,
  `tests/mastery.test.ts`, `tests/planner.test.ts`: answer persistence,
  deterministic scoring, evidence sufficiency, mastery, and plan constraints.
- `tests/ownership.test.ts`, `tests/workflow.test.ts`: server-side owner
  isolation and the upload-to-revision workflow.
- `tests/auth-profile.test.ts`: Supabase identity/profile mapping and refusal
  to link an unconfirmed identity to an existing profile.

## Live-service checks still required

Using a dedicated non-production Supabase project, verify email confirmation,
sign-in/out, password recovery, password updates, redirect allow-lists,
concurrent sessions, and account-to-existing-profile mapping. Separately test
Vercel persistence only after replacing SQLite with a durable application data
adapter. Live Gemini, real upload extraction on production-like inputs, mobile
visual/accessibility checks, load, and concurrency checks are not covered by
the offline Vitest suite.
