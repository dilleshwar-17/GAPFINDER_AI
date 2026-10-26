/**
 * Central server-side configuration. Only variables prefixed with NEXT_PUBLIC_
 * may ever be exposed to the browser; everything here stays on the server.
 */

export type EmbeddingProviderName = "local" | "gemini";

export interface EmbeddingConfig {
  provider: EmbeddingProviderName;
  model: string;
  dimensions: number;
  /** True when a hosted neural embedding model is available. */
  neural: boolean;
}

export interface LlmConfig {
  provider: "gemini" | "none";
  model: string;
  configured: boolean;
}

const DEFAULT_GEMINI_LLM = "gemini-2.5-flash";
const DEFAULT_GEMINI_EMBEDDING = "gemini-embedding-001";
const DEFAULT_LOCAL_EMBEDDING_DIM = 512;
const MIN_GEMINI_EMBEDDING_DIM = 128;
const MAX_GEMINI_EMBEDDING_DIM = 3072;

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return value;
}

function readString(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

export function geminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

export function getLlmConfig(): LlmConfig {
  const configured = geminiApiKey() !== null;
  return {
    provider: configured ? "gemini" : "none",
    model: configured ? readString("GEMINI_MODEL", DEFAULT_GEMINI_LLM) : "deterministic-fallback",
    configured,
  };
}

export function getEmbeddingConfig(): EmbeddingConfig {
  const key = geminiApiKey();
  const requested = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  const useGemini = key !== null && requested !== "local";

  if (useGemini) {
    const dimensions = readInt(
      "EMBEDDING_DIMENSIONS",
      768,
      MIN_GEMINI_EMBEDDING_DIM,
      MAX_GEMINI_EMBEDDING_DIM,
    );
    return {
      provider: "gemini",
      model: readString("EMBEDDING_MODEL", DEFAULT_GEMINI_EMBEDDING),
      dimensions,
      neural: true,
    };
  }

  return {
    provider: "local",
    model: "gapfinder-hash-v1",
    dimensions: readInt("LOCAL_EMBEDDING_DIMENSIONS", DEFAULT_LOCAL_EMBEDDING_DIM, 64, 2048),
    neural: false,
  };
}

export function maxUploadBytes(): number {
  return readInt("MAX_UPLOAD_MB", 8, 1, 25) * 1024 * 1024;
}

export function retrievalTopK(): number {
  return readInt("RETRIEVAL_TOP_K", 6, 1, 20);
}

export function retrievalMinScore(): number {
  const raw = process.env.RETRIEVAL_MIN_SCORE?.trim();
  if (!raw) return 0.15;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.15;
}

export function minEvidenceChars(): number {
  return readInt("MIN_EVIDENCE_CHARS", 240, 40, 4000);
}

export function sessionTtlDays(): number {
  return readInt("SESSION_TTL_DAYS", 7, 1, 30);
}

export function isDemoEnabled(): boolean {
  return process.env.DISABLE_DEMO !== "1";
}

export function runtimeMode() {
  const llm = getLlmConfig();
  const embeddings = getEmbeddingConfig();
  return {
    llm: { provider: llm.provider, model: llm.model, configured: llm.configured },
    embeddings: {
      provider: embeddings.provider,
      model: embeddings.model,
      dimensions: embeddings.dimensions,
      neural: embeddings.neural,
    },
    demoEnabled: isDemoEnabled(),
  };
}
