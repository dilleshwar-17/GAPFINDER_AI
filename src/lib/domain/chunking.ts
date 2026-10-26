import { createHash } from "node:crypto";

export const CHUNKING_CONFIG = {
  /** Preferred chunk size; flushing is triggered once a chunk reaches this. */
  targetChars: 1600,
  /** Hard ceiling for newly appended paragraphs. */
  maxChars: 2200,
  /** Chunks below this size are merged or discarded. */
  minChars: 200,
  /** Approximate overlap carried into the next chunk on the same page. */
  overlapChars: 260,
} as const;

export interface SourcePage {
  pageNumber: number | null;
  text: string;
}

export interface ChunkDraft {
  chunkIndex: number;
  text: string;
  pageNumber: number | null;
  sectionHeading: string | null;
  charStart: number | null;
  charEnd: number | null;
  contentHash: string;
}

interface Block {
  kind: "heading" | "paragraph";
  text: string;
  start: number;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Headings are detected conservatively so page numbers and section labels are
 * never invented: only structural patterns present in the extracted text count.
 */
export function detectHeading(rawLine: string): string | null {
  const line = rawLine.trim();
  if (!line || line.length > 100) return null;

  const markdown = /^#{1,4}\s+(.+?)\s*#*$/.exec(line);
  if (markdown) return markdown[1].trim();

  const labelled =
    /^(unit|chapter|section|module|part|topic)\s+([0-9]+|[ivxlcdm]+)\b[.:)\s-]*(.*)$/i.exec(
      line,
    );
  if (labelled) {
    const suffix = labelled[3]?.trim() ?? "";
    return suffix ? `${capitalize(labelled[1])} ${labelled[2]}: ${suffix}` : `${capitalize(labelled[1])} ${labelled[2]}`;
  }

  // Numbered headings such as "2.1 Light-dependent reactions" (no sentence punctuation).
  if (/^\d+(\.\d+){0,3}\s+[A-Z][^.!?]{2,90}$/.test(line)) return line;

  // Short all-caps section labels such as "PHOTOSYNTHESIS".
  const words = line.split(/\s+/);
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (
    words.length >= 1 &&
    words.length <= 9 &&
    line.length >= 4 &&
    line.length <= 70 &&
    letters.length >= 4 &&
    line === line.toUpperCase() &&
    !/[.!?]$/.test(line)
  ) {
    return line;
  }

  return null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function buildBlocks(pageText: string): Block[] {
  const lines = pageText.split("\n");
  const blocks: Block[] = [];
  let paragraphLines: string[] = [];
  let cursor = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      const start = pageText.indexOf(paragraphLines[0].trim(), cursor);
      blocks.push({ kind: "paragraph", text, start: start >= 0 ? start : cursor });
      cursor = (start >= 0 ? start : cursor) + text.length;
    }
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const heading = detectHeading(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", text: heading, start: cursor });
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();
  return blocks;
}

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  return (parts ?? [text]).map((part) => part.trim()).filter(Boolean);
}

/** Split oversized paragraphs at sentence boundaries, then hard-split as a last resort. */
function splitToSize(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = splitSentences(text);
  const pieces: string[] = [];
  let buffer = "";
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (buffer) {
        pieces.push(buffer.trim());
        buffer = "";
      }
      for (let index = 0; index < sentence.length; index += maxChars) {
        pieces.push(sentence.slice(index, index + maxChars).trim());
      }
      continue;
    }
    if (buffer.length + sentence.length + 1 > maxChars) {
      if (buffer) pieces.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }
  if (buffer.trim()) pieces.push(buffer.trim());
  return pieces.filter(Boolean);
}

function tailForOverlap(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const candidate = text.slice(text.length - limit);
  const firstSpace = candidate.indexOf(" ");
  const trimmed = firstSpace >= 0 ? candidate.slice(firstSpace + 1) : candidate;
  return trimmed.trim();
}

/**
 * Produces page-aware chunks. A chunk never spans two source pages, so every
 * citation resolves to a single verified page number (or null when the file
 * had no page boundaries).
 */
export function chunkPages(
  pages: SourcePage[],
  config: typeof CHUNKING_CONFIG = CHUNKING_CONFIG,
): ChunkDraft[] {
  const chunks: ChunkDraft[] = [];
  const seenHashes = new Set<string>();
  let chunkIndex = 0;

  for (const page of pages) {
    const normalized = normalizeText(page.text);
    if (!normalized) continue;
    const blocks = buildBlocks(normalized);

    let activeHeading: string | null = null;
    let nextHeading: string | null = null;
    let pending: string[] = [];
    let pendingChars = 0;
    let pendingStart: number | null = null;
    let pendingEnd: number | null = null;
    let lastTail = "";
    let lastPage: number | null = null;

    const resetPending = () => {
      pending = [];
      pendingChars = 0;
      pendingStart = null;
      pendingEnd = null;
    };

    const emit = () => {
      if (pendingChars === 0) {
        resetPending();
        return;
      }
      const content = pending.join("\n\n").replace(/[ \t]+/g, " ").trim();
      const startOffset = pendingStart;
      const endOffset = pendingEnd;
      resetPending();
      if (!content) return;

      const pageForChunk = page.pageNumber;
      const headingForChunk = activeHeading;
      const body =
        headingForChunk && !content.startsWith(headingForChunk)
          ? `${headingForChunk}\n\n${content}`
          : content;
      const previous = chunks[chunks.length - 1];

      if (
        body.length < config.minChars &&
        previous &&
        lastPage === pageForChunk &&
        previous.text.length + body.length <= Math.round(config.maxChars * 1.3)
      ) {
        previous.text = `${previous.text}\n\n${body}`;
        previous.charEnd = endOffset ?? previous.charEnd;
        lastTail = tailForOverlap(previous.text, config.overlapChars);
        return;
      }

      if (body.length < Math.min(120, config.minChars)) return;

      const hash = hashText(body);
      if (seenHashes.has(hash)) return;
      seenHashes.add(hash);

      chunks.push({
        chunkIndex,
        text: body,
        pageNumber: pageForChunk,
        sectionHeading: headingForChunk,
        charStart: startOffset,
        charEnd: endOffset,
        contentHash: hash,
      });
      chunkIndex += 1;
      lastTail = tailForOverlap(body, config.overlapChars);
      lastPage = pageForChunk;
    };

    for (const block of blocks) {
      if (block.kind === "heading") {
        if (pendingChars > 0) emit();
        nextHeading = block.text;
        continue;
      }

      for (const piece of splitToSize(block.text, config.maxChars)) {
        if (pendingChars > 0 && pendingChars + piece.length + 2 > config.maxChars) {
          emit();
          if (!activeHeading) activeHeading = nextHeading;
          if (lastTail && lastPage === page.pageNumber && lastTail.length >= 80) {
            pending.push(lastTail);
            pendingChars = lastTail.length;
          }
        }

        if (pendingChars === 0) {
          activeHeading = nextHeading ?? activeHeading;
          pendingStart = block.start;
        }
        pending.push(piece);
        pendingChars += piece.length + (pending.length > 1 ? 2 : 0);
        pendingEnd = block.start + block.text.length;

        if (pendingChars >= config.targetChars) emit();
      }
    }

    emit();
  }

  return chunks;
}
