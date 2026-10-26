/**
 * Vitest bootstrap. Tests always run against an in-memory SQLite database and
 * never contact a model provider, so results are deterministic and offline.
 */
process.env.DATABASE_PATH = ":memory:";
process.env.EMBEDDING_PROVIDER = "local";
delete process.env.GEMINI_API_KEY;
process.env.DISABLE_DEMO = process.env.DISABLE_DEMO ?? "false";
