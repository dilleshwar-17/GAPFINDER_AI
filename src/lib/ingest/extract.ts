import { getDocumentProxy, extractText } from "unpdf";
import { normalizeText } from "@/lib/domain/chunking";
import type { SourcePage } from "@/lib/domain/chunking";

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

export interface ExtractedDocument {
  pages: SourcePage[];
  pageCount: number;
  charCount: number;
  format: "pdf" | "text";
}

export function isPdf(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 1024);
  const header = Buffer.from(bytes.subarray(0, limit)).toString("latin1");
  return header.includes("%PDF-");
}

function countNulBytes(bytes: Uint8Array, limit = 4096): number {
  let count = 0;
  const end = Math.min(bytes.length, limit);
  for (let index = 0; index < end; index += 1) {
    if (bytes[index] === 0) count += 1;
  }
  return count;
}

function buildTextPages(text: string): SourcePage[] {
  const normalizedNewlines = text.replace(/\r\n?/g, "\n");
  const rawPages = normalizedNewlines.split("\f");
  const nonEmpty = rawPages.filter((page) => page.trim().length > 0);
  if (nonEmpty.length === 0) return [];

  if (rawPages.length === 1) {
    // A plain text file has no intrinsic page boundaries; do not invent them.
    return [{ pageNumber: null, text: rawPages[0] }];
  }

  return rawPages
    .map((page, index) => ({ pageNumber: index + 1, text: page }))
    .filter((page) => page.text.trim().length > 0);
}

export async function extractDocument(input: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}): Promise<ExtractedDocument> {
  const { bytes, mimeType, filename } = input;
  if (bytes.length === 0) throw new ExtractionError("The uploaded file is empty.");

  const lowerName = filename.toLowerCase();
  const pdf = mimeType === "application/pdf" || lowerName.endsWith(".pdf");

  if (pdf) {
    if (!isPdf(bytes)) {
      throw new ExtractionError("The file does not have a valid PDF signature.");
    }
    try {
      const proxy = await getDocumentProxy(new Uint8Array(bytes));
      const result = await extractText(proxy, { mergePages: false });
      const rawPages: string[] = Array.isArray(result.text) ? result.text : [String(result.text)];
      const pages = rawPages
        .map((page, index) => ({ pageNumber: index + 1, text: normalizeText(page) }))
        .filter((page) => page.text.trim().length > 0);
      const charCount = pages.reduce((sum, page) => sum + page.text.length, 0);
      if (charCount < 40) {
        throw new ExtractionError(
          "No usable text could be extracted. The PDF may be scanned or image-only; upload a text-based PDF or a .txt file.",
        );
      }
      return {
        pages,
        pageCount: result.totalPages ?? rawPages.length,
        charCount,
        format: "pdf",
      };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      throw new ExtractionError(
        "The PDF could not be read. It may be corrupted, encrypted, or image-only.",
      );
    }
  }

  const textLike = mimeType.startsWith("text/") || /\.(txt|md|markdown)$/i.test(filename);
  if (!textLike) {
    throw new ExtractionError("Only PDF and plain-text files are supported.");
  }
  if (countNulBytes(bytes) > 0) {
    throw new ExtractionError("The text file contains binary data and is not readable as plain text.");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ExtractionError("The text file is not valid UTF-8.");
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const pages = buildTextPages(text)
    .map((page) => ({ ...page, text: normalizeText(page.text) }))
    .filter((page) => page.text.length > 0);
  const charCount = pages.reduce((sum, page) => sum + page.text.length, 0);

  if (charCount < 20) {
    throw new ExtractionError("The document does not contain enough readable text to index.");
  }

  return {
    pages,
    pageCount: pages.length,
    charCount,
    format: "text",
  };
}
