# Release Readiness

**Status: NOT READY for production use.** The current local tree is deployed
to the Production alias and its health endpoint reports `database: ok`. The
interactive demo entry page is deployed, but the complete hosted student
workflow and operational recovery have not been verified.

The hosted Supabase PostgreSQL database has the additive initial schema and
strict TLS configuration. The migration did not copy local SQLite data.

## Verified

- Current working-tree `npm run typecheck` passes.
- Current working-tree `npm run lint` passes.
- Current working-tree `npm test` passes: 13 files, 151 tests. PostgreSQL adapter
  tests are unit tests and do not connect to a live server.
- Current working-tree `npm run build` passes on Next.js 16.4.3.
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
- Production deployment `dpl_AdnNASWprBTJJB7es8vwModxLTTL` is Ready and
  assigned to `https://gapfinder-ai-dilleshwar-rao.vercel.app`. Login returned
  HTTP 200 and an unauthenticated dashboard request returned HTTP 307 to login.
- Production health returns `status: ok` and `database: ok`; the additive schema
  migration and strict TLS connection were verified.
- Production `/demo-access` returns HTTP 200 and displays the temporary
  interactive-demo flow. The demo entry endpoint was not called in production
  because first-time seeding invokes the configured embedding provider.
- The previous production `/api/auth/demo` check exercised the former
  shared-demo implementation and does not verify the current temporary-session
  creation or cleanup against hosted PostgreSQL.
- No error records were returned by the production query for the available
  30-minute log window. Vercel Hobby log retention is limited.

## Release blockers

1. **End-to-end hosted workflow:** test an authorized regular learner account
   through subject creation, material upload/indexing, diagnostic generation,
   submission, scoring, persistence, revision planning, and retest.
2. **Supabase Auth live verification:** test regular account sign-in, signup,
   callback, sign-out, email confirmation, and password recovery. Only shared
   demo sign-in was exercised.
3. **Existing data migration:** preserve any local learner records, map
   confirmed identities, and require existing users to set/reset Supabase
   passwords. The initial schema migration created structure only; no local
   SQLite learner data was copied to the hosted database.
4. **File persistence and scale:** the current adapter stores original uploads
   and embeddings in PostgreSQL `BYTEA`; no hosted object-storage path exists.
5. **Quality and security verification:** ownership, upload/RAG/citation,
   mobile, accessibility, load, and concurrency tests have not been run against
   the hosted deployment.
6. **Operations:** Production is deployed, but backup/restore, alerting,
   rollback, and end-to-end student flows have not been verified.

## Approval gate

Do not claim production readiness until the application data/storage
layer is durable, all Supabase auth and ownership flows pass against a
non-production project, regression and production-build checks pass, and a
healthy authorized preview deployment is verified end-to-end.
