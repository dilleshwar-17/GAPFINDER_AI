import { z } from "zod";
import { db, newId, nowIso } from "@/lib/db";
import { AppError, conflict, notFound } from "@/lib/errors";
import type { TopicClassification } from "@/lib/domain/types";
import { assertWritableAccount } from "@/lib/services/guards";

export interface SubjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  exam_date: string | null;
  is_demo: number;
  created_at: string;
}

export const subjectInputSchema = z.object({
  name: z.string().trim().min(2, "Give the subject a name.").max(100),
  description: z.string().trim().max(500).optional().default(""),
  examDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export function createSubject(input: {
  ownerId: string;
  name: string;
  description?: string;
  examDate?: string;
  isDemo?: boolean;
  allowDemo?: boolean;
}): SubjectRow {
  if (!input.allowDemo) {
    assertWritableAccount(input.ownerId, "subject creation");
  }
  const duplicate = db.get<{ id: string }>(
    "SELECT id FROM subjects WHERE owner_id = ? AND lower(name) = lower(?)",
    input.ownerId,
    input.name.trim(),
  );
  if (duplicate) throw conflict("You already have a subject with that name.");

  const id = newId();
  db.run(
    "INSERT INTO subjects (id, owner_id, name, description, exam_date, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    input.ownerId,
    input.name.trim(),
    input.description?.trim() || null,
    input.examDate?.trim() || null,
    input.isDemo ? 1 : 0,
    nowIso(),
  );
  return getSubjectOwned(input.ownerId, id);
}

export function getSubjectOwned(ownerId: string, subjectId: string): SubjectRow {
  const subject = db.get<SubjectRow>(
    "SELECT * FROM subjects WHERE id = ? AND owner_id = ?",
    subjectId,
    ownerId,
  );
  if (!subject) throw notFound("That subject was not found in your workspace.");
  return subject;
}

export interface SubjectSummary extends SubjectRow {
  readyDocuments: number;
  topicCount: number;
  submittedAttempts: number;
  assessedTopics: number;
  weakTopics: number;
  developingTopics: number;
  strongTopics: number;
  lastAttemptAt: string | null;
}

export function listSubjects(ownerId: string): SubjectSummary[] {
  const subjects = db.all<SubjectRow>(
    "SELECT * FROM subjects WHERE owner_id = ? ORDER BY created_at DESC",
    ownerId,
  );
  if (subjects.length === 0) return [];

  // One grouped query per aggregate instead of four queries per subject.
  const documentCounts = new Map<string, number>();
  for (const row of db.all<{ subject_id: string; count: number }>(
    `SELECT subject_id, COUNT(*) AS count
       FROM documents
      WHERE owner_id = ? AND status = 'ready'
      GROUP BY subject_id`,
    ownerId,
  )) {
    documentCounts.set(row.subject_id, row.count);
  }

  const topicCounts = new Map<string, number>();
  for (const row of db.all<{ subject_id: string; count: number }>(
    `SELECT subject_id, COUNT(*) AS count
       FROM topics
      WHERE owner_id = ?
      GROUP BY subject_id`,
    ownerId,
  )) {
    topicCounts.set(row.subject_id, row.count);
  }

  const attemptCounts = new Map<string, { count: number; last: string | null }>();
  for (const row of db.all<{ subject_id: string; count: number; last: string | null }>(
    `SELECT subject_id, COUNT(*) AS count, MAX(submitted_at) AS last
       FROM quiz_attempts
      WHERE owner_id = ? AND status = 'submitted'
      GROUP BY subject_id`,
    ownerId,
  )) {
    attemptCounts.set(row.subject_id, { count: row.count, last: row.last });
  }

  const bandCounts = new Map<string, number>();
  for (const row of db.all<{
    subject_id: string;
    classification: TopicClassification;
    count: number;
  }>(
    `WITH latest AS (
       SELECT ms.subject_id, ms.classification,
              ROW_NUMBER() OVER (
                PARTITION BY ms.topic_id
                ORDER BY ms.created_at DESC, ms.id DESC
              ) AS row_number
         FROM mastery_snapshots ms
        WHERE ms.owner_id = ?
     )
     SELECT subject_id, classification, COUNT(*) AS count
       FROM latest
      WHERE row_number = 1
      GROUP BY subject_id, classification`,
    ownerId,
  )) {
    bandCounts.set(`${row.subject_id}:${row.classification}`, row.count);
  }

  return subjects.map((subject) => {
    const attempts = attemptCounts.get(subject.id) ?? { count: 0, last: null };
    const countOf = (classification: TopicClassification) =>
      bandCounts.get(`${subject.id}:${classification}`) ?? 0;

    return {
      ...subject,
      readyDocuments: documentCounts.get(subject.id) ?? 0,
      topicCount: topicCounts.get(subject.id) ?? 0,
      submittedAttempts: attempts.count,
      assessedTopics:
        countOf("weak") + countOf("developing") + countOf("strong"),
      weakTopics: countOf("weak"),
      developingTopics: countOf("developing"),
      strongTopics: countOf("strong"),
      lastAttemptAt: attempts.last,
    };
  });
}

export function updateSubjectExamDate(
  ownerId: string,
  subjectId: string,
  examDate: string | null,
  options: { allowDemo?: boolean } = {},
): void {
  if (!options.allowDemo) {
    assertWritableAccount(ownerId, "subject changes");
  }
  getSubjectOwned(ownerId, subjectId);
  db.run("UPDATE subjects SET exam_date = ? WHERE id = ? AND owner_id = ?", examDate, subjectId, ownerId);
}

export function updateSubject(
  ownerId: string,
  subjectId: string,
  input: { name: string; description?: string; examDate?: string | null },
): SubjectRow {
  assertWritableAccount(ownerId, "subject changes");
  const subject = getSubjectOwned(ownerId, subjectId);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) {
    throw new AppError(400, "VALIDATION_ERROR", "Give the subject a name between 2 and 100 characters.");
  }
  const duplicate = db.get<{ id: string }>(
    "SELECT id FROM subjects WHERE owner_id = ? AND lower(name) = lower(?) AND id != ?",
    ownerId,
    name,
    subjectId,
  );
  if (duplicate) throw conflict("You already have a subject with that name.");
  db.run(
    "UPDATE subjects SET name = ?, description = ?, exam_date = ? WHERE id = ? AND owner_id = ?",
    name,
    input.description?.trim() || null,
    input.examDate?.trim() || null,
    subject.id,
    ownerId,
  );
  return getSubjectOwned(ownerId, subjectId);
}

/**
 * Deletion is refused once a submitted attempt exists: removing the subject
 * would cascade through attempts, answers and mastery history.
 */
export function deleteSubject(ownerId: string, subjectId: string): void {
  assertWritableAccount(ownerId, "subject deletion");
  getSubjectOwned(ownerId, subjectId);
  const attempts = db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM quiz_attempts WHERE owner_id = ? AND subject_id = ? AND status = 'submitted'",
    ownerId,
    subjectId,
  );
  if ((attempts?.count ?? 0) > 0) {
    throw conflict(
      "This subject has submitted assessment history, which cannot be deleted. Keep it for progress tracking, or create a new subject.",
    );
  }
  db.run("DELETE FROM subjects WHERE id = ? AND owner_id = ?", subjectId, ownerId);
}
