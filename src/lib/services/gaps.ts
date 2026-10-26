import { db } from "@/lib/db";
import { getSubjectOwned } from "@/lib/services/subjects";
import { listTopics, getPrerequisites } from "@/lib/services/topics";
import {
  computeTopicMastery,
  EVIDENCE_RULES,
  MASTERY_BANDS,
  MASTERY_METHOD_VERSION,
} from "@/lib/domain/mastery";
import type {
  AnswerEvidence,
  Difficulty,
  TopicClassification,
} from "@/lib/domain/types";
import { newId, nowIso } from "@/lib/db";

interface AnswerRow {
  answer_id: string;
  attempt_id: string;
  question_id: string;
  topic_id: string;
  score: number;
  max_marks: number;
  difficulty: Difficulty;
  correctness: "correct" | "partial" | "incorrect";
  feedback: string;
  missing_concepts_json: string;
  submitted_at: string | null;
  prompt: string;
}

function parseConcepts(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Recomputes mastery for the topics touched by a submitted attempt and stores a
 * new snapshot for each. Snapshots are append-only; previous assessments are
 * never rewritten.
 */
export async function refreshMasteryForAttempt(
  ownerId: string,
  subjectId: string,
  attemptId: string,
): Promise<void> {
  const topics = await db.all<{ topic_id: string }>(
    `SELECT DISTINCT q.topic_id
       FROM answers a
       JOIN questions q ON q.id = a.question_id
      WHERE a.attempt_id = ? AND a.owner_id = ? AND q.subject_id = ?`,
    attemptId,
    ownerId,
    subjectId,
  );

  for (const topic of topics) {
    const rows = await db.all<AnswerRow>(
      `SELECT a.id AS answer_id, a.attempt_id, a.question_id, q.topic_id, a.score, a.max_marks,
              q.difficulty, a.correctness, a.feedback, a.missing_concepts_json,
              at.submitted_at, q.prompt
         FROM answers a
         JOIN questions q ON q.id = a.question_id
         JOIN quiz_attempts at ON at.id = a.attempt_id
        WHERE a.owner_id = ? AND q.topic_id = ? AND at.status = 'submitted' AND q.subject_id = ?
        ORDER BY at.submitted_at ASC, a.created_at ASC`,
      ownerId,
      topic.topic_id,
      subjectId,
    );

    const evidence: AnswerEvidence[] = rows.map((row) => ({
      topicId: row.topic_id,
      questionId: row.question_id,
      attemptId: row.attempt_id,
      score: row.score,
      maxMarks: row.max_marks,
      difficulty: row.difficulty,
      submittedAt: row.submitted_at ?? "",
    }));
    const result = computeTopicMastery(evidence);

    const existing = await db.get<{ id: string }>(
      "SELECT id FROM mastery_snapshots WHERE owner_id = ? AND topic_id = ? AND attempt_id = ?",
      ownerId,
      topic.topic_id,
      attemptId,
    );
    if (existing) continue;

    await db.run(
      `INSERT INTO mastery_snapshots
        (id, owner_id, subject_id, topic_id, attempt_id, mastery, classification,
         evidence_answers, evidence_marks, method_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      ownerId,
      subjectId,
      topic.topic_id,
      attemptId,
      result.mastery,
      result.classification,
      result.evidenceAnswers,
      result.evidenceMarks,
      MASTERY_METHOD_VERSION,
      nowIso(),
    );
  }
}

export interface RecentEvidenceView {
  attemptId: string;
  questionId: string;
  prompt: string;
  score: number;
  maxMarks: number;
  correctness: "correct" | "partial" | "incorrect";
  difficulty: Difficulty;
  submittedAt: string;
  citation: {
    documentTitle: string;
    pageNumber: number | null;
    sectionHeading: string | null;
  } | null;
}

export interface MissingConcept {
  concept: string;
  count: number;
}

export interface PrerequisiteHypothesis {
  prerequisiteName: string;
  prerequisiteClassification: TopicClassification;
  label: "supported_hypothesis" | "not_supported";
  message: string;
}

export interface GapTopic {
  topicId: string;
  name: string;
  parentName: string | null;
  classification: TopicClassification;
  mastery: number | null;
  sufficient: boolean;
  evidenceAnswers: number;
  evidenceMarks: number;
  questionCount: number;
  sourceCount: number;
  lastAssessedAt: string | null;
  masteryChange: number | null;
  confidence: "insufficient" | "limited" | "moderate";
  recommendedAction: string;
  measuredWeakness: boolean;
  recentEvidence: RecentEvidenceView[];
  missingConcepts: MissingConcept[];
  prerequisiteHypotheses: PrerequisiteHypothesis[];
}

export interface GapReport {
  generatedAt: string;
  subjectName: string;
  summary: {
    leaves: number;
    assessed: number;
    weak: number;
    developing: number;
    strong: number;
    notAssessed: number;
    attemptsConsidered: number;
  };
  method: {
    version: string;
    bands: typeof MASTERY_BANDS;
    evidenceRules: typeof EVIDENCE_RULES;
  };
  topics: GapTopic[];
}

function recommendation(classification: TopicClassification): string {
  switch (classification) {
    case "weak":
      return "Revisit the cited passages first, then retake a short diagnostic on this topic.";
    case "developing":
      return "Review the concepts marked missing, compare your answers with the source passages, and attempt a mixed practice set.";
    case "strong":
      return "Keep this topic warm with a short practice set before the exam.";
    default:
      return "Take a short diagnostic to establish evidence before allocating revision time.";
  }
}

function confidenceLabel(
  sufficient: boolean,
  answers: number,
  marks: number,
): "insufficient" | "limited" | "moderate" {
  if (!sufficient) return "insufficient";
  if (answers >= 4 && marks >= 8) return "moderate";
  return "limited";
}

async function masteryChangeForTopic(topicId: string, ownerId: string): Promise<number | null> {
  const snapshots = await db.all<{ mastery: number | null }>(
    `SELECT mastery FROM mastery_snapshots
      WHERE owner_id = ? AND topic_id = ? AND mastery IS NOT NULL
      ORDER BY created_at DESC, id DESC LIMIT 2`,
    ownerId,
    topicId,
  );
  if (snapshots.length < 2) return null;
  const next = snapshots[0].mastery;
  const previous = snapshots[1].mastery;
  if (next === null || previous === null) return null;
  return next - previous;
}

async function recentEvidenceForTopic(ownerId: string, topicId: string): Promise<RecentEvidenceView[]> {
  const rows = await db.all<AnswerRow & {
    document_title: string | null;
    page_number: number | null;
    section_heading: string | null;
  }>(
    `SELECT a.id AS answer_id, a.attempt_id, a.question_id, q.topic_id, a.score, a.max_marks,
            q.difficulty, a.correctness, a.feedback, a.missing_concepts_json,
            at.submitted_at, q.prompt,
            (SELECT d.filename FROM question_sources qs
               JOIN documents d ON d.id = qs.document_id
              WHERE qs.question_id = q.id
              ORDER BY qs.rank ASC LIMIT 1) AS document_title,
            (SELECT qs.page_number FROM question_sources qs
              WHERE qs.question_id = q.id
              ORDER BY qs.rank ASC LIMIT 1) AS page_number,
            (SELECT qs.section_heading FROM question_sources qs
              WHERE qs.question_id = q.id
              ORDER BY qs.rank ASC LIMIT 1) AS section_heading
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       JOIN quiz_attempts at ON at.id = a.attempt_id
      WHERE a.owner_id = ? AND q.topic_id = ? AND at.status = 'submitted'
      ORDER BY at.submitted_at DESC, a.created_at DESC
      LIMIT 6`,
    ownerId,
    topicId,
  );

  return rows.map((row) => ({
    attemptId: row.attempt_id,
    questionId: row.question_id,
    prompt: row.prompt,
    score: row.score,
    maxMarks: row.max_marks,
    correctness: row.correctness,
    difficulty: row.difficulty,
    submittedAt: row.submitted_at ?? "",
    citation: row.document_title
      ? {
          documentTitle: row.document_title,
          pageNumber: row.page_number,
          sectionHeading: row.section_heading,
        }
      : null,
  }));
}

async function missingConceptsForTopic(ownerId: string, topicId: string): Promise<MissingConcept[]> {
  const rows = await db.all<{ missing_concepts_json: string }>(
    `SELECT a.missing_concepts_json
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       JOIN quiz_attempts at ON at.id = a.attempt_id
      WHERE a.owner_id = ? AND q.topic_id = ? AND at.status = 'submitted'
        AND a.correctness != 'correct'
      ORDER BY at.submitted_at DESC
      LIMIT 20`,
    ownerId,
    topicId,
  );
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const concept of parseConcepts(row.missing_concepts_json)) {
      const key = concept.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([concept, count]) => ({ concept, count }));
}

export async function getGapReport(ownerId: string, subjectId: string): Promise<GapReport> {
  const subject = await getSubjectOwned(ownerId, subjectId);
  const topics = await listTopics(ownerId, subjectId);
  const leaves = topics.filter((topic) => topic.childCount === 0);
  const attempts = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM quiz_attempts
      WHERE owner_id = ? AND subject_id = ? AND status = 'submitted'`,
    ownerId,
    subjectId,
  );

  const gapTopics: GapTopic[] = await Promise.all(leaves.map(async (topic) => {
    const prerequisiteRows = await getPrerequisites(ownerId, topic.id);
    const prerequisites = prerequisiteRows.map((prerequisite) => {
      const supported =
        prerequisite.prerequisiteClassification === "weak" &&
        (topic.classification === "weak" || topic.classification === "not_assessed");
      return {
        prerequisiteName: prerequisite.prerequisiteName,
        prerequisiteClassification: prerequisite.prerequisiteClassification,
        label: supported ? ("supported_hypothesis" as const) : ("not_supported" as const),
        message: supported
          ? `Hypothesis, not a measured finding: the prerequisite "${prerequisite.prerequisiteName}" is measured weak, which may be limiting this topic. This is inferred from an explicit dependency plus assessment evidence.`
          : prerequisite.prerequisiteClassification === "not_assessed"
            ? `Prerequisite "${prerequisite.prerequisiteName}" has insufficient assessment evidence, so no prerequisite gap is inferred.`
            : `Prerequisite "${prerequisite.prerequisiteName}" is ${prerequisite.prerequisiteClassification}; no prerequisite gap is inferred from the current evidence.`,
      };
    });
    const [masteryChange, recentEvidence, missingConcepts] = await Promise.all([
      masteryChangeForTopic(topic.id, ownerId),
      recentEvidenceForTopic(ownerId, topic.id),
      missingConceptsForTopic(ownerId, topic.id),
    ]);

    return {
      topicId: topic.id,
      name: topic.name,
      parentName: topic.parentName,
      classification: topic.classification,
      mastery: topic.mastery,
      sufficient: topic.sufficient,
      evidenceAnswers: topic.evidenceAnswers,
      evidenceMarks: topic.evidenceMarks,
      questionCount: topic.questionCount,
      sourceCount: topic.sourceCount,
      lastAssessedAt: topic.lastAssessedAt,
      masteryChange,
      confidence: confidenceLabel(
        topic.sufficient,
        topic.evidenceAnswers,
        topic.evidenceMarks,
      ),
      recommendedAction: recommendation(topic.classification),
      measuredWeakness: topic.classification === "weak",
      recentEvidence,
      missingConcepts,
      prerequisiteHypotheses: prerequisites,
    };
  }));

  const assessed = gapTopics.filter((topic) => topic.sufficient).length;

  return {
    generatedAt: nowIso(),
    subjectName: subject.name,
    summary: {
      leaves: leaves.length,
      assessed,
      weak: gapTopics.filter((topic) => topic.classification === "weak").length,
      developing: gapTopics.filter((topic) => topic.classification === "developing").length,
      strong: gapTopics.filter((topic) => topic.classification === "strong").length,
      notAssessed: gapTopics.filter((topic) => topic.classification === "not_assessed").length,
      attemptsConsidered: attempts?.count ?? 0,
    },
    method: {
      version: MASTERY_METHOD_VERSION,
      bands: MASTERY_BANDS,
      evidenceRules: EVIDENCE_RULES,
    },
    topics: gapTopics,
  };
}

export async function latestMasteryByTopic(
  ownerId: string,
  subjectId: string,
): Promise<Map<string, GapTopic>> {
  return new Map(
    (await getGapReport(ownerId, subjectId)).topics.map((topic) => [topic.topicId, topic]),
  );
}
