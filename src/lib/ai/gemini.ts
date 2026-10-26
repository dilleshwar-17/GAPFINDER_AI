import { geminiApiKey, getLlmConfig } from "@/lib/env";
import { ProviderError } from "@/lib/ai/embeddings";

export interface GeminiJsonRequest {
  /** Short task label for telemetry; never document content. */
  kind: string;
  systemInstruction: string;
  userContent: string;
  responseSchema: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface GeminiJsonResult<T> {
  data: T;
  model: string;
}

const MAX_INPUT_CHARS = 28_000;

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

async function postGenerate(
  request: GeminiJsonRequest,
  model: string,
  key: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model.replace(/^models\//, ""),
  )}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.systemInstruction }] },
      contents: [
        {
          role: "user",
          parts: [{ text: request.userContent.slice(0, MAX_INPUT_CHARS) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: request.responseSchema,
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxOutputTokens ?? 2048,
      },
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? 45_000),
  });

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new ProviderError(
      `Language model provider returned status ${response.status} for ${request.kind}.`,
      { retryable, status: response.status },
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (payload.promptFeedback?.blockReason) {
    throw new ProviderError("The language model declined the request.", { retryable: false });
  }

  const candidate = payload.candidates?.[0];
  if (!candidate) {
    throw new ProviderError("The language model returned no candidate.", { retryable: true });
  }
  if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
    throw new ProviderError(
      `The language model stopped early (${candidate.finishReason}).`,
      { retryable: false },
    );
  }

  const text = candidate.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new ProviderError("The language model returned an empty response.", {
      retryable: true,
    });
  }
  return text;
}

export async function generateJson<T>(request: GeminiJsonRequest): Promise<GeminiJsonResult<T>> {
  const config = getLlmConfig();
  const key = geminiApiKey();
  if (!config.configured || !key) {
    throw new ProviderError("No language model provider is configured.", { retryable: false });
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const text = await postGenerate(request, config.model, key);
      const parsed = JSON.parse(extractJson(text)) as T;
      return { data: parsed, model: config.model };
    } catch (error) {
      lastError = error;
      if (error instanceof SyntaxError) {
        throw new ProviderError("The language model returned malformed JSON.", {
          retryable: true,
        });
      }
      const retryable = error instanceof ProviderError ? error.retryable : false;
      if (!retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ProviderError("Language model generation failed.", { retryable: false });
}
