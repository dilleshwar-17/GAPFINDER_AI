import type { CitationView, EvidenceChunk } from "@/lib/domain/types";

export class CitationValidationError extends Error {
  readonly invalidIds: string[];

  constructor(message: string, invalidIds: string[] = []) {
    super(message);
    this.name = "CitationValidationError";
    this.invalidIds = invalidIds;
  }
}

export function excerpt(text: string, limit = 420): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  const cut = collapsed.slice(0, limit);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > limit * 0.6 ? cut.slice(0, boundary) : cut).trim()}…`;
}

export function stripInternalCitationLabels(text: string): string {
  return text.replace(/\s*\[P\d+\]/gi, "");
}

export function citationView(evidence: EvidenceChunk): CitationView {
  return {
    chunkId: evidence.chunkId,
    documentId: evidence.documentId,
    documentTitle: evidence.documentTitle,
    pageNumber: evidence.pageNumber,
    sectionHeading: evidence.sectionHeading,
    excerpt: excerpt(evidence.text),
  };
}

/**
 * Resolves model- or generator-supplied chunk IDs against the exact evidence
 * retrieved for this request. Nothing outside that set is accepted, so a model
 * cannot invent a source or widen its own authorization scope.
 */
export function validateCitationIds(
  ids: string[],
  evidence: EvidenceChunk[],
): { citations: CitationView[]; invalidIds: string[] } {
  const byId = new Map(evidence.map((chunk) => [chunk.chunkId, chunk]));
  const seen = new Set<string>();
  const invalidIds: string[] = [];
  const citations: CitationView[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const chunk = byId.get(id);
    if (!chunk) {
      invalidIds.push(id);
      continue;
    }
    citations.push(citationView(chunk));
  }

  return { citations, invalidIds };
}

export interface ResolvedQuestionSources {
  sources: CitationView[];
  chunks: EvidenceChunk[];
}

/**
 * Question sources must be a non-empty subset of retrieved evidence. Any
 * unsupported reference rejects the question rather than being silently kept.
 */
export function resolveQuestionSources(
  ids: string[],
  evidence: EvidenceChunk[],
): ResolvedQuestionSources {
  if (ids.length === 0) {
    throw new CitationValidationError("The question did not cite any retrieved source passage.");
  }
  const { citations, invalidIds } = validateCitationIds(ids, evidence);
  if (invalidIds.length > 0) {
    throw new CitationValidationError(
      "The question cited passages that were not retrieved for its topic.",
      invalidIds,
    );
  }
  if (citations.length === 0) {
    throw new CitationValidationError("The question had no usable source citation.");
  }
  return {
    sources: citations,
    chunks: evidence.filter((chunk) => ids.includes(chunk.chunkId)),
  };
}

export function allCitationsValid(ids: string[], evidence: EvidenceChunk[]): boolean {
  return validateCitationIds(ids, evidence).invalidIds.length === 0;
}
