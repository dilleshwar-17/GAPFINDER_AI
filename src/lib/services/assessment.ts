import { db, newId, nowIso, transaction } from "@/lib/db";
import { AppError, conflict, notFound, errorWithDetails, validationError } from "@/lib/errors";
import { getSubjectOwned } from "@/lib/services/subjects";
import { getTopicOwned } from "@/lib/services/topics";
import {
  getQuestionEvidence,
  getQuestionOwned,
  persistGeneratedQuestions,
  promptHashesForSubject,
  type QuestionRow,
} from "@/lib/services/questions";
import { retrieveEvidence, buildTopicQuery } from "@/lib/retrieval/retrieve";
import { generateQuestions } from "@/lib/ai/question-generation";
import { evaluateShortAnswerWithModel } from "@/lib/ai/evaluation";
import {
  correctnessFromFraction,
  evaluateConceptCoverage,
  scoreFromFraction,
  scoreMultipleChoice,
} from "@/lib/domain/scoring";
import { resolveQuestionSources } from "@/lib/domain/citations";
import { refreshMasteryForAttempt } from "@/lib/services/gaps";
import { refreshActivePlanAfterAssessment } from "@/lib/services/plans";
import { isSharedDemoUser } from "@/lib/services/guards";
import {
  attemptSubmissionSchema,
  quizRequestSchema,
  type AttemptSubmission,
} from "@/lib/ai/schemas";
import type { CitationView, EvidenceChunk, QuestionType } from "@/lib/domain/types";

export { quizRequestSchema, attemptSubmissionSchema };
export type { AttemptSubmission };

const MAX_QUESTIONS_PER_TOPIC = 3;
const MAX_TOPICS_PER_QUIZ = 3;

export interface SkippedTopic {
  topicId: string;
  topicName: string;
  reason: string;
}

export interface StartDiagnosticResult {
  attemptId: string;
  questionCount: number;
  totalMarks: number;
  skipped: SkippedTopic[];
  warnings: string[];
}

interface AttemptRow {
  id: string;
  owner_id: string;
  subject_id: string;
  status: "in_progress" | "submitted";
  question_ids_json: string;
  total_marks: number;
  score: number | null;
  started_at: string;
  submitted_at: string | null;
  generator: string;
  draft_json?: string | null;
}

function parseQuestionIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function getAttemptOwned(ownerId: string, attemptId: string): Promise<AttemptRow> {
  const attempt = await db.get<AttemptRow>(
    "SELECT * FROM quiz_attempts WHERE id = ? AND owner_id = ?",
    attemptId,
    ownerId,
  );
  if (!attempt) throw notFound("That quiz attempt was not found in your workspace.");
  return attempt;
}

async function questionsForAttempt(ownerId: string, attempt: AttemptRow): Promise<QuestionRow[]> {
  const ids = parseQuestionIds(attempt.question_ids_json);
  if (ids.length === 0) return [];
  const rows = await db.all<QuestionRow>(
    `SELECT * FROM questions
      WHERE owner_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
    ownerId,
    ...ids,
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is QuestionRow => Boolean(row));
}

async function existingQuestionsForTopic(
  ownerId: string,
  subjectId: string,
  topicId: string,
  limit: number,
  excludeIds: Set<string>,
): Promise<QuestionRow[]> {
  const rows = await db.all<QuestionRow>(
    `SELECT q.*,
            (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) AS usage
       FROM questions q
      WHERE q.owner_id = ? AND q.subject_id = ? AND q.topic_id = ?
        AND EXISTS (SELECT 1 FROM question_sources qs WHERE qs.question_id = q.id)
      ORDER BY usage ASC, q.created_at ASC
      LIMIT 24`,
    ownerId,
    subjectId,
    topicId,
  );
  return rows
    .filter((row) => !excludeIds.has(row.id))
    .slice(0, limit)
    .map((row) => {
      const { usage, ...question } = row as QuestionRow & { usage?: number };
      void usage;
      return question;
    });
}

/**
 * Runs the retrieval -> generation -> citation-validation pipeline for each
 * requested topic, persists accepted questions, then creates an attempt. A topic
 * whose evidence is insufficient is reported as skipped rather than padded with
 * unsupported questions.
 */
export async function startDiagnostic(
  ownerId: string,
  subjectId: string,
  topicIds: string[],
): Promise<StartDiagnosticResult> {
  const subject = await getSubjectOwned(ownerId, subjectId);
  const uniqueTopicIds = [...new Set(topicIds)].slice(0, MAX_TOPICS_PER_QUIZ);
  if (uniqueTopicIds.length === 0) {
    throw validationError("Select at least one topic to assess.");
  }

  const skipped: SkippedTopic[] = [];
  const warnings: string[] = [];
  const collected: QuestionRow[] = [];
  const methods = new Set<string>();
  const existingPromptHashes = await promptHashesForSubject(ownerId, subjectId);

  for (const topicId of uniqueTopicIds) {
    const topic = await getTopicOwned(ownerId, subjectId, topicId);
    try {
      const retrieval = await retrieveEvidence({
        ownerId,
        subjectId,
        query: buildTopicQuery(topic),
        topK: 8,
      });

      if (!retrieval.sufficient) {
        skipped.push({
          topicId: topic.id,
          topicName: topic.name,
          reason:
            retrieval.reason ??
            "The uploaded material does not contain enough evidence for this topic.",
        });
        continue;
      }

      const generated = await generateQuestions({
        ownerId,
        topic: { id: topic.id, name: topic.name, description: topic.description },
        evidence: retrieval.evidence,
        maxQuestions: MAX_QUESTIONS_PER_TOPIC,
        existingPromptHashes,
      });
      methods.add(generated.method);
      if (generated.note) warnings.push(`${topic.name}: ${generated.note}`);

      const persisted = await persistGeneratedQuestions({
        ownerId,
        subjectId,
        topicId: topic.id,
        questions: generated.questions,
        evidence: retrieval.evidence,
        generator: generated.method,
      });
      if (persisted.rejected > 0) {
        warnings.push(
          `${topic.name}: ${persisted.rejected} generated question${persisted.rejected === 1 ? "" : "s"} failed citation or schema validation and were rejected.`,
        );
      }

      const used = new Set(persisted.stored.map((question) => question.id));
      const topUp = await existingQuestionsForTopic(
        ownerId,
        subjectId,
        topic.id,
        Math.max(0, MAX_QUESTIONS_PER_TOPIC - persisted.stored.length),
        used,
      );
      if (topUp.length > 0) {
        methods.add("stored-bank");
      }

      const topicQuestions = [...persisted.stored, ...topUp];
      if (topicQuestions.length === 0) {
        skipped.push({
          topicId: topic.id,
          topicName: topic.name,
          reason:
            "No citation-valid question could be generated from the retrieved evidence. Add more complete material for this topic.",
        });
        continue;
      }
      collected.push(...topicQuestions);
    } catch (error) {
      if (error instanceof AppError && error.code === "PROVIDER_UNAVAILABLE") {
        throw error;
      }
      skipped.push({
        topicId: topic.id,
        topicName: topic.name,
        reason:
          error instanceof Error
            ? error.message
            : "This topic could not be prepared for assessment.",
      });
    }
  }

  if (collected.length === 0) {
    throw errorWithDetails(
      422,
      "INSUFFICIENT_EVIDENCE",
      "No source-grounded questions could be created. The uploaded material may not cover the selected topics closely enough.",
      { skipped },
    );
  }

  const totalMarks = collected.reduce((sum, question) => sum + question.marks, 0);
  const generator =
    methods.size === 0
      ? "unknown"
      : methods.size === 1
        ? [...methods][0]
        : "mixed";
  const attemptId = newId();
  await db.run(
    `INSERT INTO quiz_attempts
      (id, owner_id, subject_id, status, question_ids_json, total_marks, score, started_at,
       submitted_at, generator)
     VALUES (?, ?, ?, 'in_progress', ?, ?, NULL, ?, NULL, ?)`,
    attemptId,
    ownerId,
    subject.id,
    JSON.stringify(collected.map((question) => question.id)),
    totalMarks,
    nowIso(),
    generator,
  );

  return {
    attemptId,
    questionCount: collected.length,
    totalMarks,
    skipped,
    warnings,
  };
}

export interface QuizSourceView {
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  sectionHeading: string | null;
  excerpt?: string;
}

export interface QuizQuestionView {
  id: string;
  topicId: string;
  topicName: string;
  type: QuestionType;
  difficulty: string;
  prompt: string;
  options: string[];
  marks: number;
  sources: QuizSourceView[];
  answer?: {
    score: number;
    maxMarks: number;
    correctness: "correct" | "partial" | "incorrect";
    feedback: string;
    answerText: string | null;
    selectedIndex: number | null;
    evaluationMethod: string;
    expectedAnswer: string;
    rubric: string[];
    matchedConcepts: string[];
    missingConcepts: string[];
  };
}

export interface QuizDraftEntry {
  questionId: string;
  selectedIndex: number | null;
  answerText: string;
}

export interface QuizView {
  attemptId: string;
  subjectId: string;
  subjectName: string;
  status: "in_progress" | "submitted";
  startedAt: string;
  submittedAt: string | null;
  totalMarks: number;
  score: number | null;
  generator: string;
  questions: QuizQuestionView[];
  topicGroups: { topicId: string; topicName: string }[];
  isSeededDemo: boolean;
  draft: QuizDraftEntry[];
}

interface AnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text: string | null;
  selected_index: number | null;
  score: number;
  max_marks: number;
  correctness: "correct" | "partial" | "incorrect";
  feedback: string;
  matched_concepts_json: string;
  missing_concepts_json: string;
  evaluation_method: string;
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseOptions(raw: string | null): string[] {
  return raw ? parseStringArray(raw) : [];
}

function sourceViews(evidence: EvidenceChunk[], includeExcerpt: boolean): QuizSourceView[] {
  return evidence.map((chunk) => ({
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    pageNumber: chunk.pageNumber,
    sectionHeading: chunk.sectionHeading,
    ...(includeExcerpt ? { excerpt: chunk.text.slice(0, 420) } : {}),
  }));
}

export async function getQuizView(ownerId: string, attemptId: string): Promise<QuizView> {
  const attempt = await getAttemptOwned(ownerId, attemptId);
  const subject = await getSubjectOwned(ownerId, attempt.subject_id);
  const questions = await questionsForAttempt(ownerId, attempt);
  const answers = await db.all<AnswerRow>(
    "SELECT * FROM answers WHERE attempt_id = ? AND owner_id = ?",
    attemptId,
    ownerId,
  );
  const answerByQuestion = new Map(answers.map((answer) => [answer.question_id, answer]));
  const topicIds = [...new Set(questions.map((question) => question.topic_id))];
  const topicRows = topicIds.length
    ? await db.all<{ id: string; name: string }>(
        `SELECT id, name FROM topics WHERE owner_id = ? AND id IN (${topicIds.map(() => "?").join(",")})`,
        ownerId,
        ...topicIds,
      )
    : [];
  const topicNames = new Map(topicRows.map((row) => [row.id, row.name]));
  const submitted = attempt.status === "submitted";
  const draft = !submitted && attempt.draft_json ? parseDraft(attempt.draft_json) : [];

  const questionViews = await Promise.all(questions.map(async (question) => {
    const evidence = await getQuestionEvidence(ownerId, question.id);
    const answer = answerByQuestion.get(question.id);
    const base: QuizQuestionView = {
      id: question.id,
      topicId: question.topic_id,
      topicName: topicNames.get(question.topic_id) ?? "Topic",
      type: question.type,
      difficulty: question.difficulty,
      prompt: question.prompt,
      options: parseOptions(question.options_json),
      marks: question.marks,
      sources: sourceViews(evidence, submitted),
    };
    if (submitted && answer) {
      base.answer = {
        score: answer.score,
        maxMarks: answer.max_marks,
        correctness: answer.correctness,
        feedback: answer.feedback,
        answerText: answer.answer_text,
        selectedIndex: answer.selected_index,
        evaluationMethod: answer.evaluation_method,
        expectedAnswer: question.expected_answer,
        rubric: parseStringArray(question.rubric_json),
        matchedConcepts: parseStringArray(answer.matched_concepts_json),
        missingConcepts: parseStringArray(answer.missing_concepts_json),
      };
    }
    return base;
  }));

  return {
    attemptId: attempt.id,
    subjectId: attempt.subject_id,
    subjectName: subject.name,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    totalMarks: attempt.total_marks,
    score: attempt.score,
    generator: attempt.generator,
    isSeededDemo: attempt.generator.startsWith("demo-seed"),
    draft,
    topicGroups: topicIds.map((topicId) => ({
      topicId,
      topicName: topicNames.get(topicId) ?? "Topic",
    })),
    questions: questionViews,
  };
}

export interface SubmitResult {
  attemptId: string;
  score: number;
  totalMarks: number;
  planUpdated: boolean;
  topicsUpdated: number;
}

function parseDraft(raw: string): QuizDraftEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { questionId: string; selectedIndex: number | null; answerText: string } => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return typeof candidate.questionId === "string" && typeof candidate.answerText === "string";
      })
      .map((item) => ({
        questionId: item.questionId,
        selectedIndex:
          typeof item.selectedIndex === "number" && Number.isInteger(item.selectedIndex)
            ? item.selectedIndex
            : null,
        answerText: item.answerText.slice(0, 4000),
      }));
  } catch {
    return [];
  }
}

export async function saveAttemptDraft(
  ownerId: string,
  attemptId: string,
  submission: AttemptSubmission,
): Promise<{ savedAt: string }> {
  const attempt = await getAttemptOwned(ownerId, attemptId);
  if (attempt.status !== "in_progress") {
    throw conflict("This attempt has already been submitted.");
  }
  const questionIds = new Set(parseQuestionIds(attempt.question_ids_json));
  const seen = new Set<string>();
  const draft: QuizDraftEntry[] = [];
  for (const entry of submission.answers) {
    if (!questionIds.has(entry.questionId) || seen.has(entry.questionId)) continue;
    seen.add(entry.questionId);
    draft.push({
      questionId: entry.questionId,
      selectedIndex:
        typeof entry.selectedIndex === "number" ? entry.selectedIndex : null,
      answerText: (entry.answerText ?? "").slice(0, 4000),
    });
  }
  await db.run(
    "UPDATE quiz_attempts SET draft_json = ? WHERE id = ? AND owner_id = ? AND status = 'in_progress'",
    JSON.stringify(draft),
    attemptId,
    ownerId,
  );
  return { savedAt: nowIso() };
}

export async function submitAttempt(
  ownerId: string,
  attemptId: string,
  submission: AttemptSubmission,
  options: { allowDemo?: boolean } = {},
): Promise<SubmitResult> {
  const attempt = await getAttemptOwned(ownerId, attemptId);
  if (attempt.status === "submitted") {
    throw conflict("This attempt has already been submitted. Start a new diagnostic to retest.");
  }

  const questions = await questionsForAttempt(ownerId, attempt);
  if (questions.length === 0) {
    throw notFound("The questions for this attempt are no longer available.");
  }

  const payloadById = new Map<string, AttemptSubmission["answers"][number]>();
  for (const entry of submission.answers) {
    if (payloadById.has(entry.questionId)) {
      throw validationError("The submission contains duplicate answers for one question.");
    }
    payloadById.set(entry.questionId, entry);
  }
  for (const entry of submission.answers) {
    if (!questions.some((question) => question.id === entry.questionId)) {
      throw validationError("The submission contains a question that is not part of this attempt.");
    }
  }
  for (const question of questions) {
    if (!payloadById.has(question.id)) {
      throw validationError("Answer or explicitly skip every question before submitting.");
    }
  }

  interface PreparedAnswer {
    question: QuestionRow;
    answerText: string | null;
    selectedIndex: number | null;
    score: number;
    maxMarks: number;
    correctness: "correct" | "partial" | "incorrect";
    feedback: string;
    matched: string[];
    missing: string[];
    method: string;
  }

  // Evaluation may call the language-model provider, so it runs before the
  // write transaction. The transaction re-checks submission state and is the
  // only place answers are persisted, preventing partial duplicates.
  const prepared: PreparedAnswer[] = [];
  for (const question of questions) {
    const entry = payloadById.get(question.id)!;
    const answerText = (entry.answerText ?? "").trim().slice(0, 4000);
    const selectedIndex =
      entry.selectedIndex === undefined || entry.selectedIndex === null
        ? null
        : entry.selectedIndex;

    if (question.type === "mcq") {
      const options = parseOptions(question.options_json);
      const result = scoreMultipleChoice(
        selectedIndex,
        question.correct_index,
        question.marks,
        options.length,
      );
      prepared.push({
        question,
        answerText: null,
        selectedIndex,
        score: result.score,
        maxMarks: result.maxMarks,
        correctness: result.correctness,
        feedback: result.feedback,
        matched: [],
        missing: [],
        method: "deterministic-mcq-v1",
      });
      continue;
    }

    const rubric = parseStringArray(question.rubric_json);
    let fraction = 0;
    let matched: string[] = [];
    let missing: string[] = [];
    let feedback = "";
    let method = "deterministic-concept-coverage-v1";

    const evidence = await getQuestionEvidence(ownerId, question.id);
    const modelEvaluation =
      answerText.length > 0 && evidence.length > 0
        ? await evaluateShortAnswerWithModel({
            ownerId,
            question: {
              id: question.id,
              prompt: question.prompt,
              expectedAnswer: question.expected_answer,
              rubric,
              type: question.type,
              difficulty: question.difficulty,
              marks: question.marks,
            },
            answer: answerText,
            evidence,
          })
        : null;

    if (modelEvaluation) {
      fraction = Math.min(1, Math.max(0, modelEvaluation.scoreFraction));
      matched = modelEvaluation.matchedConcepts;
      missing = modelEvaluation.missingConcepts;
      feedback = modelEvaluation.feedback;
      method = `gemini-rubric-v1:${modelEvaluation.providerModel}`;
    } else {
      const deterministic = evaluateConceptCoverage(answerText, rubric, {
        marks: question.marks,
      });
      fraction = deterministic.fraction;
      matched = deterministic.matched;
      missing = deterministic.missing;
      feedback = deterministic.feedback;
    }

    const score = scoreFromFraction(fraction, question.marks);
    prepared.push({
      question,
      answerText: answerText || null,
      selectedIndex: null,
      score,
      maxMarks: question.marks,
      correctness: correctnessFromFraction(fraction),
      feedback,
      matched: matched.slice(0, 8),
      missing: missing.slice(0, 8),
      method,
    });
  }

  const scoreTotal = prepared.reduce((sum, item) => sum + item.score, 0);

  await transaction(async () => {
    const fresh = await db.get<{ status: string }>(
      "SELECT status FROM quiz_attempts WHERE id = ? AND owner_id = ?",
      attemptId,
      ownerId,
    );
    if (!fresh || fresh.status !== "in_progress") {
      throw conflict("This attempt has already been submitted.");
    }

    for (const item of prepared) {
      await db.run(
        `INSERT INTO answers
          (id, attempt_id, question_id, owner_id, answer_text, selected_index, score, max_marks,
           correctness, feedback, matched_concepts_json, missing_concepts_json, evaluation_method, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        attemptId,
        item.question.id,
        ownerId,
        item.answerText,
        item.selectedIndex,
        item.score,
        item.maxMarks,
        item.correctness,
        item.feedback,
        JSON.stringify(item.matched),
        JSON.stringify(item.missing),
        item.method,
        nowIso(),
      );
    }

    await db.run(
      `UPDATE quiz_attempts
          SET status = 'submitted', score = ?, submitted_at = ?, draft_json = NULL
        WHERE id = ? AND owner_id = ? AND status = 'in_progress'`,
      Math.round(scoreTotal * 10) / 10,
      nowIso(),
      attemptId,
      ownerId,
    );
  });

  const affected = await db.all<{ topic_id: string }>(
    `SELECT DISTINCT q.topic_id
       FROM answers a JOIN questions q ON q.id = a.question_id
      WHERE a.attempt_id = ? AND a.owner_id = ?`,
    attemptId,
    ownerId,
  );
  // Shared demo results remain isolated from its reference workspace.
  if (!(await isSharedDemoUser(ownerId)) || options.allowDemo) {
    await refreshMasteryForAttempt(ownerId, attempt.subject_id, attemptId);
  }
  let planUpdated = false;
  if (!(await isSharedDemoUser(ownerId)) || options.allowDemo) {
    try {
      planUpdated = await refreshActivePlanAfterAssessment(ownerId, attempt.subject_id);
    } catch (error) {
      // The assessment is already committed; a planning failure must not discard it.
      console.error(
        "[gapfinder] plan refresh after assessment failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return {
    attemptId,
    score: Math.round(scoreTotal * 10) / 10,
    totalMarks: attempt.total_marks,
    planUpdated,
    topicsUpdated: affected.length,
  };
}

export interface AttemptSummary {
  id: string;
  subjectId: string;
  status: "in_progress" | "submitted";
  score: number | null;
  totalMarks: number;
  startedAt: string;
  submittedAt: string | null;
  questionCount: number;
  generator: string;
  isSeededDemo: boolean;
}

export interface AttemptWithSubject extends AttemptSummary {
  subjectName: string;
}

export async function listAllAttempts(ownerId: string): Promise<AttemptWithSubject[]> {
  const rows = await db.all<AttemptRow & { subject_name: string }>(
    `SELECT at.*, s.name AS subject_name
       FROM quiz_attempts at
       JOIN subjects s ON s.id = at.subject_id
      WHERE at.owner_id = ?
      ORDER BY at.started_at DESC
      LIMIT 80`,
    ownerId,
  );
  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    status: row.status,
    score: row.score,
    totalMarks: row.total_marks,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    questionCount: parseQuestionIds(row.question_ids_json).length,
    generator: row.generator,
    isSeededDemo: row.generator.startsWith("demo-seed"),
  }));
}

export async function listAttempts(ownerId: string, subjectId: string): Promise<AttemptSummary[]> {
  const rows = await db.all<AttemptRow>(
    `SELECT * FROM quiz_attempts
      WHERE owner_id = ? AND subject_id = ?
      ORDER BY started_at DESC LIMIT 40`,
    ownerId,
    subjectId,
  );
  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subject_id,
    status: row.status,
    score: row.score,
    totalMarks: row.total_marks,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    questionCount: parseQuestionIds(row.question_ids_json).length,
    generator: row.generator,
    isSeededDemo: row.generator.startsWith("demo-seed"),
  }));
}

export interface EvaluationCitation extends CitationView {}

export async function attemptCitations(ownerId: string, attemptId: string): Promise<EvaluationCitation[]> {
  const attempt = await getAttemptOwned(ownerId, attemptId);
  const questions = await questionsForAttempt(ownerId, attempt);
  const citations: CitationView[] = [];
  for (const question of questions) {
    const evidence = await getQuestionEvidence(ownerId, question.id);
    try {
      const resolved = resolveQuestionSources(
        evidence.map((chunk) => chunk.chunkId),
        evidence,
      );
      citations.push(...resolved.sources);
    } catch {
      // A question with missing sources is simply not cited.
    }
  }
  return citations;
}

export async function getQuestionForAttempt(ownerId: string, attemptId: string, questionId: string) {
  const attempt = await getAttemptOwned(ownerId, attemptId);
  if (!parseQuestionIds(attempt.question_ids_json).includes(questionId)) {
    throw notFound("That question is not part of this attempt.");
  }
  return getQuestionOwned(ownerId, questionId);
}

export const quizLimits = {
  maxTopics: MAX_TOPICS_PER_QUIZ,
  maxQuestionsPerTopic: MAX_QUESTIONS_PER_TOPIC,
};
