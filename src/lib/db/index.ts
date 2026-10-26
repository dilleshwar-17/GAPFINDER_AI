import { DatabaseSync, type StatementSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool, types, type PoolClient } from "pg";
import { SCHEMA_SQL } from "./schema";

/**
 * SQLite remains the local-development backend; DATABASE_URL selects hosted
 * PostgreSQL. Both backends expose the same parameterized SQL interface.
 */
const SCHEMA_VERSION = 2;
const GLOBAL_KEY = "__gapfinder_db__";

export type SqlParam = string | number | bigint | null | Uint8Array;

export type MaybePromise<T> = T | Promise<T>;

export interface Queryable {
  all<T>(sql: string, ...params: SqlParam[]): MaybePromise<T[]>;
  get<T>(sql: string, ...params: SqlParam[]): MaybePromise<T | undefined>;
  run(sql: string, ...params: SqlParam[]): MaybePromise<{ changes: number | bigint }>;
}

type TransactionContext =
  | { kind: "postgres"; client: PoolClient }
  | { kind: "sqlite" };

const transactionContext = new AsyncLocalStorage<TransactionContext>();
let postgresPool: Pool | null = null;
let sqliteTransactionQueue: Promise<void> = Promise.resolve();
let sqliteTransactionBarrier: Promise<void> | null = null;

types.setTypeParser(types.builtins.INT8, (value) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError("PostgreSQL BIGINT value exceeds JavaScript's safe integer range.");
  }
  return parsed;
});

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getPostgresPool(): Pool {
  if (postgresPool) return postgresPool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL storage.");

  const url = new URL(connectionString);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres:// or postgresql:// scheme.");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  postgresPool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ssl: localHost ? undefined : { rejectUnauthorized: true },
  });
  return postgresPool;
}

export function postgresPlaceholders(sql: string): string {
  let result = "";
  let parameterIndex = 0;
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      result += character;
      if (character === quote) {
        if (sql[index + 1] === quote) {
          result += sql[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      result += character;
      continue;
    }
    if (character === "?") {
      result += `$${++parameterIndex}`;
      continue;
    }
    result += character;
  }
  return result;
}

function queryPostgres<Row>(
  sql: string,
  params: SqlParam[],
): Promise<{ rows: Row[]; rowCount: number | null }> {
  const context = transactionContext.getStore();
  const values = params.map((param) => (param instanceof Uint8Array ? Buffer.from(param) : param));
  const query = context?.kind === "postgres"
    ? context.client.query(postgresPlaceholders(sql), values)
    : getPostgresPool().query(postgresPlaceholders(sql), values);
  return query.then((result) => ({
    rows: result.rows as Row[],
    rowCount: result.rowCount,
  }));
}

function querySqlite<Row>(fn: () => Row): MaybePromise<Row> {
  if (!sqliteTransactionBarrier || transactionContext.getStore()?.kind === "sqlite") {
    return fn();
  }
  return sqliteTransactionBarrier.then(fn);
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
    database.exec("PRAGMA synchronous = NORMAL;");
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA cache_size = -20000;");
    database.exec("PRAGMA temp_store = MEMORY;");
  }
  const schema = SCHEMA_SQL;
  database.exec(schema);

  const userColumns = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === "auth_user_id")) {
    database.exec("ALTER TABLE users ADD COLUMN auth_user_id TEXT;");
    database.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;",
    );
  }
  database.exec("PRAGMA user_version = " + SCHEMA_VERSION + ";");
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
  all<T>(sql: string, ...params: SqlParam[]): MaybePromise<T[]> {
    if (isPostgresConfigured()) {
      return queryPostgres<T>(sql, params).then((result) => result.rows);
    }
    return querySqlite(() => getStatement(sql).all(...params) as unknown as T[]);
  },
  get<T>(sql: string, ...params: SqlParam[]): MaybePromise<T | undefined> {
    if (isPostgresConfigured()) {
      return queryPostgres<T>(sql, params).then((result) => result.rows[0]);
    }
    return querySqlite(() => getStatement(sql).get(...params) as unknown as T | undefined);
  },
  run(sql: string, ...params: SqlParam[]): MaybePromise<{ changes: number | bigint }> {
    if (isPostgresConfigured()) {
      return queryPostgres(sql, params).then((result) => ({ changes: result.rowCount ?? 0 }));
    }
    return querySqlite(() => {
      const result = getStatement(sql).run(...params);
      return { changes: Number(result.changes) };
    });
  },
};

export function transaction<T>(fn: () => MaybePromise<T>): MaybePromise<T> {
  const context = transactionContext.getStore();
  if (isPostgresConfigured()) {
    if (context?.kind === "postgres") return Promise.resolve(fn());
    return (async () => {
      const client = await getPostgresPool().connect();
      try {
        await client.query("BEGIN");
        const result = await transactionContext.run({ kind: "postgres", client }, fn);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    })();
  }

  if (context?.kind === "sqlite") return fn();
  const queued = sqliteTransactionQueue;
  let releaseQueue!: () => void;
  sqliteTransactionQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  return queued.then(async () => {
    let releaseBarrier!: () => void;
    sqliteTransactionBarrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const connection = getConnection();
    connection.exec("BEGIN IMMEDIATE");
    try {
      const result = await transactionContext.run({ kind: "sqlite" }, fn);
      connection.exec("COMMIT");
      return result;
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    } finally {
      releaseBarrier();
      sqliteTransactionBarrier = null;
      releaseQueue();
    }
  });
}

/**
 * Prepared statements are reused for the lifetime of the process. Every page
 * render issues the same handful of queries, so re-preparing them on each call
 * is pure overhead. The cache is bounded to keep memory flat.
 */
const STATEMENT_CACHE_LIMIT = 256;
const statementCache = new Map<string, StatementSync>();

function getStatement(sql: string): StatementSync {
  const cached = statementCache.get(sql);
  if (cached) return cached;

  if (statementCache.size >= STATEMENT_CACHE_LIMIT) {
    const oldest = statementCache.keys().next().value;
    if (oldest) statementCache.delete(oldest);
  }

  const statement = getConnection().prepare(sql);
  statementCache.set(sql, statement);
  return statement;
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function resetDatabase(): void {
  if (isPostgresConfigured()) {
    throw new Error("resetDatabase is only available for local SQLite test databases.");
  }
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
