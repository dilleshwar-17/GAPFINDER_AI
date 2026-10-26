"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";
import { Badge, Callout, CitationList, ScoreDisplay, SectionHeading } from "@/components/ui";
import type { QuizView } from "@/lib/services/assessment";
import type { CitationView } from "@/lib/domain/types";

type AnswerState = Record<string, { selectedIndex: number | null; answerText: string }>;

function initialAnswers(view: QuizView): AnswerState {
  const draft = new Map(view.draft.map((entry) => [entry.questionId, entry]));
  return Object.fromEntries(
    view.questions.map((question) => {
      const saved = draft.get(question.id);
      return [
        question.id,
        {
          selectedIndex: saved?.selectedIndex ?? null,
          answerText: saved?.answerText ?? "",
        },
      ];
    }),
  );
}

function sourceCitations(
  sources: QuizView["questions"][number]["sources"],
): CitationView[] {
  return sources.map((source, index) => ({
    chunkId: `${source.documentId}-${source.pageNumber ?? "na"}-${index}`,
    documentId: source.documentId,
    documentTitle: source.documentTitle,
    pageNumber: source.pageNumber,
    sectionHeading: source.sectionHeading,
    excerpt: "",
  }));
}

export function QuizRunner({ view }: { view: QuizView }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerState>(() => initialAnswers(view));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    view.draft.length > 0 ? "saved" : "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  const mountedRef = useRef(true);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const payloadFor = useCallback(
    (state: AnswerState) =>
      view.questions.map((question) => {
        const entry = state[question.id];
        return {
          questionId: question.id,
          selectedIndex: entry?.selectedIndex ?? null,
          answerText: entry?.answerText ?? "",
        };
      }),
    [view.questions],
  );

  const persist = useCallback(async () => {
    setSaveState("saving");
    try {
      const response = await apiRequest<{ savedAt: string }>(
        `/api/assessments/${view.attemptId}/draft`,
        { method: "PUT", body: { answers: payloadFor(answersRef.current) } },
      );
      if (!mountedRef.current) return;
      setLastSavedAt(response.savedAt);
      setSaveState("saved");
    } catch {
      if (!mountedRef.current) return;
      setSaveState("error");
    }
  }, [payloadFor, view.attemptId]);

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist();
    }, 1400);
  }, [persist]);

  useEffect(() => {
    mountedRef.current = true;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (saveState === "saving" || saveState === "error") {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [saveState]);

  function setChoice(questionId: string, index: number) {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        selectedIndex: current[questionId]?.selectedIndex === index ? null : index,
        answerText: current[questionId]?.answerText ?? "",
      },
    }));
    scheduleSave();
  }

  function setText(questionId: string, value: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        selectedIndex: current[questionId]?.selectedIndex ?? null,
        answerText: value,
      },
    }));
    scheduleSave();
  }

  const answeredCount = useMemo(
    () =>
      view.questions.filter((question) => {
        const entry = answers[question.id];
        if (!entry) return false;
        if (question.type === "mcq") return entry.selectedIndex !== null;
        return entry.answerText.trim().length > 0;
      }).length,
    [answers, view.questions],
  );

  async function onSubmit() {
    setPending(true);
    setError(null);
    try {
      if (timerRef.current) clearTimeout(timerRef.current);
      await apiRequest(`/api/assessments/${view.attemptId}/submit`, {
        method: "POST",
        body: { answers: payloadFor(answers) },
      });
      router.push(`/diagnostics/${view.attemptId}/results`);
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 border-b border-[#e1e7e1] bg-[#f7f7f1]/95 px-1 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-[0.74rem] text-[#6b7a71]">
          <Badge tone="developing">In progress</Badge>
          <span>
            {answeredCount} of {view.questions.length} answered
          </span>
          <span aria-hidden>·</span>
          <span>{view.totalMarks} marks available</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            {saveState === "saving" ? (
              <>
                <Loader2 size={12} className="animate-spin" aria-hidden />
                Saving draft
              </>
            ) : saveState === "saved" ? (
              <>
                <CheckCircle2 size={12} className="text-[#176b50]" aria-hidden />
                Draft saved
                {lastSavedAt ? (
                  <span className="text-[#85928a]">
                    {new Date(lastSavedAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })}
                  </span>
                ) : null}
              </>
            ) : saveState === "error" ? (
              <>
                <CircleAlert size={12} className="text-[#a63d2f]" aria-hidden />
                Draft not saved
              </>
            ) : (
              <>
                <Save size={12} aria-hidden />
                Autosaves as you answer
              </>
            )}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setConfirming(true)}
          disabled={pending}
        >
          <Send size={13} aria-hidden />
          Submit attempt
        </button>
      </div>

      {saveState === "error" ? (
        <Callout tone="warning" title="Autosave failed">
          Your answers are still in this browser, but the draft was not stored. Check your connection and{" "}
          <button type="button" className="font-semibold underline" onClick={() => void persist()}>
            retry the draft save
          </button>
          .
        </Callout>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-[#ecc8c1] bg-[#fbf0ed] px-3 py-2 text-[0.82rem] text-[#7f2f24]">
          {error}
        </div>
      ) : null}

      {confirming ? (
        <div className="card border-[#cddbcf] p-5" role="dialog" aria-modal="true" aria-labelledby="confirm-submit">
          <h2 id="confirm-submit" className="text-[1.02rem]">
            Submit this attempt?
          </h2>
          <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[#64746a]">
            You have answered {answeredCount} of {view.questions.length} questions. Every question must be
            answered or explicitly skipped by leaving it blank. Submission is final and cannot be repeated
            for this attempt.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={pending}>
              {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}
              {pending ? "Scoring and updating evidence…" : "Submit and score"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Keep working
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {view.questions.map((question, index) => {
          const entry = answers[question.id] ?? { selectedIndex: null, answerText: "" };
          const answered =
            question.type === "mcq"
              ? entry.selectedIndex !== null
              : entry.answerText.trim().length > 0;
          return (
            <article key={question.id} className="card p-5" id={`question-${question.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-[0.67rem] text-[#7a877f]">
                  <span className="font-mono font-semibold text-[#3f5147]">
                    Q{String(index + 1).padStart(2, "0")}
                  </span>
                  <Badge tone="outline">{question.topicName}</Badge>
                  <span className="badge badge-neutral">{question.difficulty}</span>
                  <span>{question.marks} mark{question.marks === 1 ? "" : "s"}</span>
                  {answered ? (
                    <span className="inline-flex items-center gap-1 text-[#176b50]">
                      <CheckCircle2 size={12} aria-hidden />
                      Answered
                    </span>
                  ) : (
                    <span className="text-[#9a6414]">Not answered</span>
                  )}
                </div>
              </div>

              <h2 className="mt-3 whitespace-pre-line text-[0.98rem] leading-relaxed text-[#243a2e]">
                {question.prompt}
              </h2>

              {question.type === "mcq" && question.options.length > 0 ? (
                <fieldset className="mt-4 space-y-2">
                  <legend className="sr-only">Choose one answer</legend>
                  {question.options.map((option, optionIndex) => {
                    const selected = entry.selectedIndex === optionIndex;
                    return (
                      <label
                        key={`${question.id}-option-${optionIndex}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-2.5 transition ${
                          selected
                            ? "border-[#176b50] bg-[#f2f9f4]"
                            : "border-[#e1e7e1] bg-white hover:border-[#b9cdbf]"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          className="mt-1 h-4 w-4 accent-[#176b50]"
                          checked={selected}
                          onChange={() => setChoice(question.id, optionIndex)}
                        />
                        <span className="text-[0.84rem] leading-relaxed text-[#3c4f44]">
                          {option}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : (
                <div className="mt-4">
                  <label htmlFor={`answer-${question.id}`} className="label">
                    Your answer
                  </label>
                  <textarea
                    id={`answer-${question.id}`}
                    className="textarea min-h-[120px]"
                    maxLength={4000}
                    value={entry.answerText}
                    placeholder="Write your answer in your own words. It is scored against rubric concepts, not exact wording."
                    onChange={(event) => setText(question.id, event.target.value)}
                  />
                  <p className="field-help">
                    {4000 - entry.answerText.length} characters remaining. Leave blank only if you are
                    deliberately skipping this question.
                  </p>
                </div>
              )}

              {question.sources.length > 0 ? (
                <div className="mt-4 border-t border-[#eef1ea] pt-3">
                  <CitationList citations={sourceCitations(question.sources)} compact />
                  <p className="mt-1.5 text-[0.68rem] text-[#85928a]">
                    These are the exact source chunks used to write the question. Answer keys and feedback
                    remain withheld until submission.
                  </p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <section className="card p-5">
        <SectionHeading
          title="Ready to submit?"
          description="Scoring is deterministic for multiple choice and rubric-based for short answers. Mastery updates only when the evidence minimum is met."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[0.78rem] text-[#6b7a71]">
            <ScoreDisplay score={null} total={view.totalMarks} size="sm" />
            <span className="ml-2">
              {answeredCount}/{view.questions.length} answered
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setConfirming(true)}
            disabled={pending}
          >
            <Send size={15} aria-hidden />
            Submit attempt
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 text-[0.75rem] text-[#7a877f]">
        <Link href="/diagnostics" className="inline-flex items-center gap-1 hover:text-[#176b50]">
          <ArrowLeft size={13} aria-hidden />
          Back to diagnostics
        </Link>
        <span className="inline-flex items-center gap-1">
          <Clock3 size={12} aria-hidden />
          Started {new Date(view.startedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
        </span>
      </div>
    </div>
  );
}
