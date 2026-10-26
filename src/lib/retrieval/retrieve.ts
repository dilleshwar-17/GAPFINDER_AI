import { clamp01 } from "@/lib/domain/numbers";
import {
  blobToVector,
  cosineSimilarity,
  embedQuery,
  ProviderError,
  tokenizeForEmbedding,
} from "@/lib/ai/embeddings";
import { db } from "@/lib/db";
import { getEmbeddingConfig, minEvidenceChars, retrievalMinScore, retrievalTopK } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { EvidenceChunk } from "@/lib/domain/types";

interface ChunkCandidateRow {
  id: string;
  document_id: string;
  text: string;
  page_number: number | null;
  section_heading: string | null;
  embedding: Uint8Array | null;
  filename: string;
  kind: string;
}

export interface RetrievalResult {
  evidence: EvidenceChunk[];
  sufficient: boolean;
  reason: string | null;
  query: string;
  consideredChunks: number;
  matchedModelChunks: number;
  embedding: {
    provider: "local" | "gemini";
    model: string;
    dimensions: number;
  };
  scores: {
    topScore: number | null;
    totalChars: number;
    threshold: number;
  };
}

export interface RetrievalParams {
  ownerId: string;
  subjectId: string;
  query: string;
  topK?: number;
  minScore?: number;
  /** When set, only chunks from these authorized documents are considered. */
  documentIds?: string[];
}

function lexicalCoverage(queryTerms: Set<string>, text: string): number {
  if (queryTerms.size === 0) return 0;
  const chunkTerms = new Set(
    tokenizeForEmbedding(text).filter((token) => !token.includes(" ") && token.length >= 3),
  );
  if (chunkTerms.size === 0) return 0;
  let matches = 0;
  for (const term of queryTerms) if (chunkTerms.has(term)) matches += 1;
  return matches / queryTerms.size;
}

/**
 * Authorized exact vector retrieval over stored chunks.
 *
 * - Ownership and subject scope are enforced in SQL before any content leaves
 *   the database.
 * - Only chunks embedded with the *currently configured* model and dimension are
 *   compared; mixed-vector collections are never silently scored.
 * - Final ranking is a documented hybrid of cosine similarity (75%) and query
 *   term coverage (25%), which keeps retrieval inspectable and stable.
 */
export async function retrieveEvidence(params: RetrievalParams): Promise<RetrievalResult> {
  const config = getEmbeddingConfig();
  const topK = params.topK ?? retrievalTopK();
  const threshold = params.minScore ?? retrievalMinScore();
  const query = params.query.trim();

  if (!query) {
    throw new AppError(400, "VALIDATION_ERROR", "A retrieval query or topic is required.");
  }

  let queryVector: Float32Array;
  try {
    const embedded = await embedQuery(query);
    if (!embedded.vectors[0]) throw new Error("No query vector returned.");
    queryVector = embedded.vectors[0];
  } catch (error) {
    if (error instanceof ProviderError) {
      throw new AppError(
        502,
        "PROVIDER_UNAVAILABLE",
        "The embedding provider is unavailable, so retrieval could not run. Check the embedding configuration and retry.",
      );
    }
    throw error;
  }

  const documentFilter =
    params.documentIds && params.documentIds.length > 0
      ? `AND c.document_id IN (${params.documentIds.map(() => "?").join(",")})`
      : "";

  const candidates = await db.all<ChunkCandidateRow>(
    `SELECT c.id, c.document_id, c.text, c.page_number, c.section_heading, c.embedding,
            d.filename, d.kind
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.owner_id = ?
        AND c.subject_id = ?
        AND d.status = 'ready'
        AND c.embedding_model = ?
        AND c.embedding_dim = ?
        ${documentFilter}
      LIMIT 5000`,
    params.ownerId,
    params.subjectId,
    config.model,
    config.dimensions,
    ...(params.documentIds && params.documentIds.length > 0 ? params.documentIds : []),
  );

  const totals = await db.get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM document_chunks WHERE owner_id = ? AND subject_id = ?",
    params.ownerId,
    params.subjectId,
  );

  const queryTerms = new Set(
    tokenizeForEmbedding(query).filter((token) => !token.includes(" ") && token.length >= 3),
  );

  const scored: EvidenceChunk[] = [];
  for (const candidate of candidates) {
    const vector = blobToVector(candidate.embedding);
    if (!vector || vector.length !== config.dimensions) continue;
    const semantic = clamp01(cosineSimilarity(queryVector, vector));
    const lexical = lexicalCoverage(queryTerms, candidate.text);
    const combined = 0.75 * semantic + 0.25 * lexical;
    if (combined < threshold) continue;
    scored.push({
      chunkId: candidate.id,
      documentId: candidate.document_id,
      documentTitle: candidate.filename,
      documentKind: candidate.kind,
      pageNumber: candidate.page_number,
      sectionHeading: candidate.section_heading,
      text: candidate.text,
      semanticScore: Math.round(semantic * 1000) / 1000,
      lexicalScore: Math.round(lexical * 1000) / 1000,
      score: Math.round(combined * 1000) / 1000,
      rank: 0,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.documentTitle.localeCompare(b.documentTitle));
  const evidence = scored.slice(0, topK).map((chunk, index) => ({ ...chunk, rank: index + 1 }));
  const totalChars = evidence.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const topScore = evidence[0]?.score ?? null;

  let sufficient = evidence.length > 0 && topScore !== null && topScore >= threshold;
  let reason: string | null = null;

  if (candidates.length === 0) {
    sufficient = false;
    reason =
      (totals?.total ?? 0) > 0
        ? "The material in this subject was indexed with a different embedding model. Re-index the documents before running diagnostics."
        : "No indexed material is available for this subject yet. Upload a readable PDF or text file first.";
  } else if (evidence.length === 0) {
    sufficient = false;
    reason =
      "The uploaded material does not contain a passage relevant enough to this topic. Add a source that covers it, or rephrase the topic.";
  } else if (totalChars < minEvidenceChars()) {
    sufficient = false;
    reason =
      "The retrieved passages are too short to support a grounded question or explanation. Add more complete source material.";
  }

  return {
    evidence,
    sufficient,
    reason,
    query,
    consideredChunks: candidates.length,
    matchedModelChunks: candidates.length,
    embedding: {
      provider: config.provider,
      model: config.model,
      dimensions: config.dimensions,
    },
    scores: {
      topScore,
      totalChars,
      threshold,
    },
  };
}

export function buildTopicQuery(topic: { name: string; description?: string | null }): string {
  const description = topic.description?.trim();
  return `${topic.name}${description ? `. ${description}` : ""}. Key definitions, processes, mechanisms, and relationships.`;
}
