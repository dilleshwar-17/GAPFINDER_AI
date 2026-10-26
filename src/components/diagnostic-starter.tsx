"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import { apiRequest, messageForError, ApiRequestError, validationIssues } from "@/lib/client/api";
import { Callout, MasteryBadge, ScoreDisplay } from "@/components/ui";
import type { TopicClassification } from "@/lib/domain/types";

interface StarterTopic {
  id: string;
  name: string;
  classification: TopicClassification;
  sufficient: boolean;
  mastery: number | null;
  questionCount: number;
  sourceCount: number;
}

interface StartResult {
  result: {
    attemptId: string;
    questionCount: number;
    totalMarks: number;
    skipped: Array<{ topicId: string; topicName: string; reason: string }>;
    warnings: string[];
  };
}

export function DiagnosticStarter({
  subjectId,
  subjectName,
  topics,
  initialTopicId,
  isDemo,
  maxTopics = 3,
}: {
  subjectId: string;
  subjectName: string;
  topics: StarterTopic[];
  initialTopicId?: string;
  isDemo: boolean;
  maxTopics?: number;
}) {
  const router = useRouter();
  const initial = initialTopicId && topics.some((topic) => topic.id === initialTopicId)
    ? [initialTopicId]
    : [];
  const [selected, setSelected] = useState<string[]>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);
  const [result, setResult] = useState<StartResult["result"] | null>(null);

  function toggle(topicId: string) {
    setError(null);
    setIssues([]);
    setSelected((current) => {
      if (current.includes(topicId)) return current.filter((id) => id !== topicId);
      if (current.length >= maxTopics) return current;
      return [...current, topicId];
    });
  }

  async function onStart() {
    if (selected.length === 0) {
      setError("Select at least one topic with indexed material.");
      return;
    }
    setPending(true);
    setError(null);
    setIssues([]);
    try {
      const response = await apiRequest<StartResult>("/api/assessments", {
        method: "POST",
        body: { subjectId, topicIds: selected },
      });
      setResult(response.result);
    } catch (caught) {
      setError(messageForError(caught));
      setIssues(validationIssues(caught));
      if (caught instanceof ApiRequestError && caught.code === "INSUFFICIENT_EVIDENCE") {
        const details = caught.details?.skipped;
        if (Array.isArray(details)) {
          setIssues(
            details.map((item) => {
              const entry = item as { topicName?: string; reason?: string };
              return {
                path: entry.topicName ?? "Topic",
                message: entry.reason ?? "Not enough source evidence.",
              };
            }),
          );
        }
      }
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Callout tone="success" title="Diagnostic prepared">
          {result.questionCount} source-grounded question{result.questionCount === 1 ? "" : "s"} worth{" "}
          {result.totalMarks} mark{result.totalMarks === 1 ? "" : "s"} {result.questionCount === 1 ? "is" : "are"}{" "}
          ready. Nothing is scored until you submit.
        </Callout>

        {result.skipped.length > 0 ? (
          <div className="rounded-[10px] border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-[0.82rem] text-[#b54708]">
            <p className="mb-1 font-semibold">Some selected topics were skipped</p>
            <ul className="list-disc space-y-1 pl-4">
              {result.skipped.map((topic) => (
                <li key={topic.topicId}>
                  <strong>{topic.topicName}:</strong> {topic.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.warnings.length > 0 ? (
          <div className="rounded-[10px] border border-[#b9e6fe] bg-[#f0f9ff] px-4 py-3 text-[0.82rem] text-[#344054]">
            <p className="mb-1 font-semibold">Generation notes</p>
            <ul className="list-disc space-y-1 pl-4">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href={`/diagnostics/${result.attemptId}`} className="btn btn-primary">
            Begin diagnostic
            <ArrowRight size={15} aria-hidden />
          </Link>
          <Link href="/diagnostics" className="btn btn-secondary">
            Save for later
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isDemo ? (
        <Callout tone="gold" title="Practice mode in the shared demo">
          This diagnostic is scored and saved for you, but it does not change the seeded mastery history
          or revision plan that other reviewers see. Uploads and subject changes are disabled.
        </Callout>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.78rem] text-[#667085]">
          {subjectName}: select up to {maxTopics} topics · {selected.length} selected
        </p>
        <span className="inline-flex items-center gap-1 text-[0.7rem] text-[#667085]">
          <Sparkles size={12} aria-hidden />
          No answer key is sent to the browser
        </span>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">Select topics to assess</legend>
        {topics.map((topic) => {
          const checked = selected.includes(topic.id);
          const disabled = !checked && selected.length >= maxTopics;
          return (
            <label
              key={topic.id}
              className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-3 transition ${
                checked
                  ? "border-[#7a5af8] bg-[#f4f3ff]"
                  : disabled
                    ? "cursor-not-allowed border-[#eaecf0] bg-[#f9fafb] opacity-60"
                    : "border-[#eaecf0] bg-white hover:border-[#bdb4fe]"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#7a5af8]"
                checked={checked}
                disabled={disabled || pending}
                onChange={() => toggle(topic.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.86rem] font-medium text-[#344054]">{topic.name}</span>
                  <MasteryBadge
                    classification={topic.classification}
                    sufficient={topic.sufficient}
                  />
                </span>
                <span className="mt-1 block text-[0.71rem] text-[#667085]">
                  {topic.questionCount} cached question{topic.questionCount === 1 ? "" : "s"} ·{" "}
                  {topic.sourceCount} linked source{topic.sourceCount === 1 ? "" : "s"}
                  {topic.sufficient && topic.mastery !== null ? (
                    <> · last measured {Math.round(topic.mastery)}% mastery</>
                  ) : (
                    <> · not yet assessed</>
                  )}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {selected.length >= maxTopics ? (
        <p className="flex items-center gap-1.5 text-[0.72rem] text-[#b54708]">
          <AlertTriangle size={13} aria-hidden />
          Three topics is the server limit for one diagnostic. Deselect one to choose another.
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.8rem] text-[#b42318]">
          <p className="font-medium">{error}</p>
          {issues.length > 0 ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[0.75rem]">
              {issues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  <strong>{issue.path}:</strong> {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eaecf0] pt-4">
        <p className="max-w-md text-[0.72rem] leading-relaxed text-[#667085]">
          Questions are retrieved from your material, checked against real chunk IDs, and stored before
          the attempt starts. A topic without enough evidence is reported, not filled in.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onStart}
          disabled={pending || selected.length === 0}
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <ClipboardCheck size={15} aria-hidden />
          )}
          {pending ? "Retrieving evidence…" : "Prepare diagnostic"}
        </button>
      </div>
    </div>
  );
}
