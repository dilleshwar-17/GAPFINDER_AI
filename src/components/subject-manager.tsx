"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  FileStack,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";

interface SubjectCard {
  id: string;
  name: string;
  description: string | null;
  examDate: string | null;
  isDemo: boolean;
  readyDocuments: number;
  topicCount: number;
  submittedAttempts: number;
  weakTopics: number;
  developingTopics: number;
  strongTopics: number;
  assessedTopics: number;
}

function SubjectForm({
  initial,
  onClose,
  onSaved,
  isDemo,
}: {
  initial?: { id: string; name: string; description: string | null; examDate: string | null };
  onClose: () => void;
  onSaved: () => void;
  isDemo: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [examDate, setExamDate] = useState(initial?.examDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (initial) {
        await apiRequest(`/api/subjects/${initial.id}`, {
          method: "PATCH",
          body: { name, description, examDate: examDate || undefined },
        });
      } else {
        await apiRequest("/api/subjects", {
          method: "POST",
          body: { name, description, examDate: examDate || undefined },
        });
      }
      onSaved();
      onClose();
    } catch (caught) {
      setError(messageForError(caught));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card border-[#cddbcf] p-4" aria-labelledby="subject-form-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id="subject-form-title" className="text-[0.98rem]">
          {initial ? "Edit subject" : "New subject"}
        </h3>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close form">
          <X size={14} aria-hidden />
        </button>
      </div>
      {isDemo ? (
        <p className="mb-3 rounded-lg border border-[#e8d6a8] bg-[#faf6ea] px-3 py-2 text-[0.76rem] text-[#6d5418]">
          The shared demo workspace is read-only. Create a personal account to change subjects.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="subject-name" className="label">
            Subject name
          </label>
          <input
            id="subject-name"
            className="input"
            value={name}
            required
            minLength={2}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Organic Chemistry"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="subject-description" className="label">
            Description <span className="font-normal normal-case tracking-normal text-[#85928a]">(optional)</span>
          </label>
          <textarea
            id="subject-description"
            className="textarea min-h-[70px]"
            value={description ?? ""}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this subject covers, or the exam you are targeting."
          />
        </div>
        <div>
          <label htmlFor="subject-exam" className="label">
            Exam date <span className="font-normal normal-case tracking-normal text-[#85928a]">(optional)</span>
          </label>
          <input
            id="subject-exam"
            type="date"
            className="input"
            value={examDate ?? ""}
            onChange={(event) => setExamDate(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-[#ecc8c1] bg-[#fbf0ed] px-3 py-2 text-[0.78rem] text-[#7f2f24]">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
          {pending ? "Saving…" : initial ? "Save changes" : "Create subject"}
        </button>
      </div>
    </form>
  );
}

export function SubjectManager({
  subjects,
  isDemo,
  initialCreate = false,
}: {
  subjects: SubjectCard[];
  isDemo: boolean;
  initialCreate?: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(initialCreate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(subject: SubjectCard) {
    const confirmed = window.confirm(
      `Delete "${subject.name}" and its sources and topics? This is refused if the subject has submitted assessment history.`,
    );
    if (!confirmed) return;
    setDeletingId(subject.id);
    setError(null);
    try {
      await apiRequest(`/api/subjects/${subject.id}`, { method: "DELETE" });
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.8rem] text-[#6b7a71]">
          {subjects.length} subject{subjects.length === 1 ? "" : "s"} in this workspace
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setCreating(true);
            setEditingId(null);
          }}
          disabled={isDemo}
          title={isDemo ? "The shared demo workspace is read-only." : undefined}
        >
          <Plus size={14} aria-hidden />
          New subject
        </button>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-[#ecc8c1] bg-[#fbf0ed] px-3 py-2 text-[0.8rem] text-[#7f2f24]">
          {error}
        </div>
      ) : null}

      {creating ? (
        <SubjectForm
          isDemo={isDemo}
          onClose={() => setCreating(false)}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {subjects.length === 0 && !creating ? (
        <div className="card border-dashed bg-[#fcfcf8] p-7">
          <h2 className="text-[1rem]">Start with one subject</h2>
          <p className="mt-1 max-w-lg text-[0.84rem] leading-relaxed text-[#68756d]">
            Add the subject you are preparing for. You will then upload a syllabus and notes, build a
            topic map and take a short diagnostic.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-4"
            onClick={() => setCreating(true)}
            disabled={isDemo}
          >
            Create your first subject
          </button>
        </div>
      ) : null}

      <div className="grid gap-4">
        {subjects.map((subject) =>
          editingId === subject.id ? (
            <SubjectForm
              key={subject.id}
              initial={{
                id: subject.id,
                name: subject.name,
                description: subject.description,
                examDate: subject.examDate,
              }}
              isDemo={isDemo}
              onClose={() => setEditingId(null)}
              onSaved={() => router.refresh()}
            />
          ) : (
            <article key={subject.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[1.05rem]">
                      <Link href={`/subjects/${subject.id}/topics`} className="hover:text-[#176b50]">
                        {subject.name}
                      </Link>
                    </h2>
                    {subject.isDemo ? <span className="badge badge-demo">Seeded demo</span> : null}
                  </div>
                  {subject.description ? (
                    <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[#64746a]">{subject.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.72rem] text-[#6b7a71]">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} aria-hidden />
                      {subject.examDate ? `Exam ${subject.examDate}` : "No exam date"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileStack size={12} aria-hidden />
                      {subject.readyDocuments} indexed source{subject.readyDocuments === 1 ? "" : "s"}
                    </span>
                    <span>{subject.topicCount} topics</span>
                    <span>{subject.submittedAttempts} submitted attempts</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-[0.66rem]">
                    {subject.weakTopics > 0 ? <span className="badge badge-weak">{subject.weakTopics} weak</span> : null}
                    {subject.developingTopics > 0 ? (
                      <span className="badge badge-developing">{subject.developingTopics} developing</span>
                    ) : null}
                    {subject.strongTopics > 0 ? <span className="badge badge-strong">{subject.strongTopics} strong</span> : null}
                    {subject.assessedTopics === 0 ? <span className="badge badge-neutral">Not assessed</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/subjects/${subject.id}/topics`} className="btn btn-secondary btn-sm">
                    Topic map
                  </Link>
                  <Link href={`/materials?subject=${subject.id}`} className="btn btn-ghost btn-sm">
                    Materials
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingId(subject.id);
                      setCreating(false);
                    }}
                    disabled={isDemo}
                    title={isDemo ? "The shared demo workspace is read-only." : "Edit subject"}
                  >
                    <Pencil size={13} aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => onDelete(subject)}
                    disabled={isDemo || deletingId === subject.id}
                    title={isDemo ? "The shared demo workspace is read-only." : "Delete subject"}
                  >
                    {deletingId === subject.id ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 size={13} aria-hidden />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </div>
  );
}
