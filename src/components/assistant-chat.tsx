"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  AudioLines,
  CornerDownLeft,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Waves,
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

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechResultList;
}

interface SpeechRecognitionErrorLike extends Event {
  error?: string;
}

interface SpeechProgress {
  id: string;
  text: string;
  charIndex: number;
  charLength: number;
  boundarySeen: boolean;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
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

/** Converts the constrained markdown answer into natural speech. */
function toSpeechText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>#~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits the spoken reply around the word boundary reported by the browser. */
function captionParts(progress: SpeechProgress) {
  const text = progress.text;
  const start = Math.max(0, Math.min(text.length, progress.charIndex));
  const end = Math.max(start, Math.min(text.length, start + progress.charLength));
  return {
    spoken: text.slice(0, start),
    current: text.slice(start, end),
    rest: text.slice(end),
    percent: text.length === 0 ? 0 : Math.round((end / text.length) * 100),
  };
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
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [voiceOutputSupported, setVoiceOutputSupported] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [dictationFinal, setDictationFinal] = useState("");
  const [dictationInterim, setDictationInterim] = useState("");
  const [speechProgress, setSpeechProgress] = useState<SpeechProgress | null>(null);
  const [mode, setMode] = useState<"topic" | "general">("general");

  const counter = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptBaseRef = useRef("");
  const dictationFinalRef = useRef("");
  const speakingIdRef = useRef<string | null>(null);
  const autoSpeakRef = useRef(false);

  useEffect(() => {
    setVoiceInputSupported(getRecognitionConstructor() !== null);
    setVoiceOutputSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function stopDictation() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setDictationInterim("");
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speakingIdRef.current = null;
    setSpeakingId(null);
    setSpeechProgress(null);
  }

  function speak(id: string, markdown: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceError("Spoken replies are not available in this browser.");
      return;
    }
    if (speakingIdRef.current === id) {
      stopSpeaking();
      return;
    }
    const text = toSpeechText(markdown).slice(0, 4000);
    if (!text) return;
    stopDictation();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => {
      setSpeechProgress({ id, text, charIndex: 0, charLength: 0, boundarySeen: false });
    };
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      setSpeechProgress((current) => {
        if (!current || current.id !== id) return current;
        return {
          ...current,
          charIndex: Math.max(0, event.charIndex ?? 0),
          charLength: Math.max(0, event.charLength ?? 0),
          boundarySeen: true,
        };
      });
    };
    utterance.onend = () => {
      if (speakingIdRef.current !== id) return;
      speakingIdRef.current = null;
      setSpeakingId(null);
      setSpeechProgress(null);
    };
    utterance.onerror = () => {
      if (speakingIdRef.current !== id) return;
      speakingIdRef.current = null;
      setSpeakingId(null);
      setSpeechProgress(null);
    };
    speakingIdRef.current = id;
    setSpeakingId(id);
    setSpeechProgress({ id, text, charIndex: 0, charLength: 0, boundarySeen: false });
    window.speechSynthesis.speak(utterance);
  }

  function toggleDictation() {
    setVoiceError(null);
    if (listening) {
      stopDictation();
      return;
    }

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setVoiceError(
        "Voice input is not supported in this browser. You can still type your question.",
      );
      return;
    }

    stopSpeaking();
    setDictationFinal("");
    setDictationInterim("");
    dictationFinalRef.current = "";
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    transcriptBaseRef.current = question.trim() ? `${question.trim()} ` : "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          dictationFinalRef.current += `${transcript.trim()} `;
        } else {
          interim += transcript;
        }
      }
      const finalText = dictationFinalRef.current.trim();
      setDictationFinal(finalText);
      setDictationInterim(interim.trim());
      setQuestion(
        `${transcriptBaseRef.current}${dictationFinalRef.current}${interim}`.trimStart(),
      );
    };

    recognition.onerror = (event) => {
      const code = event.error;
      setDictationInterim("");
      setVoiceError(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone permission was denied. Allow microphone access to dictate a question."
          : code === "no-speech"
            ? "No speech was detected. Try again and speak a little closer to the microphone."
            : code === "network"
              ? "Voice recognition needs a network connection in this browser."
              : "Voice input stopped before a question was captured. You can type instead.",
      );
      setListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setDictationInterim("");
      setDictationFinal(dictationFinalRef.current.trim());
      setQuestion((current) => current.trim());
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError("Voice input could not start. Check microphone permissions and try again.");
    }
  }

  function toggleAutoSpeak() {
    const next = !autoSpeakRef.current;
    autoSpeakRef.current = next;
    setAutoSpeak(next);
    if (!next) stopSpeaking();
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    stopDictation();
    stopSpeaking();
    setDictationFinal("");
    setDictationInterim("");
    dictationFinalRef.current = "";
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
      if (autoSpeakRef.current) {
        speak(id, response.answer.answerMarkdown || response.answer.reason || "");
      }
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

  const caption = speechProgress ? captionParts(speechProgress) : null;

  return (
    <div className="space-y-4">
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={`buddy-question-${topicId}`} className="label mb-0">
            Ask BUDDY about {topicName}
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={toggleDictation}
              aria-pressed={listening}
              disabled={!voiceInputSupported}
              title={
                voiceInputSupported
                  ? "Dictate your question with your microphone"
                  : "Voice input is not supported in this browser"
              }
            >
              {listening ? (
                <MicOff size={14} aria-hidden />
              ) : (
                <Mic size={14} aria-hidden />
              )}
              {listening ? "Stop" : "Speak"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={toggleAutoSpeak}
              aria-pressed={autoSpeak}
              disabled={!voiceOutputSupported}
              title={
                voiceOutputSupported
                  ? "Read BUDDY's replies aloud automatically"
                  : "Spoken replies are not supported in this browser"
              }
            >
              {autoSpeak ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
              Read aloud
            </button>
          </div>
        </div>
        <textarea
          id={`buddy-question-${topicId}`}
          className={`textarea ${compact ? "min-h-[76px]" : "min-h-[96px]"} ${
            listening ? "border-[#7a5af8]" : ""
          }`}
          value={question}
          maxLength={600}
          placeholder="For example: how does this process start, and what does my material say regulates it?"
          onChange={(event) => {
            setQuestion(event.target.value);
            if (!listening && (dictationFinal || dictationInterim)) {
              setDictationFinal("");
              setDictationInterim("");
              dictationFinalRef.current = "";
            }
          }}
          aria-describedby={`buddy-voice-status-${topicId}`}
        />
        <p id={`buddy-voice-status-${topicId}`} className="sr-only" aria-live="polite">
          {listening ? "Listening for your question. " : ""}
          {dictationFinal ? `Transcript so far: ${dictationFinal}. ` : ""}
          {voiceError ?? ""}
          {speechProgress ? "BUDDY is reading the answer aloud with live captions." : ""}
        </p>
        {listening || dictationFinal ? (
          <div className={`voice-live-panel ${listening ? "is-listening" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#5925dc]">
                {listening ? (
                  <span
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#7a5af8]"
                    aria-hidden
                  />
                ) : (
                  <AudioLines size={12} aria-hidden />
                )}
                {listening
                  ? dictationInterim
                    ? "Live transcript · hearing you"
                    : "Live transcript · listening"
                  : "Captured transcript"}
              </span>
              {listening ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={stopDictation}
                >
                  <Square size={11} aria-hidden />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setDictationFinal("");
                    setDictationInterim("");
                    dictationFinalRef.current = "";
                  }}
                >
                  Hide
                </button>
              )}
            </div>
            {listening ? (
              <div className="voice-wave mt-2" aria-hidden>
                {[6, 12, 18, 9, 22, 14, 8, 19, 11, 16, 7, 20, 13, 10, 17, 8].map(
                  (height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className="voice-bar rounded-full bg-[#7a5af8]/70"
                      style={{ height, animationDelay: `${index * 70}ms` }}
                    />
                  ),
                )}
              </div>
            ) : null}
            <p className="mt-2 min-h-[1.4rem] text-[0.82rem] leading-relaxed">
              {dictationFinal ? (
                <span className="font-medium text-[#344054]">{dictationFinal}</span>
              ) : null}{" "}
              {dictationInterim ? (
                <span className="voice-interim text-[#7a5af8]">{dictationInterim}</span>
              ) : null}
              {!dictationFinal && !dictationInterim ? (
                <span className="text-[#98a2b3]">
                  Start speaking. Interim words appear here while the browser works out the sentence.
                </span>
              ) : null}
            </p>
            <p className="mt-1.5 text-[0.66rem] leading-relaxed text-[#667085]">
              Final words settle into the box above. Audio is handled by your browser and is not
              stored.
            </p>
          </div>
        ) : null}
        {voiceError ? (
          <p
            role="alert"
            className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.76rem] text-[#b42318]"
          >
            {voiceError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="field-help m-0 max-w-sm">
            Questions are matched against chunks from {subjectName}. BUDDY answers only from
            retrieved passages and refuses when evidence is thin. Dictation uses your browser&apos;s
            speech service.
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
            {pending ? "Reading your sources…" : "Ask BUDDY"}
          </button>
        </div>
      </form>

      {exchanges.length === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="badge badge-outline hover:border-[#7a5af8] hover:text-[#7a5af8]"
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
          <article key={exchange.id} className="rounded-[12px] border border-[#eaecf0] bg-white p-4">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7] text-[#5925dc]">
                <MessageSquareText size={12} aria-hidden />
              </span>
              <p className="text-[0.84rem] font-medium leading-relaxed text-[#344054]">
                {exchange.question}
              </p>
            </div>

            {exchange.error ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.79rem] text-[#b42318]"
              >
                {exchange.error}
              </p>
            ) : !exchange.response ? (
              <p className="mt-3 flex items-center gap-2 text-[0.79rem] text-[#667085]">
                <Loader2 size={13} className="animate-spin" aria-hidden />
                Retrieving passages and checking citations…
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={exchange.response.answer.sufficient ? "strong" : "developing"}>
                    {exchange.response.answer.sufficient ? "Grounded answer" : "Abstained"}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[0.67rem] text-[#667085]">
                    <ShieldCheck size={11} aria-hidden />
                    {methodLabel(exchange.response.answer.method)}
                  </span>
                  {exchange.response.answer.model ? (
                    <span className="font-mono text-[0.63rem] text-[#98a2b3]">
                      {exchange.response.answer.model}
                    </span>
                  ) : null}
                  {voiceOutputSupported ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        speak(
                          exchange.id,
                          exchange.response?.answer.answerMarkdown ||
                            exchange.response?.answer.reason ||
                            "",
                        )
                      }
                      aria-pressed={speakingId === exchange.id}
                      title={
                        speakingId === exchange.id
                          ? "Stop reading this answer"
                          : "Read this answer aloud"
                      }
                    >
                      {speakingId === exchange.id ? (
                        <Square size={12} aria-hidden />
                      ) : (
                        <Volume2 size={12} aria-hidden />
                      )}
                      {speakingId === exchange.id ? "Stop" : "Listen"}
                    </button>
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

                <div className="rounded-[10px] border border-[#f2f4f7] bg-[#fcfcfd] px-3.5 py-3">
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
                  <div className="rounded-[10px] border border-[#d9d6fe] bg-[#f4f3ff] px-3.5 py-3">
                    <p className="eyebrow mb-1.5 text-[#344054]">Practice prompt</p>
                    <p className="text-[0.81rem] leading-relaxed text-[#475467]">
                      {exchange.response.answer.practice.prompt}
                    </p>
                    <Link
                      href={`/diagnostics?subject=${subjectId}&topic=${topicId}`}
                      className="mt-2 inline-flex items-center gap-1 text-[0.74rem] font-medium text-[#7a5af8] hover:underline"
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

      <p className="text-[0.68rem] leading-relaxed text-[#98a2b3]">
        Passage text is treated as untrusted study material, not instructions. BUDDY never answers
        from general knowledge, and every citation points to a chunk in your own indexed documents.
        Voice input and spoken replies run through your browser; microphone access is only requested
        when you press Speak.
      </p>

      {caption && speechProgress ? (
        <div
          className="voice-caption-dock"
          role="region"
          aria-label="BUDDY spoken reply captions"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#5925dc]">
              <AudioLines size={12} aria-hidden />
              BUDDY speaking · live captions
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={stopSpeaking}>
              <Square size={11} aria-hidden />
              Stop
            </button>
          </div>
          <p className="voice-caption-text mt-1.5" aria-hidden="true">
            <span>{caption.spoken}</span>
            {caption.current ? <mark>{caption.current}</mark> : null}
            <span className="voice-caption-rest">{caption.rest}</span>
          </p>
          <div className="voice-caption-progress mt-2" aria-hidden="true">
            <span
              className={speechProgress.boundarySeen ? "" : "is-indeterminate"}
              style={{
                width: speechProgress.boundarySeen
                  ? `${Math.max(2, caption.percent)}%`
                  : "32%",
              }}
            />
          </div>
          <p className="mt-1.5 text-[0.62rem] text-[#667085]" aria-hidden="true">
            {speechProgress.boundarySeen
              ? `${caption.percent}% read · `
              : "Reading aloud · "}
            captions follow the speech boundaries reported by your browser
          </p>
        </div>
      ) : null}
    </div>
  );
}
