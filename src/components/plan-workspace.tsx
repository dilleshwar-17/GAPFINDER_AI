"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Circle, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";
import { Callout, SectionHeading, StatusBadge } from "@/components/ui";
import type { RevisionTaskView } from "@/lib/services/plans";

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function PlanBuilder({
  subjectId,
  defaultExamDate,
  defaultMinutes,
  defaultSession,
  isDemo,
  hasActivePlan,
  assessableTopics,
}: {
  subjectId: string;
  defaultExamDate: string;
  defaultMinutes: number;
  defaultSession: number;
  isDemo: boolean;
  hasActivePlan: boolean;
  assessableTopics: number;
}) {
  const router = useRouter();
  const fallbackDate = addDays(new Date().toISOString().slice(0, 10), 14);
  const [examDate, setExamDate] = useState(defaultExamDate || fallbackDate);
  const [minutesPerDay, setMinutesPerDay] = useState(defaultMinutes);
  const [sessionMinutes, setSessionMinutes] = useState(defaultSession);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiRequest("/api/plans", {
        method: "POST",
        body: {
          subjectId,
          examDate,
          minutesPerDay,
          sessionMinutes,
        },
      });
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPending(false);
    }
  }

  if (isDemo) {
    return (
      <Callout tone="gold" title="Plan generation is disabled in the shared demo">
        You can complete practice diagnostics and mark seeded tasks, but plan generation and task
        changes are blocked to keep the shared workspace stable. Create a personal account to build and
        version your own plan.
      </Callout>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-5 sm:p-6">
      <SectionHeading
        title={hasActivePlan ? "Regenerate the revision plan" : "Build a revision plan"}
        description={
          hasActivePlan
            ? "Regenerating versions the plan forward. The previous version and its completed tasks are preserved as history."
            : `${assessableTopics} leaf topic${assessableTopics === 1 ? "" : "s"} are available to schedule.`
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="plan-exam" className="label">
            Exam date
          </label>
          <input
            id="plan-exam"
            type="date"
            className="input"
            value={examDate}
            min={addDays(new Date().toISOString().slice(0, 10), 1)}
            required
            onChange={(event) => setExamDate(event.target.value)}
          />
          <p className="field-help">Plans are capped to a 14-day horizon.</p>
        </div>
        <div>
          <label htmlFor="plan-minutes" className="label">
            Minutes per day
          </label>
          <input
            id="plan-minutes"
            type="number"
            className="input"
            min={10}
            max={480}
            value={minutesPerDay}
            onChange={(event) => setMinutesPerDay(Number(event.target.value))}
          />
          <p className="field-help">The server enforces this budget.</p>
        </div>
        <div>
          <label htmlFor="plan-session" className="label">
            Session length
          </label>
          <select
            id="plan-session"
            className="select"
            value={sessionMinutes}
            onChange={(event) => setSessionMinutes(Number(event.target.value))}
          >
            {[20, 30, 45, 60, 90].map((value) => (
              <option key={value} value={value}>
                {value} minutes
              </option>
            ))}
          </select>
          <p className="field-help">Between 20 and 90 minutes.</p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.8rem] text-[#b42318]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eaecf0] pt-4">
        <p className="max-w-md text-[0.72rem] leading-relaxed text-[#667085]">
          Priority is computed as 0.5 × weakness + 0.3 × importance + 0.2 × urgency, plus a bounded
          prerequisite boost when an explicit syllabus dependency is measured weak.
        </p>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : hasActivePlan ? (
            <RefreshCcw size={15} aria-hidden />
          ) : (
            <Sparkles size={15} aria-hidden />
          )}
          {pending ? "Building plan…" : hasActivePlan ? "Version plan forward" : "Build plan"}
        </button>
      </div>
    </form>
  );
}

export function TaskChecklist({
  tasks,
  isDemo,
}: {
  tasks: RevisionTaskView[];
  isDemo: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, RevisionTaskView["status"]>>({});

  async function toggle(task: RevisionTaskView) {
    if (isDemo) return;
    setPendingId(task.id);
    setError(null);
    try {
      const response = await apiRequest<{ task: RevisionTaskView }>(
        `/api/plans/tasks/${task.id}`,
        { method: "PATCH" },
      );
      setLocal((current) => ({ ...current, [task.id]: response.task.status }));
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPendingId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <p className="text-[0.82rem] text-[#667085]">
        This plan has no scheduled tasks. Increase the daily budget or extend the exam date.
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-3 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.78rem] text-[#b42318]">
          {error}
        </p>
      ) : null}
      <ol className="space-y-2">
        {tasks.map((task) => {
          const status = local[task.id] ?? task.status;
          const completed = status === "completed";
          return (
            <li
              key={task.id}
              className={`rounded-[10px] border px-3.5 py-3 transition ${
                completed
                  ? "border-[#d9d6fe] bg-[#f4f3ff]"
                  : "border-[#eaecf0] bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="mt-0.5 shrink-0 text-[#7a5af8] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => toggle(task)}
                  disabled={isDemo || pendingId === task.id}
                  aria-label={completed ? `Mark ${task.topicName} as pending` : `Mark ${task.topicName} as completed`}
                  title={isDemo ? "Shared demo tasks are read-only." : undefined}
                >
                  {pendingId === task.id ? (
                    <Loader2 size={18} className="animate-spin" aria-hidden />
                  ) : completed ? (
                    <CheckCircle2 size={18} aria-hidden />
                  ) : (
                    <Circle size={18} aria-hidden />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-[0.85rem] font-medium ${
                        completed ? "text-[#344054] line-through" : "text-[#344054]"
                      }`}
                    >
                      {task.topicName}
                    </p>
                    <StatusBadge status={status} />
                    <span className="font-mono text-[0.65rem] text-[#667085]">
                      {task.durationMinutes} min · priority {Math.round(task.priority)}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.77rem] leading-relaxed text-[#475467]">{task.objective}</p>
                  <p className="mt-1 text-[0.68rem] text-[#98a2b3]">{task.priorityReason}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 flex items-center gap-1.5 text-[0.7rem] text-[#98a2b3]">
        <CalendarDays size={12} aria-hidden />
        {isDemo
          ? "Task changes are disabled in the shared demo."
          : "Completed tasks are preserved when a new assessment versions the plan."}
      </p>
    </div>
  );
}
