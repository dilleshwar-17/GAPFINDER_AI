"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";

interface SubjectOption {
  id: string;
  name: string;
  documentCount: number;
}

const KINDS = [
  { value: "syllabus", label: "Syllabus", help: "Unit and topic headings drive the topic map." },
  { value: "notes", label: "Notes", help: "The main evidence source for questions and explanations." },
  { value: "past_paper", label: "Past paper", help: "Shows question style, but its answers are not used as a key." },
  { value: "other", label: "Other", help: "Supplementary reading or reference material." },
];

export function UploadForm({
  subjects,
  initialSubjectId,
  isDemo,
  maxUploadMb,
}: {
  subjects: SubjectOption[];
  initialSubjectId: string;
  isDemo: boolean;
  maxUploadMb: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [kind, setKind] = useState("syllabus");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a PDF, TXT or Markdown file.");
      return;
    }
    if (!subjectId) {
      setError("Choose a subject.");
      return;
    }
    if (file.size > maxUploadMb * 1024 * 1024) {
      setError(`Files must be ${maxUploadMb} MB or smaller.`);
      return;
    }

    const form = new FormData();
    form.set("file", file);
    form.set("subjectId", subjectId);
    form.set("kind", kind);
    setPending(true);
    try {
      const result = await apiRequest<{ document: { id: string } }>("/api/documents", {
        method: "POST",
        formData: form,
      });
      router.push(`/materials/${result.document.id}`);
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setPending(false);
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="card border-dashed bg-[#fcfcf8] p-6">
        <h2 className="text-[1rem]">Create a subject first</h2>
        <p className="mt-1 text-[0.84rem] leading-relaxed text-[#68756d]">
          Material must belong to a subject. Create one, then return to upload a syllabus and notes.
        </p>
        <a href="/subjects?intent=create" className="btn btn-primary btn-sm mt-4">
          Create a subject
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-5 sm:p-6">
      {isDemo ? (
        <div className="mb-4 rounded-lg border border-[#e8d6a8] bg-[#faf6ea] px-3 py-2 text-[0.78rem] leading-relaxed text-[#6d5418]">
          Uploads are blocked in the shared demo workspace. Create a personal account to add your own
          material.
        </div>
      ) : null}

      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Upload study material</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="upload-subject" className="label">
              Subject
            </label>
            <select
              id="upload-subject"
              className="select"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              required
            >
              <option value="">Choose a subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="upload-kind" className="label">
              Material type
            </label>
            <select
              id="upload-kind"
              className="select"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="field-help">{KINDS.find((option) => option.value === kind)?.help}</p>
          </div>
        </div>

        <div>
          <span className="label" id="upload-file-label">
            File
          </span>
          <div className="rounded-xl border border-dashed border-[#cbd7cd] bg-[#fbfcf8] px-4 py-6 text-center">
            <FileUp size={22} className="mx-auto text-[#49806b]" aria-hidden />
            <p className="mt-2 text-[0.84rem] font-medium text-[#34483c]">
              {file ? file.name : "Choose a PDF, TXT or Markdown file"}
            </p>
            <p className="mt-1 text-[0.74rem] text-[#7a877f]">
              Maximum {maxUploadMb} MB. The file is extracted, chunked and embedded before it is listed as indexed.
            </p>
            <input
              ref={inputRef}
              id="upload-file"
              type="file"
              accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
              className="sr-only"
              aria-labelledby="upload-file-label"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-3"
              onClick={() => inputRef.current?.click()}
            >
              {file ? "Choose a different file" : "Browse files"}
            </button>
          </div>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-[#ecc8c1] bg-[#fbf0ed] px-3 py-2 text-[0.8rem] text-[#7f2f24]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ece3] pt-4">
        <p className="max-w-md text-[0.72rem] leading-relaxed text-[#7a877f]">
          Duplicate files in the same subject are rejected by content hash. If no AI provider is
          configured, local non-neural embeddings are used and question generation falls back to a
          deterministic source-grounded generator.
        </p>
        <button type="submit" className="btn btn-primary" disabled={pending || isDemo || !file}>
          {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <FileUp size={15} aria-hidden />}
          {pending ? "Extracting and indexing…" : "Upload and index"}
        </button>
      </div>
    </form>
  );
}
