import { db, newId, nowIso, transaction } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { marksFor } from "@/lib/domain/scoring";
import { resolveQuestionSources } from "@/lib/domain/citations";
import { questionPromptHash } from "@/lib/domain/question-hash";
import type {
  Difficulty,
  EvidenceChunk,
  GeneratedQuestion,
  QuestionType,
} from "@/lib/domain/types";

export interface QuestionRow {
  id: string;
  owner_id: string;
  subject_id: string;
  topic_id: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  options_json: string | null;
  correct_index: number | null;
  expected_answer: string;
  rubric_json: string;
  marks: number;
  generator: string;
  prompt_hash: string;
  created_at: string;
}

export interface QuestionBankEntry {
  id: string;
  topicId: string;
  topicName: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  marks: number;
  generator: string;
  createdAt: string;
  sourceCount: number;
  attemptCount: number;
}

function parseOptions(row: QuestionRow): string[] {
  if (!row.options_json) return [];
  try {
    const parsed = JSON.parse(row.options_json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function promptHashesForSubject(ownerId: string, subjectId: string): Set<string> {
  const rows = db.all<{ prompt_hash: string }>(
    "SELECT prompt_hash FROM questions WHERE owner_id = ? AND subject_id = ?",
    ownerId,
    subjectId,
  );
  return new Set(rows.map((row) => row.prompt_hash));
}

export function listQuestionBank(
  ownerId: string,
  subjectId: string,
  topicIds?: string[],
): QuestionBankEntry[] {
  const topicFilter =
    topicIds && topicIds.length > 0
      ? `AND q.topic_id IN (${topicIds.map(() => "?").join(",")})`
      : "";

  const rows = db.all<
    QuestionRow & { topic_name: string; source_count: number; attempt_count: number }
  >(
    `SELECT q.*, t.name AS topic_name,
            (SELECT COUNT(*) FROM question_sources qs WHERE qs.question_id = q.id) AS source_count,
            (SELECT COUNT(DISTINCT a.attempt_id) FROM answers a WHERE a.question_id = q.id) AS attempt_count
       FROM questions q
       JOIN topics t ON t.id = q.topic_id
      WHERE q.owner_id = ? AND q.subject_id = ? ${topicFilter}
      ORDER BY q.created_at ASC`,
    ownerId,
    subjectId,
    ...(topicIds ?? []),
  );

  return rows
    .filter((row) => row.source_count > 0)
    .map((row) => ({
      id: row.id,
      topicId: row.topic_id,
      topicName: row.topic_name,
      type: row.type,
      difficulty: row.difficulty,
      prompt: row.prompt,
      options: parseOptions(row),
      marks: row.marks,
      generator: row.generator,
      createdAt: row.created_at,
      sourceCount: row.source_count,
      attemptCount: row.attempt_count,
    }));
}

export function getQuestionOwned(ownerId: string, questionId: string): QuestionRow {
  const row = db.get<QuestionRow>(
    "SELECT * FROM questions WHERE id = ? AND owner_id = ?",
    questionId,
    ownerId,
  );
  if (!row) throw notFound("That question was not found.");
  return row;
}

export function getQuestionEvidence(ownerId: string, questionId: string): EvidenceChunk[] {
  const rows = db.all<{
    chunk_id: string;
    document_id: string;
    filename: string;
    kind: string;
    page_number: number | null;
    section_heading: string | null;
    text: string;
    rank: number;
  }>(
    `SELECT c.id AS chunk_id, c.document_id, d.filename, d.kind, c.page_number,
            c.section_heading, c.text, qs.rank
       FROM question_sources qs
       JOIN document_chunks c ON c.id = qs.chunk_id
       JOIN documents d ON d.id = c.document_id
      WHERE qs.question_id = ? AND qs.owner_id = ? AND d.status = 'ready'
      ORDER BY qs.rank ASC`,
    questionId,
    ownerId,
  );

  return rows.map((row, index) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentTitle: row.filename,
    documentKind: row.kind,
    pageNumber: row.page_number,
    sectionHeading: row.section_heading,
    text: row.text,
    semanticScore: 1,
    lexicalScore: 1,
    score: 1,
    rank: index + 1,
  }));
}

export interface PersistResult {
  stored: QuestionRow[];
  rejected: number;
}

/**
 * Persists generated questions after enforcing that every cited chunk is part of
 * the evidence retrieved for the target topic. Page/section metadata is copied
 * from the database record, never from model output.
 */
export function persistGeneratedQuestions(input: {
  ownerId: string;
  subjectId: string;
  topicId: string;
  questions: GeneratedQuestion[];
  evidence: EvidenceChunk[];
  generator: "gemini" | "deterministic";
}): PersistResult {
  const evidenceById = new Map(input.evidence.map((chunk) => [chunk.chunkId, chunk]));
  const stored: QuestionRow[] = [];
  let rejected = 0;

  transaction(() => {
    const existingHashes = promptHashesForSubject(input.ownerId, input.subjectId);
    for (const generated of input.questions) {
      let resolved;
      try {
        resolved = resolveQuestionSources(generated.sourceChunkIds, input.evidence);
      } catch {
        rejected += 1;
        continue;
      }

      const options =
        generated.type === "mcq"
          ? (generated.options ?? []).map((option) => option.replace(/\s+/g, " ").trim())
          : [];
      if (generated.type === "mcq") {
        if (
          options.length !== 4 ||
          new Set(options.map((option) => option.toLowerCase())).size !== 4 ||
          generated.correctIndex === undefined ||
          generated.correctIndex < 0 ||
          generated.correctIndex > 3
        ) {
          rejected += 1;
          continue;
        }
      }

      const promptHash = questionPromptHash(generated.prompt);
      if (existingHashes.has(promptHash)) {
        rejected += 1;
        continue;
      }

      const id = newId();
      const marks = marksFor(generated.type, generated.difficulty);
      const expectedAnswer =
        generated.type === "mcq" && generated.correctIndex !== undefined
          ? options[generated.correctIndex]
          : generated.expectedAnswer;

      if (!expectedAnswer || !generated.prompt || generated.rubric.length === 0) {
        rejected += 1;
        continue;
      }

      db.run(
        `INSERT INTO questions
          (id, owner_id, subject_id, topic_id, type, difficulty, prompt, options_json, correct_index,
           expected_answer, rubric_json, marks, generator, prompt_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.ownerId,
        input.subjectId,
        input.topicId,
        generated.type,
        generated.difficulty,
        generated.prompt.trim(),
        generated.type === "mcq" ? JSON.stringify(options) : null,
        generated.type === "mcq" ? (generated.correctIndex ?? null) : null,
        expectedAnswer,
        JSON.stringify([...new Set(generated.rubric)].slice(0, 6)),
        marks,
        input.generator,
        promptHash,
        nowIso(),
      );

      for (const [rank, citation] of resolved.sources.entries()) {
        const chunk = evidenceById.get(citation.chunkId);
        if (!chunk) continue;
        db.run(
          `INSERT OR IGNORE INTO question_sources
            (question_id, chunk_id, owner_id, document_id, page_number, section_heading, rank)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id,
          chunk.chunkId,
          input.ownerId,
          chunk.documentId,
          chunk.pageNumber,
          chunk.sectionHeading,
          rank,
        );
      }

      existingHashes.add(promptHash);
      stored.push(getQuestionOwned(input.ownerId, id));
    }
  });

  return { stored, rejected };
}

export function assertQuestionBankUsable(ownerId: string, subjectId: string): void {
  const count = db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM questions WHERE owner_id = ? AND subject_id = ?",
    ownerId,
    subjectId,
  );
  if (!count || count.count === 0) {
    throw new AppError(404, "NOT_FOUND", "No questions have been generated for this subject yet.");
  }
}
