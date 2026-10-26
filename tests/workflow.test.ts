import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { insertUser } from "./fixtures";
import { createSubject } from "@/lib/services/subjects";
import {
  getDocumentDetail,
  ingestDocument,
  listDocuments,
} from "@/lib/services/documents";
import { extractTopics, getTopicContext, listLeafTopics } from "@/lib/services/topics";
import {
  getQuizView,
  startDiagnostic,
  submitAttempt,
} from "@/lib/services/assessment";
import { getGapReport } from "@/lib/services/gaps";
import {
  createRevisionPlan,
  getActivePlan,
  listPlanHistory,
  toggleRevisionTask,
} from "@/lib/services/plans";
import { explainTopic } from "@/lib/services/assistant";
import { getProgressOverview } from "@/lib/services/progress";

const OWNER_ID = "workflow-owner";
const OTHER_ID = "workflow-other";
const SUBJECT_NAME = "QA Synthetic Biology";

function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const SYLLABUS = `QA Synthetic Biology

Unit 1: Cell structure

1.1 Cell membrane
The cell membrane is a selectively permeable barrier that controls which substances enter and leave the cell. It is made of a phospholipid bilayer with embedded proteins.

1.2 Mitochondria
Mitochondria are the organelles that convert chemical energy stored in glucose into usable ATP during cellular respiration. They have folded inner membranes called cristae.

Unit 2: Photosynthesis

2.1 Chloroplast
The chloroplast is an organelle that contains chlorophyll and carries out the light dependent reactions of photosynthesis.

2.2 Light reactions
The light reactions occur in the thylakoid membranes when light energy excites electrons to produce ATP and NADPH. Oxygen is released as a byproduct of splitting water.
`;

let ownerId: string;
let otherId: string;
let subjectId: string;
let documentId: string;
let topicId: string;
let firstAttemptId: string;

beforeEach(async () => {
  resetDatabase();
  insertUser({ id: OWNER_ID, email: "workflow-owner@example.test", isDemo: false });
  insertUser({ id: OTHER_ID, email: "workflow-other@example.test", isDemo: false });
  const subject = createSubject({
    ownerId: OWNER_ID,
    name: SUBJECT_NAME,
    description: "Synthetic material created only for automated tests.",
    examDate: futureDate(10),
  });
  subjectId = subject.id;
  ownerId = OWNER_ID;
  otherId = OTHER_ID;

  const document = await ingestDocument({
    ownerId,
    subjectId,
    filename: "qa-synthetic-biology.txt",
    mimeType: "text/plain",
    kind: "syllabus",
    bytes: new TextEncoder().encode(SYLLABUS),
  });
  documentId = document.id;

  const extraction = extractTopics(ownerId, subjectId);
  expect(extraction.source).toBe("syllabus");
  expect(extraction.created).toBeGreaterThan(0);

  const leaf = listLeafTopics(ownerId, subjectId).find((topic) =>
    topic.name.toLowerCase().includes("cell membrane"),
  );
  expect(leaf).toBeDefined();
  topicId = leaf!.id;

  const diagnostic = await startDiagnostic(ownerId, subjectId, [topicId]);
  expect(diagnostic.questionCount).toBeGreaterThanOrEqual(3);
  expect(diagnostic.skipped).toEqual([]);
  firstAttemptId = diagnostic.attemptId;
});

function expectNotFound(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(404);
    return;
  }
  throw new Error("Expected a not-found AppError");
}

describe("upload -> extraction -> retrieval pipeline", () => {
  it("indexes a readable text file with chunks and stable source metadata", () => {
    const documents = listDocuments(ownerId, subjectId);
    expect(documents).toHaveLength(1);
    expect(documents[0]?.status).toBe("ready");
    expect(documents[0]?.chunkCount).toBeGreaterThan(0);
    expect(documents[0]?.errorMessage).toBeNull();

    const detail = getDocumentDetail(ownerId, documentId);
    expect(detail.document.id).toBe(documentId);
    expect(detail.chunks.length).toBe(documents[0]!.chunkCount);
    expect(detail.chunks.every((chunk) => chunk.excerpt.length > 0)).toBe(true);
    expect(detail.chunks.every((chunk) => chunk.charCount > 0)).toBe(true);
  });

  it("creates topics only from headings present in the uploaded syllabus", () => {
    const leaves = listLeafTopics(ownerId, subjectId);
    const names = leaves.map((topic) => topic.name.toLowerCase());
    expect(names.some((name) => name.includes("cell membrane"))).toBe(true);
    expect(names.some((name) => name.includes("mitochondria"))).toBe(true);
    expect(names.some((name) => name.includes("ribosome"))).toBe(false);
  });

  it("rejects unsupported upload types before creating a document row", async () => {
    await expect(
      ingestDocument({
        ownerId,
        subjectId,
        filename: "notes.exe",
        mimeType: "application/x-msdownload",
        kind: "notes",
        bytes: new TextEncoder().encode("not a supported study file"),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE", status: 415 });
    expect(listDocuments(ownerId, subjectId)).toHaveLength(1);
  });

  it("rejects an empty upload", async () => {
    await expect(
      ingestDocument({
        ownerId,
        subjectId,
        filename: "empty.txt",
        mimeType: "text/plain",
        kind: "notes",
        bytes: new Uint8Array(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("refuses a byte-identical duplicate in the same subject", async () => {
    await expect(
      ingestDocument({
        ownerId,
        subjectId,
        filename: "copy-of-syllabus.txt",
        mimeType: "text/plain",
        kind: "syllabus",
        bytes: new TextEncoder().encode(SYLLABUS),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("marks a corrupted PDF as failed instead of silently indexing it", async () => {
    await expect(
      ingestDocument({
        ownerId,
        subjectId,
        filename: "corrupted.pdf",
        mimeType: "application/pdf",
        kind: "notes",
        bytes: new TextEncoder().encode("%PDF-1.7 not a real document"),
      }),
    ).rejects.toMatchObject({ code: "EXTRACTION_FAILED" });
    const failed = listDocuments(ownerId, subjectId).find(
      (document) => document.filename === "corrupted.pdf",
    );
    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBeTruthy();
    expect(failed?.chunkCount).toBe(0);
  });
});

describe("diagnostic and answer integrity", () => {
  it("does not leak the answer key before submission", async () => {
    const view = getQuizView(ownerId, firstAttemptId);
    expect(view.status).toBe("in_progress");
    for (const question of view.questions) {
      expect(question.answer).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(question, "answer")).toBe(false);
      expect(question.sources.length).toBeGreaterThan(0);
    }
  });

  it("persists deterministic scores and resolves every citation to the owned source", async () => {
    const preSubmit = getQuizView(ownerId, firstAttemptId);
    const answers = preSubmit.questions.map((question) => {
      const row = db.get<{
        correct_index: number | null;
        expected_answer: string;
        type: string;
      }>(
        "SELECT correct_index, expected_answer, type FROM questions WHERE id = ? AND owner_id = ?",
        question.id,
        ownerId,
      )!;
      if (row.type === "mcq") {
        return { questionId: question.id, selectedIndex: row.correct_index ?? 0 };
      }
      return { questionId: question.id, answerText: row.expected_answer };
    });

    const result = await submitAttempt(ownerId, firstAttemptId, { answers });
    expect(result.score).toBe(result.totalMarks);
    expect(result.topicsUpdated).toBeGreaterThan(0);

    const stored = db.all<{ score: number; max_marks: number; evaluation_method: string }>(
      "SELECT score, max_marks, evaluation_method FROM answers WHERE attempt_id = ? AND owner_id = ?",
      firstAttemptId,
      ownerId,
    );
    expect(stored).toHaveLength(preSubmit.questions.length);
    expect(stored.reduce((sum, row) => sum + row.score, 0)).toBe(result.score);
    expect(stored.every((row) => row.evaluation_method.startsWith("deterministic-"))).toBe(true);

    const submitted = getQuizView(ownerId, firstAttemptId);
    expect(submitted.status).toBe("submitted");
    for (const question of submitted.questions) {
      expect(question.answer?.expectedAnswer).toBeTruthy();
      expect(question.sources.length).toBeGreaterThan(0);
      for (const source of question.sources) {
        expect(source.documentId).toBe(documentId);
        expect(typeof source.documentTitle).toBe("string");
        expect(source.documentTitle.length).toBeGreaterThan(0);
      }
    }
  });

  it("refuses a duplicate submission of the same attempt", async () => {
    const preSubmit = getQuizView(ownerId, firstAttemptId);
    const answers = preSubmit.questions.map((question) => ({
      questionId: question.id,
      selectedIndex: 0,
      answerText: "A partial answer",
    }));
    await submitAttempt(ownerId, firstAttemptId, { answers });

    await expect(
      submitAttempt(ownerId, firstAttemptId, { answers }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    const count = db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM answers WHERE attempt_id = ?",
      firstAttemptId,
    );
    expect(count?.count).toBe(preSubmit.questions.length);
  });
});

describe("gap analysis, planning, progress and grounded assistance", () => {
  it("computes mastery from submitted evidence and labels unassessed topics honestly", async () => {
    const preSubmit = getQuizView(ownerId, firstAttemptId);
    const answers = preSubmit.questions.map((question) => {
      const row = db.get<{ correct_index: number | null; expected_answer: string; type: string }>(
        "SELECT correct_index, expected_answer, type FROM questions WHERE id = ? AND owner_id = ?",
        question.id,
        ownerId,
      )!;
      return row.type === "mcq"
        ? { questionId: question.id, selectedIndex: row.correct_index ?? 0 }
        : { questionId: question.id, answerText: row.expected_answer };
    });
    await submitAttempt(ownerId, firstAttemptId, { answers });

    const report = getGapReport(ownerId, subjectId);
    expect(report.summary.assessed).toBe(1);
    expect(report.summary.notAssessed).toBe(report.summary.leaves - 1);
    const measured = report.topics.find((topic) => topic.topicId === topicId);
    expect(measured?.sufficient).toBe(true);
    expect(measured?.mastery).not.toBeNull();
    expect(measured?.classification).toMatch(/^(weak|developing|strong)$/);
    expect(measured?.evidenceAnswers).toBe(preSubmit.questions.length);
    expect(measured?.recentEvidence.length).toBeGreaterThan(0);
    const unassessed = report.topics.filter((topic) => topic.topicId !== topicId);
    expect(unassessed.every((topic) => topic.mastery === null)).toBe(true);

    const progress = getProgressOverview(ownerId, subjectId);
    expect(progress.topicTrends.some((trend) => trend.topicId === topicId)).toBe(true);
  });

  it("builds a time-bounded plan, preserves completed history, and adapts after a new assessment", async () => {
    const preSubmit = getQuizView(ownerId, firstAttemptId);
    const correctAnswers = preSubmit.questions.map((question) => {
      const row = db.get<{ correct_index: number | null; expected_answer: string; type: string }>(
        "SELECT correct_index, expected_answer, type FROM questions WHERE id = ? AND owner_id = ?",
        question.id,
        ownerId,
      )!;
      return row.type === "mcq"
        ? { questionId: question.id, selectedIndex: row.correct_index ?? 0 }
        : { questionId: question.id, answerText: row.expected_answer };
    });
    await submitAttempt(ownerId, firstAttemptId, { answers: correctAnswers });

    const plan = await createRevisionPlan({
      ownerId,
      subjectId,
      request: {
        examDate: futureDate(7),
        minutesPerDay: 60,
        sessionMinutes: 45,
      },
      trigger: "manual",
    });
    expect(plan.version).toBe(1);
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks.length).toBeLessThanOrEqual(12);
    expect(plan.allocatedMinutes).toBeLessThanOrEqual(plan.capacityMinutes);
    expect(plan.pendingMinutes).toBeLessThanOrEqual(plan.capacityMinutes);
    expect(plan.tasks.every((task) => task.durationMinutes > 0)).toBe(true);

    const completed = toggleRevisionTask(ownerId, plan.tasks[0]!.id);
    expect(completed.status).toBe("completed");

    const second = await startDiagnostic(ownerId, subjectId, [topicId]);
    const wrongAnswers = getQuizView(ownerId, second.attemptId).questions.map((question) => {
      const row = db.get<{ correct_index: number | null; type: string }>(
        "SELECT correct_index, type FROM questions WHERE id = ? AND owner_id = ?",
        question.id,
        ownerId,
      )!;
      return row.type === "mcq"
        ? { questionId: question.id, selectedIndex: ((row.correct_index ?? 0) + 1) % 4 }
        : { questionId: question.id, answerText: "I do not know." };
    });
    const secondResult = await submitAttempt(ownerId, second.attemptId, {
      answers: wrongAnswers,
    });
    expect(secondResult.planUpdated).toBe(true);

    const active = getActivePlan(ownerId, subjectId);
    expect(active?.version).toBe(2);
    expect(active?.trigger).toBe("new_assessment");
    expect(active?.tasks.every((task) => task.status === "pending")).toBe(true);
    expect(active?.changeSummary.length).toBeGreaterThan(0);

    const history = listPlanHistory(ownerId, subjectId);
    const superseded = history.find((entry) => entry.version === 1);
    expect(superseded?.status).toBe("superseded");
    expect(superseded?.tasks.find((task) => task.id === completed.id)?.status).toBe("completed");
  });

  it("returns a citation-backed answer for an answerable question", async () => {
    const preSubmit = getQuizView(ownerId, firstAttemptId);
    const correctAnswers = preSubmit.questions.map((question) => {
      const row = db.get<{ correct_index: number | null; expected_answer: string; type: string }>(
        "SELECT correct_index, expected_answer, type FROM questions WHERE id = ? AND owner_id = ?",
        question.id,
        ownerId,
      )!;
      return row.type === "mcq"
        ? { questionId: question.id, selectedIndex: row.correct_index ?? 0 }
        : { questionId: question.id, answerText: row.expected_answer };
    });
    await submitAttempt(ownerId, firstAttemptId, { answers: correctAnswers });

    const answer = await explainTopic({
      ownerId,
      subjectId,
      request: {
        topicId,
        question: "What controls which substances enter and leave the cell?",
        mode: "topic",
      },
    });
    expect(answer.sufficient).toBe(true);
    expect(answer.method).toBe("deterministic-extractive");
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.answerMarkdown.length).toBeGreaterThan(0);
    expect(answer.answerMarkdown).not.toMatch(/\[P\d+\]/i);
    expect(answer.answerMarkdown).toContain("Check the source details below");
    for (const citation of answer.citations) {
      expect(citation.documentId).toBe(documentId);
      expect(citation.chunkId).toBeTruthy();
    }
  });

  it("abstains when a topic has no indexed evidence", async () => {
    const context = getTopicContext(ownerId, topicId);
    const manualTopicId = "manual-ribosome-topic";
    db.run(
      `INSERT INTO topics
        (id, owner_id, subject_id, parent_id, name, description, importance, position,
         source_document_id, source_page, created_at)
       VALUES (?, ?, ?, NULL, 'Ribosomes', 'Not covered by the synthetic source.', 50, 99, NULL, NULL, ?)`,
      manualTopicId,
      ownerId,
      context.topic.subject_id,
      new Date().toISOString(),
    );

    const answer = await explainTopic({
      ownerId,
      subjectId,
      request: {
        topicId: manualTopicId,
        question: "Describe the structure and function of a ribosome.",
        mode: "topic",
      },
    });
    expect(answer.sufficient).toBe(false);
    expect(answer.answerMarkdown).toBe("");
    expect(answer.citations).toEqual([]);
    expect(answer.method).toBe("none");
  });
});

describe("authorization and isolation", () => {
  it("returns 404 when another account requests this workspace's resources", () => {
    expectNotFound(() => getDocumentDetail(otherId, documentId));
    expectNotFound(() => getQuizView(otherId, firstAttemptId));
    expectNotFound(() => getGapReport(otherId, subjectId));
    expectNotFound(() => getTopicContext(otherId, topicId));
    expectNotFound(() => getProgressOverview(otherId, subjectId));
  });
});
