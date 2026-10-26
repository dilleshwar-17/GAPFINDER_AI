"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";

type Step = 1 | 2 | 3;

export function OnboardingWizard({
  defaultName,
  defaultMinutes,
  defaultSession,
}: {
  defaultName: string;
  defaultMinutes: number;
  defaultSession: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [minutesPerDay, setMinutesPerDay] = useState(defaultMinutes);
  const [sessionMinutes, setSessionMinutes] = useState(defaultSession);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function next() {
    setError(null);
    if (step === 1) {
      if (name.trim().length < 2) {
        setError("Give the subject a name of at least two characters.");
        return;
      }
      if (examDate) {
        const exam = new Date(`${examDate}T00:00:00Z`).getTime();
        if (Number.isNaN(exam) || exam <= Date.now()) {
          setError("Choose an exam date in the future, or leave it blank for now.");
          return;
        }
      }
      setStep(2);
      return;
    }
    setStep(3);
  }

  async function finish() {
    setPending(true);
    setError(null);
    try {
      const created = await apiRequest<{ subject: { id: string } }>("/api/subjects", {
        method: "POST",
        body: {
          name,
          description: "",
          examDate: examDate || undefined,
        },
      });
      await apiRequest("/api/preferences", {
        method: "PUT",
        body: {
          minutesPerDay,
          sessionMinutes,
          completeOnboarding: true,
          lastSubjectId: created.subject.id,
        },
      });
      router.push(`/materials/upload?subject=${created.subject.id}`);
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setPending(false);
    }
  }

  return (
    <div className="card p-6 sm:p-7">
      <ol className="mb-7 flex items-center gap-2" aria-label="Onboarding progress">
        {[1, 2, 3].map((value) => (
          <li key={value} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[0.68rem] font-semibold ${
                step > value
                  ? "border-[#7a5af8] bg-[#7a5af8] text-white"
                  : step === value
                    ? "border-[#7a5af8] bg-[#ebe9fe] text-[#7a5af8]"
                    : "border-[#d0d5dd] bg-white text-[#98a2b3]"
              }`}
            >
              {step > value ? <Check size={13} aria-hidden /> : value}
            </span>
            <span className={`text-[0.72rem] ${step === value ? "font-semibold text-[#1d2939]" : "text-[#667085]"}`}>
              {value === 1 ? "Subject" : value === 2 ? "Study time" : "Confirm"}
            </span>
            {value < 3 ? <span className="h-px flex-1 bg-[#eaecf0]" aria-hidden /> : null}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-[1.1rem]">Which subject are you preparing for?</h2>
            <p className="mt-1 text-[0.82rem] text-[#475467]">
              Start with one. You can add more later from Subjects.
            </p>
          </div>
          <div>
            <label htmlFor="onboarding-subject" className="label">
              Subject name
            </label>
            <input
              id="onboarding-subject"
              className="input"
              value={name}
              maxLength={100}
              placeholder={`e.g. ${defaultName}`}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="onboarding-exam" className="label">
              Exam date <span className="font-normal normal-case tracking-normal text-[#98a2b3]">(optional)</span>
            </label>
            <input
              id="onboarding-exam"
              type="date"
              className="input"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
            />
            <p className="field-help">Plans are capped to a fourteen-day horizon even when the exam is further away.</p>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-[1.1rem]">How much time can you realistically give this?</h2>
            <p className="mt-1 text-[0.82rem] text-[#475467]">
              The server enforces this budget when generating a revision plan.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="onboarding-minutes" className="label">
                Minutes per day
              </label>
              <input
                id="onboarding-minutes"
                type="number"
                min={10}
                max={480}
                className="input"
                value={minutesPerDay}
                onChange={(event) => setMinutesPerDay(Number(event.target.value))}
              />
              <p className="field-help">Between 10 and 480 minutes.</p>
            </div>
            <div>
              <label htmlFor="onboarding-session" className="label">
                Session length
              </label>
              <select
                id="onboarding-session"
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
              <p className="field-help">Between 20 and 90 minutes per task.</p>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-[1.1rem]">Confirm your starting point</h2>
            <p className="mt-1 text-[0.82rem] text-[#475467]">
              The subject is created immediately, then you will add material.
            </p>
          </div>
          <dl className="divide-y divide-[#eaecf0] rounded-lg border border-[#eaecf0] bg-[#fcfcfd] px-4">
            <div className="flex items-center justify-between gap-4 py-2.5 text-[0.82rem]">
              <dt className="text-[#667085]">Subject</dt>
              <dd className="font-medium text-[#344054]">{name}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-[0.82rem]">
              <dt className="text-[#667085]">Exam date</dt>
              <dd className="text-[#344054]">{examDate || "Not set"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-[0.82rem]">
              <dt className="text-[#667085]">Daily budget</dt>
              <dd className="text-[#344054]">
                {minutesPerDay} min · {sessionMinutes} min sessions
              </dd>
            </div>
          </dl>
          <p className="text-[0.74rem] leading-relaxed text-[#667085]">
            Next you will upload a syllabus and notes. Topic extraction only creates topics from
            headings present in that material; nothing is invented when a heading is absent.
          </p>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.8rem] text-[#b42318]">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#eaecf0] pt-4">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => (step === 1 ? router.push("/dashboard") : setStep((step - 1) as Step))}
          disabled={pending}
        >
          <ArrowLeft size={14} aria-hidden />
          {step === 1 ? "Skip for now" : "Back"}
        </button>
        {step < 3 ? (
          <button type="button" className="btn btn-primary" onClick={next}>
            Continue
            <ArrowRight size={14} aria-hidden />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={finish} disabled={pending}>
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            {pending ? "Creating…" : "Create subject"}
          </button>
        )}
      </div>
    </div>
  );
}
