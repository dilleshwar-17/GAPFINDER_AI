import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_WEIGHT,
  correctnessFromFraction,
  evaluateConceptCoverage,
  marksFor,
  normalizeConcept,
  scoreFromFraction,
  scoreMultipleChoice,
} from "@/lib/domain/scoring";

describe("marksFor", () => {
  it("awards one mark for easy and medium multiple choice", () => {
    expect(marksFor("mcq", "easy")).toBe(1);
    expect(marksFor("mcq", "medium")).toBe(1);
  });

  it("awards two marks for hard multiple choice", () => {
    expect(marksFor("mcq", "hard")).toBe(2);
  });

  it("awards 2/3/4 marks for short answers by difficulty", () => {
    expect(marksFor("short_answer", "easy")).toBe(2);
    expect(marksFor("short_answer", "medium")).toBe(3);
    expect(marksFor("short_answer", "hard")).toBe(4);
  });

  it("keeps difficulty weights ordered", () => {
    expect(DIFFICULTY_WEIGHT.easy).toBeLessThan(DIFFICULTY_WEIGHT.medium);
    expect(DIFFICULTY_WEIGHT.medium).toBeLessThan(DIFFICULTY_WEIGHT.hard);
  });
});

describe("scoreMultipleChoice", () => {
  it("awards full marks for the correct option", () => {
    const result = scoreMultipleChoice(2, 2, 1, 4);
    expect(result).toMatchObject({ score: 1, maxMarks: 1, correctness: "correct" });
  });

  it("awards zero for a wrong option", () => {
    const result = scoreMultipleChoice(1, 2, 1, 4);
    expect(result).toMatchObject({ score: 0, correctness: "incorrect" });
  });

  it("awards zero for an unanswered question", () => {
    const result = scoreMultipleChoice(null, 2, 1, 4);
    expect(result.score).toBe(0);
    expect(result.correctness).toBe("incorrect");
  });

  it("rejects an out-of-range option index", () => {
    expect(scoreMultipleChoice(7, 2, 1, 4).score).toBe(0);
    expect(scoreMultipleChoice(-1, 2, 1, 4).score).toBe(0);
    expect(scoreMultipleChoice(1.5, 2, 1, 4).score).toBe(0);
  });

  it("treats an invalid stored answer key as unattemptable", () => {
    const result = scoreMultipleChoice(1, null, 1, 4);
    expect(result.score).toBe(0);
    expect(result.feedback).toMatch(/no valid stored answer key/i);
  });

  it("never returns more than the available marks", () => {
    for (const marks of [0, 1, 2, 4]) {
      expect(scoreMultipleChoice(0, 0, marks, 4).score).toBeLessThanOrEqual(marks);
    }
  });
});

describe("scoreFromFraction", () => {
  it("rounds to the nearest half mark", () => {
    expect(scoreFromFraction(1 / 3, 3)).toBe(1);
    expect(scoreFromFraction(2 / 3, 3)).toBe(2);
    expect(scoreFromFraction(0.5, 3)).toBe(1.5);
  });

  it("clamps fractions below zero and above one", () => {
    expect(scoreFromFraction(-5, 4)).toBe(0);
    expect(scoreFromFraction(5, 4)).toBe(4);
  });

  it("never exceeds the maximum and never goes negative", () => {
    for (const fraction of [-1, 0, 0.1, 0.5, 0.99, 1, 2]) {
      for (const marks of [0, 1, 2, 3, 4]) {
        const score = scoreFromFraction(fraction, marks);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(marks);
      }
    }
  });

  it("returns zero for a non-finite fraction", () => {
    expect(scoreFromFraction(Number.NaN, 4)).toBe(0);
    expect(scoreFromFraction(Number.POSITIVE_INFINITY, 4)).toBe(0);
  });
});

describe("correctnessFromFraction", () => {
  it("maps coverage boundaries to labels", () => {
    expect(correctnessFromFraction(0)).toBe("incorrect");
    expect(correctnessFromFraction(0.39)).toBe("incorrect");
    expect(correctnessFromFraction(0.4)).toBe("partial");
    expect(correctnessFromFraction(0.84)).toBe("partial");
    expect(correctnessFromFraction(0.85)).toBe("correct");
    expect(correctnessFromFraction(1)).toBe("correct");
  });
});

describe("normalizeConcept", () => {
  it("lowercases and removes punctuation", () => {
    expect(normalizeConcept("Light-dependent: Reactions!")).toBe("light-dependent reactions");
  });
});

describe("evaluateConceptCoverage", () => {
  it("matches an exact concept phrase case-insensitively", () => {
    const result = evaluateConceptCoverage(
      "Chlorophyll absorbs light energy in the thylakoid membrane.",
      ["chlorophyll", "thylakoid membrane"],
      { marks: 4 },
    );
    expect(result.fraction).toBe(1);
    expect(result.missing).toEqual([]);
    expect(result.feedback).toContain("4/4");
  });

  it("reports missing concepts without awarding their share", () => {
    const result = evaluateConceptCoverage("Chlorophyll absorbs light.", [
      "chlorophyll",
      "thylakoid membrane",
    ]);
    expect(result.fraction).toBe(0.5);
    expect(result.matched).toEqual(["chlorophyll"]);
    expect(result.missing).toEqual(["thylakoid membrane"]);
  });

  it("scores an empty answer at zero and lists every concept", () => {
    const result = evaluateConceptCoverage("   ", ["chlorophyll", "stroma"]);
    expect(result.fraction).toBe(0);
    expect(result.missing).toEqual(["chlorophyll", "stroma"]);
  });

  it("cannot grade a question with no stored rubric", () => {
    const result = evaluateConceptCoverage("anything", []);
    expect(result.fraction).toBe(0);
    expect(result.missing).toEqual([]);
    expect(result.feedback).toMatch(/no rubric concepts/i);
  });

  it("tolerates a concept word matched by a related word form", () => {
    const result = evaluateConceptCoverage("The membranes absorb light.", [
      "membrane absorb",
    ]);
    expect(result.fraction).toBe(1);
  });

  it("keeps the estimated score within the question maximum", () => {
    const result = evaluateConceptCoverage("chlorophyll", ["chlorophyll", "glucose"], {
      marks: 3,
    });
    expect(result.feedback).toContain("/3");
  });
});
