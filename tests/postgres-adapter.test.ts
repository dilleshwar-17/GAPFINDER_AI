import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { postgresPlaceholders } from "@/lib/db";
import { types } from "pg";
import { postgresSchemaFromSource } from "../scripts/postgres-schema.mjs";

describe("PostgreSQL migration adapter", () => {
  it("numbers SQL parameters without changing quoted question marks", () => {
    expect(
      postgresPlaceholders(`SELECT ?, '?' AS literal, "?" AS identifier, 'it''s ?' AS escaped, ?`),
    ).toBe(`SELECT $1, '?' AS literal, "?" AS identifier, 'it''s ?' AS escaped, $2`);
  });

  it("parses PostgreSQL BIGINT values as safe JavaScript integers", () => {
    const parseInt8 = types.getTypeParser(types.builtins.INT8, "text");
    expect(parseInt8("42")).toBe(42);
    expect(() => parseInt8("9007199254740992")).toThrow(RangeError);
  });

  it("converts the shared SQLite schema to PostgreSQL without destructive statements", () => {
    const schema = postgresSchemaFromSource(
      "export const SCHEMA_SQL = String.raw`PRAGMA foreign_keys = ON; CREATE TABLE files (content BLOB);`;",
    );

    expect(schema).toContain("CREATE TABLE files (content BYTEA);");
    expect(schema).not.toMatch(/\bPRAGMA\b|\bBLOB\b|\bDROP\b|\bDELETE\b/i);
  });

  it("converts the actual application schema without SQLite-only types or destructive DDL", () => {
    const source = readFileSync(new URL("../src/lib/db/schema.ts", import.meta.url), "utf8");
    const schema = postgresSchemaFromSource(source);

    expect(schema).toContain("BYTEA");
    expect(schema).not.toMatch(/\bPRAGMA\b|\bBLOB\b|\bDROP\s+(?:TABLE|SCHEMA)\b|\bTRUNCATE\b/i);
  });

  it("fails explicitly if the source schema format changes unexpectedly", () => {
    expect(() => postgresSchemaFromSource("export const SCHEMA_SQL = `not raw`;")).toThrow(
      "Could not find SCHEMA_SQL",
    );
  });
});
