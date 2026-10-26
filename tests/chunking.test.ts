import { describe, expect, it } from "vitest";
import {
  CHUNKING_CONFIG,
  chunkPages,
  detectHeading,
  normalizeText,
} from "@/lib/domain/chunking";

describe("normalizeText", () => {
  it("collapses windows newlines, tabs and repeated blank lines", () => {
    expect(normalizeText("a\r\n\r\n\r\nb\t c")).toBe("a\n\nb c");
  });

  it("strips null bytes and non-breaking spaces", () => {
    expect(normalizeText("a\u0000b\u00a0c")).toBe("ab c");
  });
});

describe("detectHeading", () => {
  it("recognises labelled unit and chapter headings", () => {
    expect(detectHeading("UNIT 2")).toBe("Unit 2");
    expect(detectHeading("Chapter 3: Cell division")).toBe("Chapter 3: Cell division");
  });

  it("recognises numbered syllabus headings", () => {
    expect(detectHeading("2.1 Light-dependent reactions")).toBe("2.1 Light-dependent reactions");
  });

  it("recognises markdown headings", () => {
    expect(detectHeading("## Transport in plants")).toBe("Transport in plants");
  });

  it("does not treat prose sentences as headings", () => {
    expect(detectHeading("Photosynthesis converts light energy into chemical energy.")).toBeNull();
    expect(detectHeading("This is a normal sentence that keeps going for a while.")).toBeNull();
  });

  it("rejects long lines", () => {
    expect(detectHeading("A".repeat(120))).toBeNull();
  });
});

describe("chunkPages", () => {
  const paragraphs = Array.from(
    { length: 12 },
    (_, index) =>
      `Paragraph ${index + 1}. Photosynthesis stores energy in glucose and releases oxygen as a by-product of the light reactions.`,
  );

  it("never spans two pages and preserves page provenance", () => {
    const secondPage = paragraphs.map(
      (paragraph) => `Page two, ${paragraph} Additional context continues here.`,
    );
    const chunks = chunkPages([
      { pageNumber: 1, text: paragraphs.join("\n\n") },
      { pageNumber: 2, text: secondPage.join("\n\n") },
    ]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(new Set(chunks.map((chunk) => chunk.pageNumber))).toEqual(new Set([1, 2]));
    for (const chunk of chunks) {
      expect([1, 2]).toContain(chunk.pageNumber);
      expect(chunk.charStart).not.toBeNull();
      expect(chunk.charEnd).not.toBeNull();
      expect(chunk.charEnd as number).toBeGreaterThanOrEqual(chunk.charStart as number);
    }
  });

  it("records the active heading on the chunk", () => {
    const chunks = chunkPages([
      {
        pageNumber: 1,
        text: ["# Unit 1", paragraphs.slice(0, 6).join("\n\n")].join("\n\n"),
      },
    ]);
    expect(chunks[0]?.sectionHeading).toBe("Unit 1");
  });

  it("keeps chunks within the soft ceiling apart from page tails", () => {
    const chunks = chunkPages([{ pageNumber: null, text: paragraphs.join("\n\n") }]);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(
        Math.round(CHUNKING_CONFIG.maxChars * 1.3) + CHUNKING_CONFIG.overlapChars,
      );
    }
  });

  it("keeps section headings when a small chunk is merged into the previous one", () => {
    const body = "This short paragraph is long enough to survive the minimum chunk check but short enough to be merged with its neighbour.";
    const chunks = chunkPages([
      {
        pageNumber: 1,
        text: ["# Section one", body, "# Section two", `${body} Extra detail.`].join("\n\n"),
      },
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain("Section one");
    expect(chunks[0]?.text).toContain("Section two");
  });

  it("drops duplicate content across pages", () => {
    const text = paragraphs.slice(0, 4).join("\n\n");
    const chunks = chunkPages([
      { pageNumber: 1, text },
      { pageNumber: 2, text },
    ]);
    const hashes = chunks.map((chunk) => chunk.contentHash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("returns nothing for blank input", () => {
    expect(chunkPages([{ pageNumber: 1, text: "   \n\n  " }])).toEqual([]);
  });

  it("assigns sequential chunk indexes", () => {
    const chunks = chunkPages([{ pageNumber: 3, text: paragraphs.join("\n\n") }]);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index),
    );
  });
});
