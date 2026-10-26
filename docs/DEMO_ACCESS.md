# Demo Access

The demo is a **dedicated, seeded account** that a reviewer enters through a
button. There is no published demo password, and the account cannot be entered
through the normal password form.

---

## How to enter

1. Start the app (`npm run dev`, or `npm start` after a build).
2. Open **`/demo-access`**.
3. Choose **Enter the demo workspace** (also available on the landing page and
   sign-in page).
4. The browser posts to `POST /api/auth/demo`. In local mode the server:
   - rate-limits the request (6 per 10 minutes per IP),
   - provisions the demo user if it does not exist,
   - seeds the workspace idempotently if it is not already seeded,
   - creates a normal server session and sets the `gf_session` cookie,
   - returns `{ destination: "/dashboard" }`.

When Supabase Auth is configured, the endpoint instead signs in the configured
Supabase demo user using `SUPABASE_DEMO_EMAIL` and the server-only
`SUPABASE_DEMO_PASSWORD`. The server marks the exact configured email as a
demo account in the application database; trusted `app_metadata.is_demo=true`
and an existing demo flag are also honored. The endpoint refuses a Supabase
identity not marked as demo. This production path still depends on application
data in the local SQLite database and is therefore not suitable for Vercel
until the data layer is migrated.

No credential is displayed, logged, or returned. In local mode the account's
password is a random 32-byte value stored only as a scrypt hash, so the ordinary
login form cannot be used to enter it. In Supabase mode the demo password is a
server-only environment value and Supabase manages the credential.

If the demo is disabled (`DISABLE_DEMO=1`), the route returns a conflict and the
UI explains that the demo is unavailable. If `DEMO_EMAIL` is already used by a
non-demo account, provisioning refuses with a conflict instead of taking over
that account.

---

## What the seeded workspace contains

One subject: **“Biology: Cells and Energy”**, with an exam date 21 days in the
future.

Three original seeded sources (plain text, chunked and embedded like any other
upload):

| File | Kind | Content |
| --- | --- | --- |
| `demo-syllabus.txt` | syllabus | Unit 1 cell structure (cell membrane, organelles); Unit 2 energy transfer (photosynthesis, cellular respiration) |
| `demo-notes.txt` | notes | Four sections on membrane transport, organelles, photosynthesis, and respiration, including the Calvin cycle, glycolysis, Krebs cycle and oxidative phosphorylation |
| `demo-past-paper.txt` | past paper | Three exam-style prompts with marking guidance |

The topic map is extracted deterministically from the syllabus headings, so the
topics correspond to real headings in the seeded document.

The seed also creates:

- a **baseline submitted diagnostic** (`generator = demo-seed`) with a coherent
  per-topic answer pattern,
- a **follow-up submitted diagnostic** (`generator = demo-seed-followup`) that
  changes the evidence picture, so mastery change and plan adaptation are
  visible,
- an **active revision plan** (60 minutes/day, 45-minute sessions) with pending
  tasks,
- mastery snapshots for the assessed topics.

Everything is computed through the real services (`startDiagnostic`,
`submitAttempt`, `createRevisionPlan`), not inserted as fake UI values. Sample
citations therefore resolve to the seeded documents and the pages/chunks they
actually came from.

Seeding is **idempotent**: entering the demo again reuses the existing user and
subject, retries failed documents, and only creates missing attempts/plans. It
does not duplicate the workspace.

---

## What a visitor can do

Interactive (normal service calls, session-scoped):

- browse the dashboard, subjects, topic map, materials, document detail,
  diagnostics, results, reports, revision plan, learn pages, BUDDY,
  progress and settings;
- start a **practice** diagnostic and answer it;
- ask BUDDY grounded questions, dictate a question, hear the reply read aloud,
  and inspect citations.

Practice submissions by demo visitors are scored and stored, but the demo path
skips both mastery-snapshot refresh and plan refresh. Practice therefore **does
not** add mastery history, move the shared baseline, or rewrite the active plan.
The internal `allowDemo` option is reserved for the seeding routine, which builds
the reference workspace deliberately. This keeps the workspace coherent for the
next visitor. Practice attempts are visible to later visitors because the demo is
one shared owner.

## What is blocked

Writes are blocked **on the server** by `assertWritableAccount`, not only by
disabled buttons:

- material uploads;
- document delete and reprocess;
- subject create, update and delete;
- topic extraction and manual topic creation;
- preferences changes;
- revision plan creation/refresh and task completion;
- profile (display name) changes;
- password changes.

Attempting a resource write (uploads, subject/topic/plan/task changes) returns
`403 FORBIDDEN`. Preference and profile updates return `409 CONFLICT`, and a
password change returns `403`. Every message explains that the shared demo is
read-only and a personal account is needed. The UI disables the corresponding
controls and shows the same explanation.

The app shell shows a persistent **“shared demo”** banner so a reviewer is never
in doubt about which workspace they are in.

---

## How the demo is secured

- **No published secret.** No password is printed, returned by the API, or
  written to logs.
- **Normal session issuance.** Local mode uses the same hashed, expiring,
  `HttpOnly` session as other accounts; Supabase mode uses its SSR auth session.
- **Rate limited.** Repeated demo entry is throttled.
- **Read-only shared data.** One visitor cannot delete sources or overwrite the
  seeded plan.
- **No cross-account access.** The demo is an ordinary owner; it sees only its
  own rows.
- **Reserved email.** Registration refuses the demo email so a normal account
  cannot shadow it.

---

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `DISABLE_DEMO` | `0` | Set to `1` to disable demo entry and provisioning |
| `DEMO_EMAIL` | `demo@gapfinder.local` | Local mode reserved demo address |
| `SUPABASE_DEMO_EMAIL` | unset | Supabase Auth demo account email |
| `SUPABASE_DEMO_PASSWORD` | unset | Server-only secret for Supabase demo sign-in |

The email must be changed together with the database if you want a different
demo identity; a stale demo user with the old email remains a normal row.

---

## Resetting the demo

The local demo lives in the same SQLite database as everything else. To rebuild
it from scratch:

```bash
# stop the server first
npm run db:reset
npm run dev
# then open /demo-access again
```

`npm run db:reset` deletes the configured database file. The next demo entry
provisions a new account and re-seeds the workspace.

---

## Verification performed

- `POST /api/auth/demo` in the production smoke run returned `200` and set a
  session cookie.
- The dashboard rendered with the shared-demo banner.
- A seeded subject ID was discovered from the dashboard and every seeded dynamic
  page rendered: topic map, learn, materials, document detail, reports, revision
  plan, assistant, progress, diagnostics and results.
- The assistant, given a seeded topic, returned citations that all named an
  authorised seeded document.
- Demo subject creation returned `403`.
- A practice diagnostic could be started (interactive behaviour preserved).
- Logout removed the session and the stale cookie could not render dashboard
  data.

No real learner data is used in the demo.
