import { z } from "zod";
import { db, newId, nowIso } from "@/lib/db";
import { detectHeading } from "@/lib/domain/chunking";
import { notFound, validationError } from "@/lib/errors";
import { getSubjectOwned } from "@/lib/services/subjects";
import { assertWritableAccount } from "@/lib/services/guards";
import type { TopicClassification } from "@/lib/domain/types";

export interface TopicRow {
  id: string;
  owner_id: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  importance: number;
  position: number;
  source_document_id: string | null;
  source_page: number | null;
  created_at: string;
}

export interface TopicView {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  importance: number;
  sourceDocumentId: string | null;
  sourcePage: number | null;
  childCount: number;
  mastery: number | null;
  classification: TopicClassification;
  sufficient: boolean;
  evidenceAnswers: number;
  evidenceMarks: number;
  questionCount: number;
  sourceCount: number;
  lastAssessedAt: string | null;
}

interface TopicListRow extends TopicRow {
  parent_name: string | null;
  child_count: number;
  mastery: number | null;
  classification: TopicClassification | null;
  sufficientMarks: number | null;
  evidence_answers: number | null;
  evidence_marks: number | null;
  last_assessed_at: string | null;
  question_count: number;
  source_count: number;
}

const UNIT_PATTERN = /^(unit|chapter|section|module|part)\s+([0-9]+|[ivxlcdm]+)\b[.:)\s-]*(.*)$/i;
const NUMBERED_PATTERN = /^(\d+(?:\.\d+){0,3})\.?\s+([A-Z][^.!?]{1,90})$/;

const createTopicSchema = z.object({
  name: z.string().trim().min(2, "Give the topic a name.").max(120),
  description: z.string().trim().max(500).optional().default(""),
  parentId: z.string().trim().min(1).max(64).optional(),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export { createTopicSchema };

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleCase(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .split(" ")
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
      .join(" ");
  }
  return trimmed;
}

async function findTopicByParentName(
  subjectId: string,
  parentId: string | null,
  name: string,
): Promise<TopicRow | undefined> {
  return await db.get<TopicRow>(
    `SELECT * FROM topics
      WHERE subject_id = ?
        AND COALESCE(parent_id, '') = COALESCE(?, '')
        AND lower(name) = lower(?)`,
    subjectId,
    parentId,
    name,
  );
}

async function insertTopic(input: {
  ownerId: string;
  subjectId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  importance: number;
  position: number;
  sourceDocumentId: string | null;
  sourcePage: number | null;
}): Promise<TopicRow> {
  const id = newId();
  await db.run(
    `INSERT INTO topics
      (id, owner_id, subject_id, parent_id, name, description, importance, position,
       source_document_id, source_page, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.ownerId,
    input.subjectId,
    input.parentId,
    input.name,
    input.description,
    input.importance,
    input.position,
    input.sourceDocumentId,
    input.sourcePage,
    nowIso(),
  );
  return getTopicOwnedById(input.ownerId, id);
}

async function linkTopicSource(input: {
  topicId: string;
  chunkId: string;
  ownerId: string;
  subjectId: string;
  rank: number;
  score: number;
}): Promise<void> {
  await db.run(
    `INSERT INTO topic_sources (topic_id, chunk_id, owner_id, subject_id, rank, score)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
    input.topicId,
    input.chunkId,
    input.ownerId,
    input.subjectId,
    input.rank,
    input.score,
  );
}

interface ExtractionChunk {
  id: string;
  document_id: string;
  text: string;
  page_number: number | null;
  chunk_index: number;
  filename: string;
  kind: string;
}

interface ParsedHeading {
  level: "unit" | "item";
  name: string;
  raw: string;
  chunk: ExtractionChunk;
}

const MAX_TOPICS = 80;

function parseSyllabusLines(chunks: ExtractionChunk[]): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  for (const chunk of chunks) {
    const lines = chunk.text.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.length > 140) continue;

      const unit = UNIT_PATTERN.exec(line);
      if (unit) {
        const suffix = unit[3]?.trim() ?? "";
        const label = `${titleCase(unit[1])} ${unit[2]}${suffix ? `: ${titleCase(suffix)}` : ""}`;
        headings.push({ level: "unit", name: label, raw: line, chunk });
        continue;
      }

      const numbered = NUMBERED_PATTERN.exec(line);
      if (numbered) {
        headings.push({
          level: "item",
          name: titleCase(numbered[2]),
          raw: line,
          chunk,
        });
        continue;
      }

      if (detectHeading(line) === line && line.length <= 100) {
        headings.push({ level: "item", name: titleCase(line), raw: line, chunk });
      }
    }
  }
  return headings;
}

function describeFromChunk(
  chunk: ExtractionChunk,
  headingLine: string,
): string | null {
  const index = chunk.text.indexOf(headingLine);
  if (index < 0) return null;
  const remainder = chunk.text.slice(index + headingLine.length);
  const nextHeading = remainder
    .split("\n")
    .findIndex((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return (
        UNIT_PATTERN.test(trimmed) ||
        NUMBERED_PATTERN.test(trimmed) ||
        trimmed === detectHeading(trimmed)
      );
    });
  const body =
    nextHeading >= 0
      ? remainder.split("\n").slice(0, nextHeading).join(" ")
      : remainder.split("\n").join(" ");
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length < 12) return null;
  return cleaned.slice(0, 420);
}

async function extractionSourceChunks(ownerId: string, subjectId: string): Promise<ExtractionChunk[]> {
  const syllabus = await db.all<ExtractionChunk>(
    `SELECT c.id, c.document_id, c.text, c.page_number, c.chunk_index, d.filename, d.kind
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.owner_id = ? AND c.subject_id = ? AND d.status = 'ready'
        AND d.kind = 'syllabus'
      ORDER BY c.document_id, c.chunk_index`,
    ownerId,
    subjectId,
  );
  if (syllabus.length > 0) return syllabus;

  return db.all<ExtractionChunk>(
    `SELECT c.id, c.document_id, c.text, c.page_number, c.chunk_index, d.filename, d.kind
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.owner_id = ? AND c.subject_id = ? AND d.status = 'ready'
      ORDER BY c.document_id, c.chunk_index`,
    ownerId,
    subjectId,
  );
}

export interface ExtractionResult {
  created: number;
  linked: number;
  source: "syllabus" | "all_material";
  message: string;
}

/**
 * Deterministic syllabus parser. It only creates topics from heading structures
 * actually present in the uploaded material and links each topic to the chunk
 * (and therefore the page) where the heading appeared.
 */
export async function extractTopics(
  ownerId: string,
  subjectId: string,
  options: { allowDemo?: boolean } = {},
): Promise<ExtractionResult> {
  if (!options.allowDemo) {
    await assertWritableAccount(ownerId, "topic extraction");
  }
  await getSubjectOwned(ownerId, subjectId);
  const chunks = await extractionSourceChunks(ownerId, subjectId);
  if (chunks.length === 0) {
    throw validationError(
      "No indexed material is available. Upload and process a syllabus or study notes first.",
    );
  }

  const hasSyllabus = chunks.some((chunk) => chunk.kind === "syllabus");
  const headings = parseSyllabusLines(
    hasSyllabus ? chunks.filter((chunk) => chunk.kind === "syllabus") : chunks,
  ).filter((heading) => heading.name.length >= 3);

  if (headings.length === 0) {
    throw validationError(
      "No unit or topic headings were found in the material. Upload a syllabus with headings such as 'Unit 1' or '1.1 Cell membrane', or create a topic manually.",
    );
  }

  let created = 0;
  let linked = 0;
  let currentUnit: TopicRow | null = null;
  const seen = new Set<string>();
  const existingCount = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM topics WHERE owner_id = ? AND subject_id = ?",
    ownerId,
    subjectId,
  );
  let position = existingCount?.count ?? 0;

  for (const heading of headings) {
    if (position >= MAX_TOPICS) break;
    const key = `${heading.level}:${normalizeName(heading.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (heading.level === "unit") {
      let topic = await findTopicByParentName(subjectId, null, heading.name);
      if (!topic) {
        topic = await insertTopic({
          ownerId,
          subjectId,
          parentId: null,
          name: heading.name,
          description: describeFromChunk(heading.chunk, heading.raw),
          importance: 75,
          position,
          sourceDocumentId: heading.chunk.document_id,
          sourcePage: heading.chunk.page_number,
        });
        position += 1;
        created += 1;
      }
      currentUnit = topic;
      await linkTopicSource({
        topicId: topic.id,
        chunkId: heading.chunk.id,
        ownerId,
        subjectId,
        rank: 0,
        score: 1,
      });
      linked += 1;
      continue;
    }

    // A flat syllabus without units keeps topics at the root.
    const parentId = currentUnit?.id ?? null;
    let topic = await findTopicByParentName(subjectId, parentId, heading.name);
    if (!topic) {
      topic = await insertTopic({
        ownerId,
        subjectId,
        parentId,
        name: heading.name,
        description: describeFromChunk(heading.chunk, heading.raw),
        importance: 60,
        position,
        sourceDocumentId: heading.chunk.document_id,
        sourcePage: heading.chunk.page_number,
      });
      position += 1;
      created += 1;
    }
    await linkTopicSource({
      topicId: topic.id,
      chunkId: heading.chunk.id,
      ownerId,
      subjectId,
      rank: 1,
      score: 1,
    });
    linked += 1;
  }

  return {
    created,
    linked,
    source: hasSyllabus ? "syllabus" : "all_material",
    message:
      created === 0
        ? "The topic map already contains every heading found in this material."
        : `Added ${created} topic${created === 1 ? "" : "s"} and linked ${linked} source reference${linked === 1 ? "" : "s"}.`,
  };
}

export async function createTopic(input: {
  ownerId: string;
  subjectId: string;
  payload: CreateTopicInput;
}): Promise<TopicView> {
  await assertWritableAccount(input.ownerId, "topic changes");
  await getSubjectOwned(input.ownerId, input.subjectId);
  let parentId: string | null = null;
  if (input.payload.parentId) {
    const parent = await getTopicOwnedById(input.ownerId, input.payload.parentId);
    if (
      parent.owner_id !== input.ownerId ||
      parent.subject_id !== input.subjectId ||
      parent.parent_id !== null
    ) {
      throw validationError("The selected parent topic is not available in this subject.");
    }
    parentId = parent.id;
  }

  const name = titleCase(input.payload.name);
  const duplicate = await findTopicByParentName(input.subjectId, parentId, name);
  if (duplicate) {
    throw validationError("A topic with that name already exists at this level.");
  }

  const count = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM topics WHERE owner_id = ? AND subject_id = ?",
    input.ownerId,
    input.subjectId,
  );
  const topic = await insertTopic({
    ownerId: input.ownerId,
    subjectId: input.subjectId,
    parentId,
    name,
    description: input.payload.description || null,
    importance: 60,
    position: count?.count ?? 0,
    sourceDocumentId: null,
    sourcePage: null,
  });
  return (await listTopics(input.ownerId, input.subjectId)).find((entry) => entry.id === topic.id)!;
}

async function getTopicOwnedById(userId: string, topicId?: string): Promise<TopicRow> {
  const topic = topicId
    ? await db.get<TopicRow>("SELECT * FROM topics WHERE id = ?", topicId)
    : undefined;
  if (!topic) throw notFound("That topic was not found.");
  if (topic.owner_id !== userId) throw notFound("That topic was not found.");
  return topic;
}

export async function getTopicOwned(
  ownerId: string,
  subjectId: string,
  topicId: string,
): Promise<TopicRow> {
  const topic = await getTopicOwnedById(ownerId, topicId);
  if (topic.subject_id !== subjectId) throw notFound("That topic was not found.");
  return topic;
}

export interface TopicContext {
  topic: TopicRow;
  subjectName: string;
}

export async function getTopicContext(ownerId: string, topicId: string): Promise<TopicContext> {
  const topic = await getTopicOwnedById(ownerId, topicId);
  const subject = await db.get<{ name: string }>(
    "SELECT name FROM subjects WHERE id = ? AND owner_id = ?",
    topic.subject_id,
    ownerId,
  );
  if (!subject) throw notFound("That topic was not found.");
  return { topic, subjectName: subject.name };
}

export async function listTopics(ownerId: string, subjectId: string): Promise<TopicView[]> {
  await getSubjectOwned(ownerId, subjectId);
  const rows = await db.all<TopicListRow>(
    `SELECT t.*,
            (SELECT p.name FROM topics p WHERE p.id = t.parent_id) AS parent_name,
            (SELECT COUNT(*) FROM topics c WHERE c.parent_id = t.id) AS child_count,
            (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id) AS question_count,
            (SELECT COUNT(*) FROM topic_sources ts WHERE ts.topic_id = t.id) AS source_count,
            latest.mastery,
            latest.classification,
            latest.evidence_answers,
            latest.evidence_marks,
            latest.created_at AS last_assessed_at
       FROM topics t
       LEFT JOIN (
         SELECT ms.topic_id, ms.mastery, ms.classification, ms.evidence_answers,
                ms.evidence_marks, ms.created_at,
                ROW_NUMBER() OVER (PARTITION BY ms.topic_id ORDER BY ms.created_at DESC, ms.id DESC) AS row_number
           FROM mastery_snapshots ms
          WHERE ms.owner_id = ? AND ms.subject_id = ?
       ) latest ON latest.topic_id = t.id AND latest.row_number = 1
      WHERE t.owner_id = ? AND t.subject_id = ?
      ORDER BY t.position ASC, t.name ASC`,
    ownerId,
    subjectId,
    ownerId,
    subjectId,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    parentId: row.parent_id,
    parentName: row.parent_name,
    importance: row.importance,
    sourceDocumentId: row.source_document_id,
    sourcePage: row.source_page,
    childCount: row.child_count,
    mastery: row.mastery,
    classification:
      row.classification ??
      ((row.sufficientMarks ?? 0) > 0 ? "not_assessed" : "not_assessed"),
    sufficient: row.classification !== null && row.classification !== "not_assessed",
    evidenceAnswers: row.evidence_answers ?? 0,
    evidenceMarks: row.evidence_marks ?? 0,
    questionCount: row.question_count,
    sourceCount: row.source_count,
    lastAssessedAt: row.last_assessed_at,
  }));
}

export async function listLeafTopics(ownerId: string, subjectId: string): Promise<TopicView[]> {
  return (await listTopics(ownerId, subjectId)).filter((topic) => topic.childCount === 0);
}

export interface TopicSourceView {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  sectionHeading: string | null;
  excerpt: string;
}

export async function getTopicSources(ownerId: string, topicId: string): Promise<TopicSourceView[]> {
  const topic = await getTopicOwnedById(ownerId, topicId);
  const rows = await db.all<{
    chunk_id: string;
    document_id: string;
    filename: string;
    page_number: number | null;
    section_heading: string | null;
    text: string;
  }>(
    `SELECT c.id AS chunk_id, c.document_id, d.filename, c.page_number, c.section_heading, c.text
       FROM topic_sources ts
       JOIN document_chunks c ON c.id = ts.chunk_id
       JOIN documents d ON d.id = c.document_id
      WHERE ts.topic_id = ? AND ts.owner_id = ? AND d.status = 'ready'
      ORDER BY ts.rank ASC, ts.score DESC
      LIMIT 12`,
    topic.id,
    ownerId,
  );

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentTitle: row.filename,
    pageNumber: row.page_number,
    sectionHeading: row.section_heading,
    excerpt: row.text.replace(/\s+/g, " ").slice(0, 360),
  }));
}

export interface TopicPrerequisiteView {
  prerequisiteId: string;
  prerequisiteName: string;
  status: string;
  evidence: string | null;
  prerequisiteClassification: TopicClassification;
}

export async function getPrerequisites(ownerId: string, topicId: string): Promise<TopicPrerequisiteView[]> {
  const rows = await db.all<{
    prerequisite_id: string;
    prerequisite_name: string;
    status: string;
    evidence: string | null;
    classification: TopicClassification | null;
  }>(
    `SELECT d.prerequisite_topic_id AS prerequisite_id,
            p.name AS prerequisite_name,
            d.status,
            d.evidence,
            (SELECT ms.classification
               FROM mastery_snapshots ms
              WHERE ms.topic_id = d.prerequisite_topic_id AND ms.owner_id = d.owner_id
              ORDER BY ms.created_at DESC LIMIT 1) AS classification
       FROM topic_dependencies d
       JOIN topics p ON p.id = d.prerequisite_topic_id
      WHERE d.topic_id = ? AND d.owner_id = ?`,
    topicId,
    ownerId,
  );

  return rows.map((row) => ({
    prerequisiteId: row.prerequisite_id,
    prerequisiteName: row.prerequisite_name,
    status: row.status,
    evidence: row.evidence,
    prerequisiteClassification: row.classification ?? "not_assessed",
  }));
}

export async function topicQuestionCount(ownerId: string, topicId: string): Promise<number> {
  const row = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM questions WHERE owner_id = ? AND topic_id = ?",
    ownerId,
    topicId,
  );
  return row?.count ?? 0;
}
