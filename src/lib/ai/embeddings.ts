import { getEmbeddingConfig, geminiApiKey, type EmbeddingConfig } from "@/lib/env";

export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "ProviderError";
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves thus within without may might must shall one two three using used use given etc via per among across`
    .split(/\s+/)
    .filter(Boolean),
);

export function tokenizeForEmbedding(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  const words = normalized.split(" ").filter((word) => word.length >= 2 && !STOPWORDS.has(word));
  const tokens = [...words];
  for (let index = 0; index < words.length - 1; index += 1) {
    tokens.push(`${words[index]} ${words[index + 1]}`);
  }
  return tokens;
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministic feature-hashing embedder used when no hosted embedding model is
 * configured. It is a real, persistent vector representation, but it captures
 * lexical overlap rather than neural semantics. The application labels it
 * accordingly in the interface and documentation.
 */
export function embedLocally(text: string, dimensions: number): Float32Array {
  const vector = new Float32Array(dimensions);
  const tokens = tokenizeForEmbedding(text);
  if (tokens.length === 0) return vector;

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  for (const [token, count] of counts) {
    const hash = fnv1a(token);
    const index = hash % dimensions;
    const sign = (hash & 0x80000000) === 0 ? 1 : -1;
    vector[index] += sign * (1 + Math.log(count));
  }

  let norm = 0;
  for (let index = 0; index < vector.length; index += 1) norm += vector[index] * vector[index];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let index = 0; index < vector.length; index += 1) vector[index] /= norm;
  }
  return vector;
}

export function vectorToBlob(vector: Float32Array): Uint8Array {
  return new Uint8Array(vector.buffer.slice(0));
}

export function blobToVector(blob: Uint8Array | null): Float32Array | null {
  if (!blob || blob.byteLength === 0 || blob.byteLength % 4 !== 0) return null;
  const copy = new Uint8Array(blob);
  return new Float32Array(copy.buffer);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface EmbeddingResult {
  vectors: Float32Array[];
  model: string;
  dimensions: number;
  provider: EmbeddingConfig["provider"];
}

export type EmbeddingTask = "document" | "query";

async function callGeminiEmbedding(
  texts: string[],
  task: EmbeddingTask,
  config: EmbeddingConfig,
): Promise<Float32Array[]> {
  const key = geminiApiKey();
  if (!key) throw new ProviderError("Gemini API key is not configured.", { retryable: false });

  const model = config.model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`;
  const taskType = task === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text: text.slice(0, 12000) }] },
        taskType,
        outputDimensionality: config.dimensions,
      })),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new ProviderError(`Embedding provider returned status ${response.status}.`, {
      retryable,
      status: response.status,
    });
  }

  const payload = (await response.json()) as {
    embeddings?: Array<{ values?: number[] }>;
  };
  const embeddings = payload.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new ProviderError("Embedding provider returned an unexpected response shape.", {
      retryable: true,
    });
  }

  return embeddings.map((entry, index) => {
    const values = entry.values;
    if (!Array.isArray(values) || values.length !== config.dimensions) {
      throw new ProviderError(
        `Embedding dimension mismatch at position ${index}: expected ${config.dimensions}.`,
        { retryable: false },
      );
    }
    const vector = new Float32Array(values.length);
    for (let position = 0; position < values.length; position += 1) {
      const value = values[position];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new ProviderError("Embedding provider returned a non-numeric value.", {
          retryable: true,
        });
      }
      vector[position] = value;
    }
    return vector;
  });
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ProviderError ? error.retryable : false;
      if (!retryable || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ProviderError("Embedding provider failed.", { retryable: false });
}

/**
 * Embeds document chunks or queries with the single configured model. Document
 * and query embeddings stay compatible because both use the same provider,
 * model identifier and dimension.
 */
export async function embedTexts(
  texts: string[],
  task: EmbeddingTask,
  config: EmbeddingConfig = getEmbeddingConfig(),
): Promise<EmbeddingResult> {
  if (texts.length === 0) {
    return { vectors: [], model: config.model, dimensions: config.dimensions, provider: config.provider };
  }

  if (config.provider === "local") {
    return {
      vectors: texts.map((text) => embedLocally(text, config.dimensions)),
      model: config.model,
      dimensions: config.dimensions,
      provider: config.provider,
    };
  }

  const vectors: Float32Array[] = [];
  const batchSize = 16;
  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    const embedded = await withRetry(() => callGeminiEmbedding(batch, task, config));
    vectors.push(...embedded);
  }

  return {
    vectors,
    model: config.model,
    dimensions: config.dimensions,
    provider: config.provider,
  };
}

export async function embedQuery(text: string): Promise<EmbeddingResult> {
  const config = getEmbeddingConfig();
  return embedTexts([text], "query", config);
}
