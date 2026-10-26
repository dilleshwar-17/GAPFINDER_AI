import type { AnswerEvidence, TopicClassification } from "@/lib/domain/types";
import { DIFFICULTY_WEIGHT } from "@/lib/domain/scoring";

export const MASTERY_METHOD_VERSION = "weighted-marks-v1";

/** Provisional reporting bands, not validated educational thresholds. */
export const MASTERY_BANDS = {
  weakMax: 49,
  developingMax: 79,
} as const;

export const EVIDENCE_RULES = {
  minAnswers: 2,
  minMarks: 3,
  minDistinctQuestions: 2,
} as const;

export interface TopicMasteryResult {
  mastery: number | null;
  classification: TopicClassification;
  sufficient: boolean;
  evidenceAnswers: number;
  evidenceMarks: number;
  weightedEarned: number;
  weightedPossible: number;
  distinctQuestions: number;
}

export function classifyMastery(
  mastery: number | null,
  sufficient: boolean,
): TopicClassification {
  if (mastery === null || !sufficient) return "not_assessed";
  if (mastery < 0 || mastery > 100) return "not_assessed";
  if (mastery <= MASTERY_BANDS.weakMax) return "weak";
  if (mastery <= MASTERY_BANDS.developingMax) return "developing";
  return "strong";
}

/**
 * Mastery is the difficulty-weighted share of available marks earned across all
 * recorded answers for a topic. It is an estimate of demonstrated performance,
 * not a measurement of ability or of unassessed syllabus content.
 */
export function computeTopicMastery(answers: AnswerEvidence[]): TopicMasteryResult {
  if (answers.length === 0) {
    return {
      mastery: null,
      classification: "not_assessed",
      sufficient: false,
      evidenceAnswers: 0,
      evidenceMarks: 0,
      weightedEarned: 0,
      weightedPossible: 0,
      distinctQuestions: 0,
    };
  }

  let weightedEarned = 0;
  let weightedPossible = 0;
  let evidenceMarks = 0;
  const questions = new Set<string>();

  for (const answer of answers) {
    const weight = DIFFICULTY_WEIGHT[answer.difficulty] ?? 1;
    const possible = Math.max(0, answer.maxMarks) * weight;
    const earned = Math.min(Math.max(0, answer.score), Math.max(0, answer.maxMarks)) * weight;
    weightedPossible += possible;
    weightedEarned += earned;
    evidenceMarks += Math.max(0, answer.maxMarks);
    questions.add(answer.questionId);
  }

  const mastery =
    weightedPossible > 0
      ? Math.round((weightedEarned / weightedPossible) * 100)
      : null;

  const sufficient =
    answers.length >= EVIDENCE_RULES.minAnswers &&
    evidenceMarks >= EVIDENCE_RULES.minMarks &&
    questions.size >= EVIDENCE_RULES.minDistinctQuestions;

  return {
    mastery,
    classification: classifyMastery(mastery, sufficient),
    sufficient,
    evidenceAnswers: answers.length,
    evidenceMarks: Math.round(evidenceMarks * 10) / 10,
    weightedEarned,
    weightedPossible,
    distinctQuestions: questions.size,
  };
}

export function masteryBandLabel(classification: TopicClassification): string {
  switch (classification) {
    case "weak":
      return "Weak";
    case "developing":
      return "Developing";
    case "strong":
      return "Strong";
    default:
      return "Not assessed";
  }
}

export function masteryChange(
  previous: number | null,
  next: number | null,
): number | null {
  if (previous === null || next === null) return null;
  return next - previous;
}
