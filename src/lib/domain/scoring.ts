import type { Difficulty, QuestionType } from "@/lib/domain/types";

export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.5,
};

/**
 * Marks are assigned by application rules, never by the language model.
 */
export function marksFor(type: QuestionType, difficulty: Difficulty): number {
  if (type === "mcq") return difficulty === "hard" ? 2 : 1;
  if (difficulty === "easy") return 2;
  if (difficulty === "medium") return 3;
  return 4;
}

export interface McqScore {
  score: number;
  maxMarks: number;
  correctness: "correct" | "partial" | "incorrect";
  feedback: string;
}

export function scoreMultipleChoice(
  selectedIndex: number | null | undefined,
  correctIndex: number | null,
  marks: number,
  optionCount: number,
): McqScore {
  const maxMarks = Math.max(0, marks);
  if (correctIndex === null || correctIndex < 0 || correctIndex >= optionCount) {
    return {
      score: 0,
      maxMarks,
      correctness: "incorrect",
      feedback: "This question has no valid stored answer key and was scored as unattemptable.",
    };
  }
  if (selectedIndex === null || selectedIndex === undefined) {
    return {
      score: 0,
      maxMarks,
      correctness: "incorrect",
      feedback: "No option was selected. Review the source passage and try the question again.",
    };
  }
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= optionCount) {
    return {
      score: 0,
      maxMarks,
      correctness: "incorrect",
      feedback: "The submitted option was not valid for this question.",
    };
  }
  if (selectedIndex === correctIndex) {
    return {
      score: maxMarks,
      maxMarks,
      correctness: "correct",
      feedback: "Correct. The selected option matches the source-grounded answer key.",
    };
  }
  return {
    score: 0,
    maxMarks,
    correctness: "incorrect",
    feedback: "Incorrect. Compare your choice with the expected answer and the cited passage.",
  };
}

/** Fraction is clamped and converted into a half-mark score, never above maximum. */
export function scoreFromFraction(fraction: number, marks: number): number {
  if (!Number.isFinite(fraction)) return 0;
  const clamped = Math.min(1, Math.max(0, fraction));
  const raw = clamped * marks;
  return Math.min(marks, Math.round(raw * 2) / 2);
}

export function correctnessFromFraction(fraction: number): "correct" | "partial" | "incorrect" {
  if (fraction >= 0.85) return "correct";
  if (fraction >= 0.4) return "partial";
  return "incorrect";
}

export function normalizeConcept(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function conceptPresent(normalizedAnswer: string, concept: string): boolean {
  const normalizedConcept = normalizeConcept(concept);
  if (!normalizedConcept) return false;
  if (normalizedAnswer.includes(normalizedConcept)) return true;

  const tokens = normalizedConcept.split(" ").filter((token) => token.length >= 3);
  if (tokens.length === 0) return false;
  const answerTokens = new Set(normalizedAnswer.split(" "));
  let matched = 0;
  for (const token of tokens) {
    if (
      answerTokens.has(token) ||
      [...answerTokens].some((candidate) => candidate.startsWith(token) && token.length >= 4)
    ) {
      matched += 1;
    }
  }
  return matched / tokens.length >= 0.75;
}

export interface ConceptEvaluation {
  fraction: number;
  matched: string[];
  missing: string[];
  feedback: string;
}

/**
 * Deterministic rubric-coverage evaluation used when no language model is
 * configured, and as a fallback when provider calls fail. It measures whether
 * expected concepts appear in the answer; it does not claim semantic judgement.
 */
export function evaluateConceptCoverage(
  answer: string,
  concepts: string[],
  options: { marks?: number } = {},
): ConceptEvaluation {
  const normalized = normalizeConcept(answer);
  const cleaned = concepts.map((concept) => concept.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return {
      fraction: 0,
      matched: [],
      missing: [],
      feedback: "No rubric concepts were stored for this question, so it could not be graded.",
    };
  }
  if (!normalized) {
    return {
      fraction: 0,
      matched: [],
      missing: cleaned,
      feedback: "No answer was submitted. Expected concepts: " + cleaned.join(", ") + ".",
    };
  }

  const matched: string[] = [];
  const missing: string[] = [];
  for (const concept of cleaned) {
    if (conceptPresent(normalized, concept)) matched.push(concept);
    else missing.push(concept);
  }
  const fraction = matched.length / cleaned.length;
  const marks = options.marks;
  const marksText = marks ? ` Estimated score: ${scoreFromFraction(fraction, marks)}/${marks}.` : "";

  const feedback =
    missing.length === 0
      ? `The answer covers the expected concepts: ${matched.join(", ")}.${marksText}`
      : `Covered: ${matched.length > 0 ? matched.join(", ") : "none of the expected concepts"}. Missing: ${missing.join(", ")}.${marksText}`;

  return { fraction, matched, missing, feedback };
}
