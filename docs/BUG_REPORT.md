# Bug and Blocker Report

This report distinguishes repaired build issues from unresolved release
blockers. It is not a third-party security audit.

## Repaired in this working tree

| Issue | Evidence | Status |
| --- | --- | --- |
| Next.js production build rejected simultaneous `middleware.ts` and `proxy.ts` | `npm run build` initially failed with the Next.js duplicate-file error. The Supabase cookie refresh/route guard was consolidated into `src/proxy.ts`; a subsequent production build passed. | Fixed and build-verified |

## Unresolved

| Priority | Issue | Evidence / impact |
| --- | --- | --- |
| P0 | Vercel app data is not durable | `src/lib/db/index.ts` uses Node `DatabaseSync` and creates a local SQLite file. Vercel instances do not share a durable local database; learner records and uploads can be lost or diverge. |
| P0 | Supabase Auth has not been live-tested | No Supabase URL/key or email delivery project was configured. Auth code paths pass local type/build checks but have no provider integration evidence. |
| P1 | No hosted application data/storage migration | No Postgres adapter, database migration runner, Supabase Storage bucket integration, or import process exists. Existing account hashes need a password reset/set flow for migrated users. |
| P1 | Production demo cannot be considered ready | Supabase demo login requires a configured demo user and server-only credentials; application data remains local SQLite. |
| P2 | No automated browser/accessibility/load checks | Desktop appearance was inspected only; mobile behavior, keyboard/screen reader, concurrency, and load remain unverified. |

Do not deploy this working tree as a production student-data service until the
P0 blockers have been resolved and verified.
