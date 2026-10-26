import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SCHEMA_SQL } from "./schema";

/**
 * SQLite via Node's built-in driver is the implementation used for this build.
 * The schema is intentionally PostgreSQL-compatible in shape so that a hosted
 * Postgres/pgvector adapter can replace this module without changing domain logic.
 */
const SCHEMA_VERSION = 1;
const GLOBAL_KEY = "__gapfinder_db__";

export type SqlParam = string | number | bigint | null | Uint8Array;

export interface Queryable {
  all<T>(sql: string, ...params: SqlParam[]): T[];
  get<T>(sql: string, ...params: SqlParam[]): T | undefined;
  run(sql: string, ...params: SqlParam[]): { changes: number | bigint };
}

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) {
    if (configured === ":memory:") return configured;
    const absolute = path.isAbsolute(configured)
      ? configured
      : path.join(/*turbopackIgnore: true*/ process.cwd(), configured);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    return absolute;
  }
  const directory = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, "gapfinder.db");
}

export function createDatabase(databasePath: string): DatabaseSync {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  if (databasePath !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA busy_timeout = 5000;");
  }
  database.exec("PRAGMA user_version = " + SCHEMA_VERSION + ";");

  const schema = SCHEMA_SQL;
  database.exec(schema);
  return database;
}

type GlobalWithDb = typeof globalThis & {
  [GLOBAL_KEY]?: DatabaseSync;
};

export function getConnection(): DatabaseSync {
  const globalScope = globalThis as GlobalWithDb;
  if (!globalScope[GLOBAL_KEY]) {
    globalScope[GLOBAL_KEY] = createDatabase(resolveDatabasePath());
  }
  return globalScope[GLOBAL_KEY];
}

export const db: Queryable = {
  all<T>(sql: string, ...params: SqlParam[]): T[] {
    return getConnection().prepare(sql).all(...params) as unknown as T[];
  },
  get<T>(sql: string, ...params: SqlParam[]): T | undefined {
    return getConnection().prepare(sql).get(...params) as unknown as T | undefined;
  },
  run(sql: string, ...params: SqlParam[]) {
    const result = getConnection().prepare(sql).run(...params);
    return { changes: Number(result.changes) };
  },
};

export function transaction<T>(fn: () => T): T {
  const connection = getConnection();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    connection.exec("COMMIT");
    return result;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function resetDatabase(): void {
  const connection = getConnection();
  const tables = [
    "ai_events",
    "revision_tasks",
    "revision_plans",
    "mastery_snapshots",
    "answers",
    "quiz_attempts",
    "question_sources",
    "questions",
    "topic_sources",
    "topic_dependencies",
    "topics",
    "document_chunks",
    "documents",
    "subjects",
    "sessions",
    "users",
  ];
  for (const table of tables) {
    connection.exec(`DELETE FROM ${table};`);
  }
}
