import fs from "node:fs";
const p = "README.md";
let r = fs.readFileSync(p, "utf8");
const idx = r.indexOf("## Interface notes");
if (idx >= 0) {
  let end = r.indexOf("\r\n\r\n---", idx);
  if (end < 0) end = r.indexOf("\n\n---", idx);
  const rep = `## Interface notes

- Typography is **Onest**, bundled locally through \`@fontsource-variable/onest\`.
- The palette uses a violet brand scale (\`#7a5af8\` / \`#6938ef\`) with gray neutrals; status colours stay semantic (weak red, developing amber, strong green) so a brand change cannot make a band unreadable.
- A theme toggle in the public header, mobile bar and desktop sidebar switches light/dark and persists the choice in \`localStorage\`; the root layout applies it before paint to avoid a flash.
- BUDDY (the assistant at /assistant) shows a live dictation transcript panel while you speak, supports editable dictation through the browser Speech Recognition API, and speaks replies with \`speechSynthesis\`. A fixed caption dock highlights the current word from \`onboundary\` events where supported, with a fallback when they are not reported. It also exposes a per-answer **Listen** control and a **Read aloud** toggle.
- Hot paths use cached prepared statements, WAL with \`synchronous=NORMAL\`, grouped subject aggregates instead of per-subject queries, request-scoped session caching, and added lookup indexes.

## Environment variables

Copy \`.env.example\` to \`.env.local\` for local development. All variables are server-side only.

| Variable | Default | Required | Notes |
| --- | --- | --- | --- |
| \`DATABASE_PATH\` | \`data/gapfinder.db\` | no | Use \`:memory:\` for tests; directory is created automatically. |
| \`GEMINI_API_KEY\` | unset | no | Without it, deterministic fallbacks are used. |
| \`GEMINI_MODEL\` | \`gemini-2.5-flash\` | no | |
| \`EMBEDDING_PROVIDER\` | auto | no | \`local\` forces offline hash embeddings. |
| \`EMBEDDING_MODEL\` | \`gemini-embedding-001\` | no | |
| \`EMBEDDING_DIMENSIONS\` | \`768\` | no | 128–3072 |
| \`LOCAL_EMBEDDING_DIMENSIONS\` | \`512\` | no | 64–2048 |
| \`MAX_UPLOAD_MB\` | \`8\` | no | 1–25 |
| \`RETRIEVAL_TOP_K\` | \`6\` | no | Fallback for BUDDY; diagnostics use \`8\`. |
| \`RETRIEVAL_MIN_SCORE\` | \`0.15\` | no | 0–1 |
| \`MIN_EVIDENCE_CHARS\` | \`240\` | no | 40–4000 |
| \`SESSION_TTL_DAYS\` | \`7\` | no | 1–30 |
| \`DISABLE_DEMO\` | \`0\` | no | Set to \`1\` to disable demo entry. |
| \`DEMO_EMAIL\` | \`demo@gapfinder.local\` | no | Reserved demo address. |

## Database reset

\`\`\`bash
npm run db:reset
\`\`\`

This deletes the configured SQLite file (\`DATABASE_PATH\`, default \`data/gapfinder.db\`). The next run creates a fresh schema on first use. To rebuild the shared demo, open \`/demo-access\` after reset.

## Deployment

- **Local / self-hosted:** \`npm run build && npm start\` (set \`PORT\` and \`DATABASE_PATH\` to a writable location).
- **Platform notes:** \`node:sqlite\` needs a writable disk. Serverless platforms cannot rely on a shared local file between invocations; use Postgres with a vector store for durable production. There are no deployment credentials or hosted target in this repo. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full checklist and blockers.

## Troubleshooting

- **Node version:** requires Node >= 22.5 because of \`node:sqlite\`. Verify with \`node -v\`.
- **Voice not working:** Speech Recognition/synthesis depend on the browser and OS. If controls are disabled, type the question — no feature requires voice.
- **Empty retrieval / abstentions:** Ensure material is uploaded, extracted and \`ready\`, or try re-processing after a provider change.
- **Demo missing:** Check \`DISABLE_DEMO\` and that \`/api/auth/demo\` is not rate-limited. Run \`npm run db:reset\` to rebuild it.
- **Port already in use:** Set \`PORT\` or stop the existing process.
`;
  r = r.slice(0, idx) + rep + r.slice(end);
  fs.writeFileSync(p, r);
  console.log("done");
} else console.log("not found");
