"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CornerDownLeft,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { apiRequest, messageForError } from "@/lib/client/api";
import { Badge, Callout, CitationList, SourceLinks } from "@/components/ui";
import { MarkdownLite } from "@/components/markdown-lite";
import type { AssistantAnswer } from "@/lib/services/assistant";

interface AssistantResponse {
  answer: AssistantAnswer;
  topicName: string;
  subjectName: string;
}

interface Exchange {
  id: string;
  question: string;
  response: AssistantResponse | null;
  error: string | null;
}

const SUGGESTIONS = [
  "Explain the key idea in this topic using only my sources.",
  "What does my material say I should be able to describe?",
  "Summarise the most important definitions in this topic.",
];

function methodLabel(method: AssistantAnswer["method"]): string {
  switch (method) {
    case "gemini-grounded":
      return "Model answer · citation-checked";
    case "deterministic-extractive":
      return "Deterministic extractive answer";
    default:
      return "No grounded answer";
  }
}

export function AssistantChat({
  subjectId,
  topicId,
  topicName,
  subjectName,
  initialQuestion,
  compact = false,
}: {
  subjectId: string;
  topicId: string;
  topicName: string;
  subjectName: string;
  initialQuestion?: string;
  compact?: boolean;
}) {
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const counter = useRef(0);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    const id = `exchange-${counter.current++}`;
    setExchanges((current) => [...current, { id, question: trimmed, response: null, error: null }]);
    setQuestion("");
    setPending(true);
    try {
      const response = await apiRequest<AssistantResponse>("/api/assistant", {
        method: "POST",
        body: { topicId, question: trimmed },
      });
      setExchanges((current) =>
        current.map((exchange) =>
          exchange.id === id ? { ...exchange, response } : exchange,
        ),
      );
    } catch (caught) {
      setExchanges((current) =>
        current.map((exchange) =>
          exchange.id === id ? { ...exchange, error: messageForError(caught) } : exchange,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor={`assistant-question-${topicId}`} className="label">
          Ask about {topicName}
        </label>
        <textarea
          id={`assistant-question-${topicId}`}
          className={`textarea ${compact ? "min-h-[76px]" : "min-h-[96px]"}`}
          value={question}
          maxLength={600}
          placeholder="For example: how does this process start, and what does my material say regulates it?"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="field-help m-0 max-w-sm">
            Questions are matched against chunks from {subjectName}. The assistant answers only from
            retrieved passages and refuses when evidence is thin.
          </p>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={pending || question.trim().length < 3}
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <CornerDownLeft size={14} aria-hidden />
            )}
            {pending ? "Reading your sources…" : "Ask"}
          </button>
        </div>
      </form>

      {exchanges.length === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="badge badge-outline hover:border-[#176b50] hover:text-[#176b50]"
              onClick={() => {
                setQuestion(suggestion);
              }}
            >
              <Sparkles size={11} aria-hidden />
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-4" aria-live="polite">
        {exchanges.map((exchange) => (
          <article key={exchange.id} className="rounded-[12px] border border-[#e1e7e1] bg-white p-4">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef3ed] text-[#275544]">
                <MessageSquareText size={12} aria-hidden />
              </span>
              <p className="text-[0.84rem] font-medium leading-relaxed text-[#2c4034]">
                {exchange.question}
              </p>
            </div>

            {exchange.error ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-[#ecc8c1] bg-[#fbf0ed] px-3 py-2 text-[0.79rem] text-[#7f2f24]"
              >
                {exchange.error}
              </p>
            ) : !exchange.response ? (
              <p className="mt-3 flex items-center gap-2 text-[0.79rem] text-[#68756d]">
                <Loader2 size={13} className="animate-spin" aria-hidden />
                Retrieving passages and checking citations…
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={exchange.response.answer.sufficient ? "strong" : "developing"}>
                    {exchange.response.answer.sufficient ? "Grounded answer" : "Abstained"}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[0.67rem] text-[#7a877f]">
                    <ShieldCheck size={11} aria-hidden />
                    {methodLabel(exchange.response.answer.method)}
                  </span>
                  {exchange.response.answer.model ? (
                    <span className="font-mono text-[0.63rem] text-[#9aa69f]">
                      {exchange.response.answer.model}
                    </span>
                  ) : null}
                </div>

                {!exchange.response.answer.sufficient ? (
                  <Callout tone="warning" title="The sources do not support an answer">
                    <span className="inline-flex items-start gap-1.5">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                      <span>
                        {exchange.response.answer.reason ??
                          "Retrieval did not find enough relevant text in your indexed material. Nothing was guessed."}
                      </span>
                    </span>
                  </Callout>
                ) : null}

                <div className="rounded-[10px] border border-[#eef1ea] bg-[#fbfcf8] px-3.5 py-3">
                  <MarkdownLite content={exchange.response.answer.answerMarkdown} />
                </div>

                {exchange.response.answer.citations.length > 0 ? (
                  <div>
                    <CitationList citations={exchange.response.answer.citations} compact />
                    <div className="mt-2">
                      <SourceLinks citations={exchange.response.answer.citations} />
                    </div>
                  </div>
                ) : null}

                {exchange.response.answer.practice ? (
                  <div className="rounded-[10px] border border-[#dce8dd] bg-[#f4faf5] px-3.5 py-3">
                    <p className="eyebrow mb-1.5 text-[#3c5a48]">Practice prompt</p>
                    <p className="text-[0.81rem] leading-relaxed text-[#405448]">
                      {exchange.response.answer.practice.prompt}
                    </p>
                    <Link
                      href={`/diagnostics?subject=${subjectId}&topic=${topicId}`}
                      className="mt-2 inline-flex items-center gap-1 text-[0.74rem] font-medium text-[#176b50] hover:underline"
                    >
                      Turn this into a diagnostic
                      <ArrowUpRight size={12} aria-hidden />
                    </Link>
                  </div>
                ) : null}
              </div>
            )}
          </article>
        ))}
      </div>

      <p className="text-[0.68rem] leading-relaxed text-[#85928a]">
        Passage text is treated as untrusted study material, not instructions. The assistant never
        answers from general knowledge, and every citation points to a chunk in your own indexed
        documents.
      </p>
    </div>
  );
}
