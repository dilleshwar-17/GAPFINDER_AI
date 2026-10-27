# Demo Access

The demo creates a **private, temporary workspace for each visitor**. It does
not sign visitors into a shared account or expose a demo password.

## Entering and ending a demo

1. Start the app (`npm run dev`, or `npm start` after a build).
2. Open `/demo-access` and choose **Enter the demo workspace**.
3. `POST /api/auth/demo` rate-limits the request, creates a uniquely named
   temporary user, seeds its workspace, creates a four-hour server session and
   sets the `gf_session` browser-session cookie.
4. Choose **End demo** to delete the workspace immediately. Closing the tab
   sends a best-effort same-origin cleanup request.

The workspace is isolated by its unique owner ID. The session cookie is
HTTP-only, and session tokens are stored as hashes. An expired session cannot
read or change workspace data. If a browser closes before its cleanup request
completes, the data remains inaccessible after the four-hour session expiry and
is removed by cleanup on a later demo launch. The application does not promise
instant deletion when the browser is forcibly terminated or database backups,
provider logs, and infrastructure retention outside the application.

`DISABLE_DEMO=1` disables demo entry. Entry is rate-limited to six requests per
10 minutes per client key. The endpoint does not expose a generated password or
return a session token in its JSON response.

## Seeded workspace

Each visitor receives these three subjects:

| Subject | Focus |
| --- | --- |
| Biology: Cells and Energy | Cell structure, photosynthesis and respiration |
| Algebra: Functions and Equations | Linear and quadratic functions, equations and systems |
| Climate Science: Earth Systems | Climate processes, evidence and ecosystems |

Each subject starts with five original text materials: a syllabus, notes,
practice paper, worked examples and glossary. The content is processed through
the normal extraction, chunking, embedding and topic-map services. Each subject
also has a baseline diagnostic, assessed mastery and a revision plan; Biology
has a follow-up diagnostic to demonstrate changes in mastery and planning.
Generated questions, answers, reports, plans and citations use the same
application services and stored source chunks as a learner workspace.

The demo permits up to five materials per subject. Visitors can upload,
reprocess and delete their own materials, create and edit subjects, extract and
add topics, take diagnostics, update settings, regenerate plans, complete
tasks, use reports and ask BUDDY questions. Temporary demo accounts cannot
change passwords.

## Isolation and cleanup

- Each launch creates a new user and new sample data; another visitor's demo
  account is never reused.
- Application reads and writes continue to use normal owner-scoped service
  queries and server-side authorization.
- Explicit logout deletes the temporary user, and foreign-key cascades remove
  its sessions and owned workspace data.
- Browser tab-close cleanup uses `navigator.sendBeacon`, which is best effort.
- The server session expires after four hours. A later demo launch removes old
  temporary accounts that have no unexpired session.
- No demo-specific content is intentionally stored in browser local storage.
- Database backups and provider/infrastructure retention are governed by those
  services and are not erased by deleting the application workspace.

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `DISABLE_DEMO` | `0` | Set to `1` to disable demo entry |

`DEMO_EMAIL`, `SUPABASE_DEMO_EMAIL` and `SUPABASE_DEMO_PASSWORD` are not used to
create the temporary interactive demo. Regular Supabase-authenticated accounts
continue to use Supabase; demo sessions use the application's short-lived,
server-validated session.

## Verification

`tests/demo-workspace.test.ts` verifies that the seeded workspace contains
three subjects with five ready, chunked materials each, usable topic maps and
revision plans; enforces the five-material limit; checks workspace deletion;
and checks expired-session cleanup. These tests run against the test suite's
in-memory SQLite database and deterministic local embeddings. They do not
contact hosted AI providers or production data.
