#!/usr/bin/env node
/**
 * Deletes the local SQLite database so the next server start recreates an empty
 * schema. This is a development utility only.
 *
 * Usage:
 *   node scripts/reset-db.mjs --yes
 *   DATABASE_PATH=./data/other.db node scripts/reset-db.mjs --yes
 */
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const confirmed = args.has("--yes") || args.has("-y");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset the database with NODE_ENV=production.");
  process.exit(1);
}

const configured = process.env.DATABASE_PATH?.trim();
if (configured === ":memory:") {
  console.log("DATABASE_PATH is :memory: — there is no file to reset.");
  process.exit(0);
}

const target = configured
  ? path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured)
  : path.join(process.cwd(), "data", "gapfinder.db");

const targets = [target, `${target}-wal`, `${target}-shm`];
const existing = targets.filter((file) => fs.existsSync(file));

if (existing.length === 0) {
  console.log(`Nothing to remove at ${target}. The next start will create an empty database.`);
  process.exit(0);
}

if (!confirmed) {
  console.error("This deletes all local accounts, subjects, documents and evidence.");
  console.error(`Target: ${target}`);
  console.error("Re-run with --yes to confirm.");
  process.exit(1);
}

for (const file of existing) {
  fs.rmSync(file, { force: true });
  console.log(`Removed ${path.relative(process.cwd(), file) || file}`);
}

console.log("Database reset. Start the server to apply the schema.");
