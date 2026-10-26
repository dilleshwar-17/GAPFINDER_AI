# Bug and Blocker Report

This report distinguishes repaired build issues from unresolved release
blockers. It is not a third-party security audit.

## Repaired in this working tree

| Issue | Evidence | Status |
| --- | --- | --- |
| Next.js production build rejected simultaneous `middleware.ts` and `proxy.ts` | `npm run build` initially failed with the Next.js duplicate-file error. The Supabase cookie refresh/route guard was consolidated into `src/proxy.ts`; a subsequent production build passed. | Fixed and build-verified |
| Auth API routes could fall back to local SQLite auth in production without Supabase configuration | The proxy matcher did not cover every auth endpoint; canonical login and registration handlers selected local auth when Supabase variables were absent. `isSupabaseAuthConfigured()` now raises a safe 503 in production when configuration is missing. | Fixed; regression-tested |
| Preview Supabase Auth key name did not match the app's configuration | The Preview project had `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, while the app required only `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both key names are now accepted; an unauthenticated protected request on the updated Preview reached the expected login redirect. | Fixed; regression-tested and Preview-verified |
| Missing Supabase session returned HTTP 500 on auth pages and protected routes | Runtime logs showed `AuthSessionMissingError` being thrown from `getUser()` when no session cookie existed. The proxy and `getCurrentUser()` now treat this specific error as an anonymous session and continue to surface other Supabase errors. | Fixed; regression-tested and Preview-verified |

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
