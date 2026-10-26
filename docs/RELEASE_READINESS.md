# Release Readiness

**Status: NOT READY for production Vercel deployment.**

## Verified

- Next.js 16.4.3 production build passes after consolidating Next's
  `middleware.ts`/`proxy.ts` entry point.
- `npm run lint` and `npm run typecheck` pass.
- `npm test` passes: 9 test files, 130 tests. This is an offline suite using
  in-memory SQLite and deterministic providers.
- Supabase Auth flows are wired in code and the SSR proxy validates configured
  provider identity; live Supabase verification is still required.
- Blue glassmorphism styling is shared across public and signed-in layouts and
  was visually inspected on a desktop browser.

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
5. **Production verification:** smoke, ownership, upload/RAG/citation, mobile,
   accessibility, load, and concurrency tests against a durable preview
   deployment have not been run.
6. **Operations:** no deployment, backup/restore, alerting, or rollback
   verification was performed.

## Approval gate

Do not deploy or claim production readiness until the application data/storage
layer is durable, all Supabase auth and ownership flows pass against a
non-production project, regression and production-build checks pass, and an
authorized preview deployment is verified end-to-end.
