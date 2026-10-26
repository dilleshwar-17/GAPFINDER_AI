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
  const [dragActive, setDragActive] = useState(false);

  function chooseFile(candidate: File | null | undefined) {
    if (!candidate) return;
    if (candidate.size > maxUploadMb * 1024 * 1024) {
      setFile(null);
      setError(`Files must be ${maxUploadMb} MB or smaller.`);
      return;
    }
    setError(null);
    setFile(candidate);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
    return `${Math.round(bytes / (1024 * 1024) * 10) / 10} MB`;
  }

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
      <div className="card border-dashed bg-[#fcfcfd] p-6">
        <h2 className="text-[1rem]">Create a subject first</h2>
        <p className="mt-1 text-[0.84rem] leading-relaxed text-[#667085]">
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
        <div className="mb-4 rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-[0.78rem] leading-relaxed text-[#b54708]">
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
          <div
            className={`upload-zone rounded-xl border border-dashed px-4 py-6 text-center ${
              dragActive
                ? "border-[#7a5af8] bg-[#f4f3ff]"
                : "border-[#d0d5dd] bg-[#fcfcfd]"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              chooseFile(event.dataTransfer.files?.[0]);
            }}
          >
            <FileUp
              size={22}
              className={`mx-auto ${dragActive ? "text-[#6938ef]" : "text-[#7a5af8]"}`}
              aria-hidden
            />
            <p className="mt-2 text-[0.84rem] font-medium text-[#344054]">
              {dragActive
                ? "Drop the file to attach it"
                : file
                  ? file.name
                  : "Drag a PDF, TXT or Markdown file here"}
            </p>
            <p className="mt-1 text-[0.74rem] text-[#667085]">
              {file
                ? `${formatSize(file.size)} · ready to extract and index`
                : `or browse your device · maximum ${maxUploadMb} MB`}
            </p>
            <input
              ref={inputRef}
              id="upload-file"
              type="file"
              accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
              className="sr-only"
              aria-labelledby="upload-file-label"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                {file ? "Choose a different file" : "Browse files"}
              </button>
              {file ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.8rem] text-[#b42318]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eaecf0] pt-4">
        <p className="max-w-md text-[0.72rem] leading-relaxed text-[#667085]">
          Duplicate files in the same subject are rejected by content hash. If no AI provider is
          configured, local non-neural embeddings are used and question generation falls back to a
          deterministic source-grounded generator.
        </p>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || isDemo || !file}
            aria-describedby={!file ? "upload-submit-hint" : undefined}
          >
            {pending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : (
              <FileUp size={15} aria-hidden />
            )}
            {pending ? "Extracting and indexing…" : "Upload and index"}
          </button>
          {!file ? (
            <p id="upload-submit-hint" className="text-[0.68rem] text-[#667085]">
              Attach a file to enable this button.
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
