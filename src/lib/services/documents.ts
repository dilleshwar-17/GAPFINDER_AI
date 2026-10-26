import { createHash } from "node:crypto";
import { z } from "zod";
import { db, newId, nowIso, transaction } from "@/lib/db";
import { embedTexts, ProviderError, vectorToBlob } from "@/lib/ai/embeddings";
import { getEmbeddingConfig, maxUploadBytes } from "@/lib/env";
import { AppError, conflict, notFound, validationError } from "@/lib/errors";
import { chunkPages, CHUNKING_CONFIG } from "@/lib/domain/chunking";
import { extractDocument, ExtractionError } from "@/lib/ingest/extract";
import { getSubjectOwned } from "@/lib/services/subjects";
import { assertWritableAccount, isDemoUser } from "@/lib/services/guards";

export const documentKindSchema = z.enum(["syllabus", "notes", "past_paper", "other"]);
export type DocumentKind = z.infer<typeof documentKindSchema>;

const MAX_CHUNKS_PER_DOCUMENT = 400;
const SUPPORTED_TEXT_EXTENSIONS = [".txt", ".md", ".markdown"];

export interface DocumentRow {
  id: string;
  owner_id: string;
  subject_id: string;
  filename: string;
  mime_type: string;
  kind: DocumentKind;
  size_bytes: number;
  sha256: string;
  file_data: Uint8Array | null;
  status: "processing" | "ready" | "failed";
  error_message: string | null;
  page_count: number | null;
  char_count: number | null;
  chunk_count: number;
  created_at: string;
  processed_at: string | null;
}

export interface DocumentView {
  id: string;
  filename: string;
  kind: DocumentKind;
  mimeType: string;
  sizeBytes: number;
  status: "processing" | "ready" | "failed";
  errorMessage: string | null;
  pageCount: number | null;
  chunkCount: number;
  createdAt: string;
  processedAt: string | null;
  citationCount: number;
}

export interface LibraryDocument extends DocumentView {
  subjectId: string;
  subjectName: string;
  subjectIsDemo: boolean;
  excerpt: string | null;
}


function classifyFile(filename: string, mimeType: string): "pdf" | "text" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (SUPPORTED_TEXT_EXTENSIONS.some((extension) => lower.endsWith(extension))) return "text";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/plain" || mimeType === "text/markdown") return "text";
  throw new AppError(
    415,
    "UNSUPPORTED_FILE",
    "Unsupported file type. Upload a PDF, .txt, or .md file.",
  );
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof ExtractionError) return error.message;
  if (error instanceof ProviderError) {
    return "Embedding generation failed. Check the AI provider configuration, then retry processing.";
  }
  if (error instanceof AppError) return error.message;
  return "The document could not be processed. Check that the file is readable and try again.";
}

function mapProcessingError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ExtractionError) {
    return new AppError(422, "EXTRACTION_FAILED", error.message);
  }
  if (error instanceof ProviderError) {
    return new AppError(
      502,
      "PROVIDER_UNAVAILABLE",
      "Embeddings could not be generated, so the document was not indexed. Check the provider configuration and retry.",
    );
  }
  return new AppError(500, "INTERNAL_ERROR", safeErrorMessage(error));
}

export async function listDocuments(ownerId: string, subjectId: string): Promise<DocumentView[]> {
  await getSubjectOwned(ownerId, subjectId);
  const rows = await db.all<DocumentRow>(
    "SELECT * FROM documents WHERE owner_id = ? AND subject_id = ? ORDER BY created_at DESC",
    ownerId,
    subjectId,
  );

  return Promise.all(rows.map(async (row) => {
    const citations = await db.get<{ count: number }>(
      `SELECT COUNT(DISTINCT qs.question_id) AS count
         FROM question_sources qs
        WHERE qs.owner_id = ? AND qs.document_id = ?`,
      ownerId,
      row.id,
    );
    return {
      id: row.id,
      filename: row.filename,
      kind: row.kind,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status: row.status,
      errorMessage: row.error_message,
      pageCount: row.page_count,
      chunkCount: row.chunk_count,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      citationCount: citations?.count ?? 0,
    };
  }));
}

export async function listAllDocuments(ownerId: string): Promise<LibraryDocument[]> {
  const rows = await db.all<
    DocumentRow & { subject_name: string; subject_is_demo: number; excerpt: string | null }
  >(
    `SELECT d.*, s.name AS subject_name, s.is_demo AS subject_is_demo,
            (SELECT c.text FROM document_chunks c
              WHERE c.document_id = d.id ORDER BY c.chunk_index ASC LIMIT 1) AS excerpt
       FROM documents d
       JOIN subjects s ON s.id = d.subject_id
      WHERE d.owner_id = ?
      ORDER BY d.created_at DESC`,
    ownerId,
  );

  return Promise.all(rows.map(async (row) => {
    const citations = await db.get<{ count: number }>(
      `SELECT COUNT(DISTINCT qs.question_id) AS count
         FROM question_sources qs
        WHERE qs.owner_id = ? AND qs.document_id = ?`,
      ownerId,
      row.id,
    );
    return {
      id: row.id,
      filename: row.filename,
      kind: row.kind,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status: row.status,
      errorMessage: row.error_message,
      pageCount: row.page_count,
      chunkCount: row.chunk_count,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      citationCount: citations?.count ?? 0,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      subjectIsDemo: row.subject_is_demo === 1,
      excerpt: row.excerpt ? row.excerpt.replace(/\s+/g, " ").slice(0, 260) : null,
    };
  }));
}

export interface DocumentChunkView {
  id: string;
  chunkIndex: number;
  excerpt: string;
  charCount: number;
  pageNumber: number | null;
  sectionHeading: string | null;
  citationCount: number;
}

export interface DocumentDetail {
  document: LibraryDocument;
  chunks: DocumentChunkView[];
}

export async function getDocumentDetail(ownerId: string, documentId: string): Promise<DocumentDetail> {
  const document = (await listAllDocuments(ownerId)).find((entry) => entry.id === documentId);
  if (!document) throw notFound("That document was not found in your workspace.");

  const rows = await db.all<{
    id: string;
    chunk_index: number;
    text: string;
    page_number: number | null;
    section_heading: string | null;
    citation_count: number;
  }>(
    `SELECT c.id, c.chunk_index, c.text, c.page_number, c.section_heading,
            (SELECT COUNT(DISTINCT qs.question_id) FROM question_sources qs
              WHERE qs.chunk_id = c.id) AS citation_count
       FROM document_chunks c
      WHERE c.owner_id = ? AND c.document_id = ?
      ORDER BY c.chunk_index ASC
      LIMIT 60`,
    ownerId,
    documentId,
  );

  return {
    document,
    chunks: rows.map((row) => ({
      id: row.id,
      chunkIndex: row.chunk_index,
      excerpt: row.text.replace(/\s+/g, " ").slice(0, 520),
      charCount: row.text.length,
      pageNumber: row.page_number,
      sectionHeading: row.section_heading,
      citationCount: row.citation_count,
    })),
  };
}

export async function getDocumentOwned(ownerId: string, documentId: string): Promise<DocumentRow> {
  const document = await db.get<DocumentRow>(
    "SELECT * FROM documents WHERE id = ? AND owner_id = ?",
    documentId,
    ownerId,
  );
  if (!document) throw notFound("That document was not found in your workspace.");
  return document;
}

async function processStoredDocument(document: DocumentRow): Promise<void> {
  if (!document.file_data) {
    throw new AppError(
      422,
      "EXTRACTION_FAILED",
      "The stored file is no longer available for processing. Delete it and upload the file again.",
    );
  }

  try {
    const extracted = await extractDocument({
      bytes: document.file_data,
      mimeType: document.mime_type,
      filename: document.filename,
    });

    const chunks = chunkPages(extracted.pages);
    if (chunks.length === 0) {
      throw new AppError(
        422,
        "EXTRACTION_FAILED",
        "The document produced no usable text chunks. Check the file and retry.",
      );
    }
    if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        `This document produced ${chunks.length} chunks, above the ${MAX_CHUNKS_PER_DOCUMENT}-chunk limit. Split it into smaller files.`,
      );
    }

    const config = getEmbeddingConfig();
    const embedded = await embedTexts(
      chunks.map((chunk) => (chunk.sectionHeading ? `${chunk.sectionHeading}\n\n${chunk.text}` : chunk.text)),
      "document",
      config,
    );
    if (embedded.vectors.length !== chunks.length) {
      throw new ProviderError("Embedding count did not match the chunk count.", { retryable: false });
    }

    await transaction(async () => {
      await db.run("DELETE FROM document_chunks WHERE document_id = ?", document.id);
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const vector = embedded.vectors[index];
        if (vector.length !== config.dimensions) {
          throw new ProviderError("Embedding dimension mismatch.", { retryable: false });
        }
        await db.run(
          `INSERT INTO document_chunks
            (id, document_id, owner_id, subject_id, chunk_index, text, page_number, section_heading,
             char_start, char_end, embedding, embedding_model, embedding_dim, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newId(),
          document.id,
          document.owner_id,
          document.subject_id,
          chunk.chunkIndex,
          chunk.text,
          chunk.pageNumber,
          chunk.sectionHeading,
          chunk.charStart,
          chunk.charEnd,
          vectorToBlob(vector),
          embedded.model,
          embedded.dimensions,
          nowIso(),
        );
      }
      await db.run(
        `UPDATE documents
            SET status = 'ready', error_message = NULL, page_count = ?, char_count = ?,
                chunk_count = ?, processed_at = ?
          WHERE id = ?`,
        extracted.pageCount,
        extracted.charCount,
        chunks.length,
        nowIso(),
        document.id,
      );
    });
  } catch (error) {
    const mapped = mapProcessingError(error);
    await db.run(
      "UPDATE documents SET status = 'failed', error_message = ?, processed_at = ?, chunk_count = 0 WHERE id = ?",
      mapped.message,
      nowIso(),
      document.id,
    );
    throw mapped;
  }
}

export interface UploadInput {
  ownerId: string;
  subjectId: string;
  filename: string;
  mimeType: string;
  kind: DocumentKind;
  bytes: Uint8Array;
  /** Reserved for the idempotent demo seeding routine. */
  allowDemo?: boolean;
}

export async function ingestDocument(input: UploadInput): Promise<DocumentView> {
  await getSubjectOwned(input.ownerId, input.subjectId);
  if (!input.allowDemo) {
    await assertWritableAccount(input.ownerId, "material uploads");
  }

  if (input.bytes.length === 0) {
    throw validationError("The selected file is empty.");
  }
  if (input.bytes.length > maxUploadBytes()) {
    throw new AppError(
      413,
      "FILE_TOO_LARGE",
      `Files must be ${Math.round(maxUploadBytes() / (1024 * 1024))} MB or smaller.`,
    );
  }
  if (input.filename.length > 220) {
    throw validationError("The file name is too long.");
  }
  classifyFile(input.filename, input.mimeType);

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const duplicate = await db.get<{ id: string; filename: string }>(
    "SELECT id, filename FROM documents WHERE owner_id = ? AND subject_id = ? AND sha256 = ?",
    input.ownerId,
    input.subjectId,
    sha256,
  );
  if (duplicate) {
    throw conflict(`"${duplicate.filename}" is already in this subject. Delete it first to re-upload.`);
  }

  const id = newId();
  await db.run(
    `INSERT INTO documents
      (id, owner_id, subject_id, filename, mime_type, kind, size_bytes, sha256, file_data, status,
       error_message, page_count, char_count, chunk_count, created_at, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', NULL, NULL, NULL, 0, ?, NULL)`,
    id,
    input.ownerId,
    input.subjectId,
    input.filename,
    input.mimeType || "application/octet-stream",
    input.kind,
    input.bytes.length,
    sha256,
    input.bytes,
    nowIso(),
  );

  const stored = await getDocumentOwned(input.ownerId, id);
  await processStoredDocument(stored);
  return (await listDocuments(input.ownerId, input.subjectId)).find((document) => document.id === id)!;
}

export async function retryDocument(
  ownerId: string,
  documentId: string,
  options: { allowDemo?: boolean } = {},
): Promise<DocumentView> {
  const document = await getDocumentOwned(ownerId, documentId);
  if (!options.allowDemo) {
    await assertWritableAccount(ownerId, "document reprocessing");
  }
  if (document.status !== "failed") {
    throw conflict("Only failed documents need reprocessing.");
  }
  await db.run(
    "UPDATE documents SET status = 'processing', error_message = NULL, processed_at = NULL WHERE id = ? AND owner_id = ?",
    documentId,
    ownerId,
  );
  const refreshed = await getDocumentOwned(ownerId, documentId);
  await processStoredDocument(refreshed);
  return (await listDocuments(ownerId, document.subject_id)).find((entry) => entry.id === documentId)!;
}

export async function deleteDocument(ownerId: string, documentId: string): Promise<{ subjectId: string }> {
  await assertWritableAccount(ownerId, "document deletion");
  const document = await getDocumentOwned(ownerId, documentId);

  const answerCount = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM answers an
       JOIN question_sources qs ON qs.question_id = an.question_id
      WHERE qs.owner_id = ? AND qs.document_id = ?`,
    ownerId,
    documentId,
  );
  if ((answerCount?.count ?? 0) > 0) {
    throw conflict(
      "This document supports questions that have already been answered in saved attempts. It cannot be removed without breaking assessment history.",
    );
  }

  await transaction(async () => {
    await db.run(
      `DELETE FROM questions
        WHERE owner_id = ?
          AND id IN (SELECT question_id FROM question_sources WHERE document_id = ?)`,
      ownerId,
      documentId,
    );
    await db.run("DELETE FROM documents WHERE id = ? AND owner_id = ?", documentId, ownerId);
  });

  return { subjectId: document.subject_id };
}

export const CHUNKING_SUMMARY = CHUNKING_CONFIG;
