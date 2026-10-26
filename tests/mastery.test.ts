import { describe, expect, it } from "vitest";
import {
  EVIDENCE_RULES,
  MASTERY_METHOD_VERSION,
  classifyMastery,
  computeTopicMastery,
  masteryBandLabel,
  masteryChange,
} from "@/lib/domain/mastery";
import type { AnswerEvidence, Difficulty } from "@/lib/domain/types";

function answer(overrides: Partial<AnswerEvidence> = {}): AnswerEvidence {
  return {
    topicId: "topic-1",
    questionId: "question-1",
    attemptId: "attempt-1",
    score: 1,
    maxMarks: 1,
    difficulty: "easy" as Difficulty,
    submittedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("classifyMastery", () => {
  it("uses an inclusive weak band up to 49", () => {
    expect(classifyMastery(0, true)).toBe("weak");
    expect(classifyMastery(49, true)).toBe("weak");
  });

  it("starts developing at exactly 50 and ends at 79", () => {
    expect(classifyMastery(50, true)).toBe("developing");
    expect(classifyMastery(79, true)).toBe("developing");
  });

  it("starts strong at exactly 80", () => {
    expect(classifyMastery(80, true)).toBe("strong");
    expect(classifyMastery(100, true)).toBe("strong");
  });

  it("returns not_assessed when evidence is insufficient", () => {
    expect(classifyMastery(95, false)).toBe("not_assessed");
  });

  it("returns not_assessed for a missing or impossible value", () => {
    expect(classifyMastery(null, true)).toBe("not_assessed");
    expect(classifyMastery(-1, true)).toBe("not_assessed");
    expect(classifyMastery(101, true)).toBe("not_assessed");
  });
});

describe("computeTopicMastery", () => {
  it("returns not_assessed for an empty answer set", () => {
    const result = computeTopicMastery([]);
    expect(result).toMatchObject({
      mastery: null,
      classification: "not_assessed",
      sufficient: false,
      evidenceAnswers: 0,
      evidenceMarks: 0,
      distinctQuestions: 0,
    });
  });

  it("withholds a band when a single answer meets the marks minimum", () => {
    const result = computeTopicMastery([
      answer({ questionId: "q-1", score: 4, maxMarks: 4 }),
    ]);
    expect(result.sufficient).toBe(false);
    expect(result.classification).toBe("not_assessed");
    expect(result.mastery).toBe(100);
  });

  it("withholds a band when total marks are below the minimum", () => {
    const result = computeTopicMastery([
      answer({ questionId: "q-1", score: 1, maxMarks: 1 }),
      answer({ questionId: "q-2", score: 1, maxMarks: 1 }),
    ]);
    expect(result.sufficient).toBe(false);
    expect(result.classification).toBe("not_assessed");
  });

  it("withholds a band when only one distinct question was answered", () => {
    const result = computeTopicMastery([
      answer({ questionId: "q-1", score: 2, maxMarks: 2 }),
      answer({ questionId: "q-1", score: 2, maxMarks: 2 }),
    ]);
    expect(result.distinctQuestions).toBe(1);
    expect(result.sufficient).toBe(false);
  });

  it("awards a band once the evidence minimum is met", () => {
    const result = computeTopicMastery([
      answer({ questionId: "q-1", score: 2, maxMarks: 2 }),
      answer({ questionId: "q-2", score: 1, maxMarks: 1 }),
    ]);
    expect(result.sufficient).toBe(true);
    expect(result.evidenceAnswers).toBe(2);
    expect(result.evidenceMarks).toBe(EVIDENCE_RULES.minMarks);
    expect(result.classification).toBe("strong");
  });

  it("weights hard questions more heavily than easy ones", () => {
    const result = computeTopicMastery([
      answer({ questionId: "q-1", score: 2, maxMarks: 2, difficulty: "easy" }),
      answer({ questionId: "q-2", score: 1, maxMarks: 4, difficulty: "hard" }),
    ]);
    // Unweighted would be 3/6 = 50 (developing); difficulty weighting gives 44.
    expect(result.mastery).toBe(44);
    expect(result.classification).toBe("weak");
  });

  it("caps earned marks at the question maximum", () => {
    const result = computeTopicMastery([
      answer({ questionId: "q-1", score: 10, maxMarks: 1 }),
      answer({ questionId: "q-2", score: 1, maxMarks: 1 }),
    ]);
    expect(result.mastery).toBe(100);
  });

  it("ignores negative marks", () => {
    const result = computeTopicMastery([
      answer({ questionId: "q-1", score: -3, maxMarks: 1 }),
      answer({ questionId: "q-2", score: 1, maxMarks: 1 }),
    ]);
    expect(result.mastery).toBe(50);
  });

  it("produces a mastery value of null when every question has zero marks", () => {
    const result = computeTopicMastery([
      answer({ questionId: "q-1", score: 0, maxMarks: 0 }),
      answer({ questionId: "q-2", score: 0, maxMarks: 0 }),
    ]);
    expect(result.mastery).toBeNull();
    expect(result.classification).toBe("not_assessed");
  });
});

describe("masteryBandLabel", () => {
  it("labels every classification", () => {
    expect(masteryBandLabel("weak")).toBe("Weak");
    expect(masteryBandLabel("developing")).toBe("Developing");
    expect(masteryBandLabel("strong")).toBe("Strong");
    expect(masteryBandLabel("not_assessed")).toBe("Not assessed");
  });
});

describe("masteryChange", () => {
  it("returns null when either side is unmeasured", () => {
    expect(masteryChange(null, 60)).toBeNull();
    expect(masteryChange(40, null)).toBeNull();
  });

  it("returns the signed difference", () => {
    expect(masteryChange(42, 61)).toBe(19);
    expect(masteryChange(80, 75)).toBe(-5);
  });
});

describe("mastery method version", () => {
  it("is recorded so historical snapshots stay interpretable", () => {
    expect(MASTERY_METHOD_VERSION).toBe("weighted-marks-v1");
  });
});
