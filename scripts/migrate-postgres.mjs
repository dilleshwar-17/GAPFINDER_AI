import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { postgresSchemaFromSource } from "./postgres-schema.mjs";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Add it securely before running this migration.");
}

const connectionUrl = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(connectionUrl.protocol)) {
  throw new Error("DATABASE_URL must use the postgres:// or postgresql:// scheme.");
}

const source = await readFile(new URL("../src/lib/db/schema.ts", import.meta.url), "utf8");
const schema = postgresSchemaFromSource(source);
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(connectionUrl.hostname);
const client = new Client({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: true },
});

await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const applied = await client.query(
    "SELECT version FROM schema_migrations WHERE version = $1",
    ["001_initial_schema"],
  );
  if (applied.rowCount) {
    await client.query("COMMIT");
    console.log("PostgreSQL migration 001_initial_schema is already applied.");
  } else {
    await client.query(schema);
    await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [
      "001_initial_schema",
    ]);
    await client.query("COMMIT");
    console.log("Applied non-destructive PostgreSQL migration 001_initial_schema.");
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
