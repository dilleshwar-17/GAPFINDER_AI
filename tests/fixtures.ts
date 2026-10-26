import { db, nowIso } from "@/lib/db";

/**
 * Minimal relational fixtures for service-level tests. Tests always insert real
 * rows through the same schema the application uses, so ownership checks and
 * constraint behaviour are exercised rather than mocked.
 */

export async function insertUser(options: {
  id: string;
  email: string;
  isDemo?: boolean;
  displayName?: string;
}): Promise<void> {
  await db.run(
    `INSERT INTO users (id, email, password_hash, display_name, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    options.id,
    options.email,
    "test-hash-not-a-real-password",
    options.displayName ?? "Test User",
    options.isDemo === false ? 0 : 1,
    nowIso(),
  );
}

export async function insertSubject(options: {
  id: string;
  ownerId: string;
  name?: string;
}): Promise<void> {
  await db.run(
    `INSERT INTO subjects (id, owner_id, name, description, exam_date, is_demo, created_at)
     VALUES (?, ?, ?, '', NULL, 0, ?)`,
    options.id,
    options.ownerId,
    options.name ?? "Biology",
    nowIso(),
  );
}

export async function insertTopic(options: {
  id: string;
  ownerId: string;
  subjectId: string;
  name?: string;
}): Promise<void> {
  await db.run(
    `INSERT INTO topics
      (id, owner_id, subject_id, parent_id, name, description, importance, position,
       source_document_id, source_page, created_at)
     VALUES (?, ?, ?, NULL, ?, NULL, 50, 0, NULL, NULL, ?)`,
    options.id,
    options.ownerId,
    options.subjectId,
    options.name ?? "Photosynthesis",
    nowIso(),
  );
}

export async function insertMcq(options: {
  id: string;
  ownerId: string;
  subjectId: string;
  topicId: string;
  correctIndex?: number;
  marks?: number;
  prompt?: string;
}): Promise<void> {
  await db.run(
    `INSERT INTO questions
      (id, owner_id, subject_id, topic_id, type, difficulty, prompt, options_json,
       correct_index, expected_answer, rubric_json, marks, generator, prompt_hash, created_at)
     VALUES (?, ?, ?, ?, 'mcq', 'easy', ?, ?, ?, ?, '[]', ?, 'test-fixture', ?, ?)`,
    options.id,
    options.ownerId,
    options.subjectId,
    options.topicId,
    options.prompt ?? `Fixture question ${options.id}`,
    JSON.stringify(["Option A", "Option B", "Option C", "Option D"]),
    options.correctIndex ?? 1,
    "Option B",
    options.marks ?? 1,
    `hash-${options.id}`,
    nowIso(),
  );
}

export async function insertAttempt(options: {
  id: string;
  ownerId: string;
  subjectId: string;
  questionIds: string[];
  status?: "in_progress" | "submitted";
  score?: number | null;
  generator?: string;
}): Promise<void> {
  const marks = await Promise.all(
    options.questionIds.map(async (questionId) => {
      const row = await db.get<{ marks: number }>(
        "SELECT marks FROM questions WHERE id = ?",
        questionId,
      );
      return row?.marks ?? 0;
    }),
  );
  const totalMarks = marks.reduce((sum, value) => sum + value, 0);
  await db.run(
    `INSERT INTO quiz_attempts
      (id, owner_id, subject_id, status, question_ids_json, total_marks, score,
       started_at, submitted_at, generator, draft_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    options.id,
    options.ownerId,
    options.subjectId,
    options.status ?? "in_progress",
    JSON.stringify(options.questionIds),
    totalMarks,
    options.score ?? null,
    nowIso(),
    options.status === "submitted" ? nowIso() : null,
    options.generator ?? "deterministic-test",
  );
}

export interface AttemptFixture {
  userId: string;
  subjectId: string;
  topicId: string;
  questionIds: string[];
  attemptId: string;
}

/** Creates one user, subject, topic, N MCQ questions and an in-progress attempt. */
export async function createAttemptFixture(options: {
  suffix: string;
  questionCount?: number;
  correctIndex?: number;
  isDemo?: boolean;
}): Promise<AttemptFixture> {
  const suffix = options.suffix;
  const userId = `user-${suffix}`;
  const subjectId = `subject-${suffix}`;
  const topicId = `topic-${suffix}`;
  const attemptId = `attempt-${suffix}`;
  const questionCount = options.questionCount ?? 2;

  await insertUser({ id: userId, email: `${suffix}@example.test`, isDemo: options.isDemo });
  await insertSubject({ id: subjectId, ownerId: userId });
  await insertTopic({ id: topicId, ownerId: userId, subjectId });
  const questionIds = Array.from({ length: questionCount }, (_, index) => `question-${suffix}-${index}`);
  for (const [index, questionId] of questionIds.entries()) {
    await insertMcq({
      id: questionId,
      ownerId: userId,
      subjectId,
      topicId,
      correctIndex: options.correctIndex ?? 1,
      prompt: `Question ${index + 1} for ${suffix}`,
    });
  }
  await insertAttempt({ id: attemptId, ownerId: userId, subjectId, questionIds });

  return { userId, subjectId, topicId, questionIds, attemptId };
}
