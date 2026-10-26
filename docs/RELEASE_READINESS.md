# Release Readiness

**Status: NOT READY for production use.** Commit `0866985` is deployed to the
Production alias, but its health endpoint reports a database error.

## Verified

- Next.js 16.4.3 production build passes after consolidating Next's
  `middleware.ts`/`proxy.ts` entry point.
- `npm run lint` and `npm run typecheck` pass.
- `npm test` passes: 11 test files, 138 tests. This is an offline suite using
  in-memory SQLite and deterministic providers.
- Supabase Auth flows are wired in code and the SSR proxy validates configured
  provider identity; live Supabase verification is still required.
- Production auth now fails closed with a service-unavailable response when
  Supabase Auth configuration is absent; the non-production SQLite fallback
  remains available for local development and tests.
- Blue glassmorphism styling is shared across public and signed-in layouts and
  was visually inspected on a desktop browser.
- A Vercel Preview deployment was created and is Ready. Its homepage, login,
  and signup routes returned HTTP 200 through authenticated CLI requests.
- An unauthenticated Preview dashboard request now redirects to login rather
  than failing with `AuthSessionMissingError`; other Supabase errors remain
  surfaced.
- The Preview health endpoint returned `status: degraded` and
  `database: error`; this confirms the SQLite-backed application is not healthy
  on the Vercel runtime.
- Production deployment `dpl_CxUmknxa9hA6VH8cvaaYrKkHtgCB` is Ready and
  assigned to the public domain. Homepage/login return HTTP 200 and an
  unauthenticated dashboard request redirects to login.
- The Production health endpoint also returns `status: degraded` and
  `database: error`. The alias is current, but data-backed features are not
  healthy.

## Release blockers

1. **Durable application storage:** the application still uses local
   `node:sqlite`. Vercel does not provide the durable shared filesystem this
   implementation requires.
2. **Supabase Auth live verification:** configure a non-production project,
   callback allow-list, email confirmation, and reset delivery; test all flows.
3. **Existing data migration:** preserve local learner records, map confirmed
   identities, and require existing users to set/reset Supabase passwords.
   No database was modified or migrated.
4. **File persistence:** uploads remain SQLite BLOBs; no hosted object storage
   path exists.
5. **End-to-end verification:** authentication, ownership, upload/RAG/citation,
   mobile, accessibility, load, and concurrency tests have not been run. The
   Preview and Production cannot serve as healthy data-backed test environments
   because their database health checks fail.
6. **Operations:** Production is deployed, but backup/restore, alerting,
   rollback, and end-to-end student flows have not been verified.

## Approval gate

Do not claim production readiness until the application data/storage
layer is durable, all Supabase auth and ownership flows pass against a
non-production project, regression and production-build checks pass, and a
healthy authorized preview deployment is verified end-to-end.
