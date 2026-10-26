import { describe, expect, it } from "vitest";
import {
  CitationValidationError,
  allCitationsValid,
  citationView,
  excerpt,
  resolveQuestionSources,
  validateCitationIds,
} from "@/lib/domain/citations";
import type { EvidenceChunk } from "@/lib/domain/types";

function evidence(id: string, overrides: Partial<EvidenceChunk> = {}): EvidenceChunk {
  return {
    chunkId: id,
    documentId: "doc-1",
    documentTitle: "biology-notes.pdf",
    documentKind: "notes",
    pageNumber: 4,
    sectionHeading: "Unit 1",
    text: "Chlorophyll absorbs light energy in the thylakoid membrane.",
    semanticScore: 0.8,
    lexicalScore: 0.6,
    score: 0.75,
    rank: 1,
    ...overrides,
  };
}

describe("excerpt", () => {
  it("collapses whitespace", () => {
    expect(excerpt("a   b\n c")).toBe("a b c");
  });

  it("truncates at a word boundary and appends a period", () => {
    const text = "word ".repeat(200);
    const result = excerpt(text, 60);
    expect(result.length).toBeLessThanOrEqual(61);
    expect(result.endsWith("…")).toBe(true);
    expect(result.trimEnd()).toBe(result);
  });
});

describe("citationView", () => {
  it("maps an evidence chunk to a display citation", () => {
    const view = citationView(evidence("chunk-1"));
    expect(view).toMatchObject({
      chunkId: "chunk-1",
      documentId: "doc-1",
      documentTitle: "biology-notes.pdf",
      pageNumber: 4,
      sectionHeading: "Unit 1",
    });
    expect(view.excerpt).toContain("Chlorophyll");
  });
});

describe("validateCitationIds", () => {
  it("accepts only retrieved chunk ids", () => {
    const result = validateCitationIds(["chunk-1", "invented"], [evidence("chunk-1")]);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.chunkId).toBe("chunk-1");
    expect(result.invalidIds).toEqual(["invented"]);
  });

  it("deduplicates repeated ids", () => {
    const result = validateCitationIds(["chunk-1", "chunk-1"], [evidence("chunk-1")]);
    expect(result.citations).toHaveLength(1);
  });

  it("reports invented page numbers as the real chunk's values", () => {
    const result = validateCitationIds(["chunk-1"], [evidence("chunk-1", { pageNumber: 9 })]);
    expect(result.citations[0]?.pageNumber).toBe(9);
  });
});

describe("resolveQuestionSources", () => {
  it("throws when no source is cited", () => {
    expect(() => resolveQuestionSources([], [evidence("chunk-1")])).toThrow(
      CitationValidationError,
    );
  });

  it("throws when a citation is not in the retrieved set", () => {
    try {
      resolveQuestionSources(["chunk-2"], [evidence("chunk-1")]);
      throw new Error("expected validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(CitationValidationError);
      expect((error as CitationValidationError).invalidIds).toEqual(["chunk-2"]);
    }
  });

  it("returns the matching chunks in retrieval order", () => {
    const chunks = [evidence("chunk-1"), evidence("chunk-2")];
    const resolved = resolveQuestionSources(["chunk-2"], chunks);
    expect(resolved.chunks.map((chunk) => chunk.chunkId)).toEqual(["chunk-2"]);
    expect(resolved.sources).toHaveLength(1);
  });
});

describe("allCitationsValid", () => {
  it("is false for an empty list only when ids are unknown", () => {
    expect(allCitationsValid([], [evidence("chunk-1")])).toBe(true);
    expect(allCitationsValid(["unknown"], [evidence("chunk-1")])).toBe(false);
  });
});
