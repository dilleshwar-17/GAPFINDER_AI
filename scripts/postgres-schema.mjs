export function postgresSchemaFromSource(source) {
  const match = source.match(/export const SCHEMA_SQL = String\.raw`([\s\S]*?)`;/);
  if (!match) throw new Error("Could not find SCHEMA_SQL in src/lib/db/schema.ts.");

  const schema = match[1]
    .replace(/\bPRAGMA\s+foreign_keys\s*=\s*ON\s*;?/gi, "")
    .replace(/\bBLOB\b/g, "BYTEA");
  if (/\bPRAGMA\b|\bBLOB\b/i.test(schema)) {
    throw new Error("SQLite-only schema syntax remains in the PostgreSQL migration.");
  }
  return schema;
}
