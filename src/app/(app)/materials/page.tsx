import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FileStack, Quote, Upload } from "lucide-react";
import { requirePageUser } from "@/lib/auth/page";
import { listAllDocuments } from "@/lib/services/documents";
import { listSubjects } from "@/lib/services/subjects";
import { formatDate, formatFileSize } from "@/lib/http";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { DocumentActions } from "@/components/document-actions";
import { SubjectFilter } from "@/components/subject-filter";

export const metadata: Metadata = { title: "Materials" };
export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const subjects = await listSubjects(user.id);
  const filterSubjectId = subjects.some((subject) => subject.id === params.subject)
    ? params.subject
    : undefined;
  const documents = (await listAllDocuments(user.id)).filter(
    (document) => !filterSubjectId || document.subjectId === filterSubjectId,
  );
  const activeSubject = subjects.find((subject) => subject.id === filterSubjectId);

  return (
    <>
      <PageHeader
        eyebrow="Sources"
        title="Materials"
        description="Every indexed document is chunked with page and heading provenance. A citation always points back to one of these chunks."
        actions={
          <Link href={`/materials/upload${filterSubjectId ? `?subject=${filterSubjectId}` : ""}`} className="btn btn-primary btn-sm">
            <Upload size={14} aria-hidden />
            Upload material
          </Link>
        }
      />

      <SubjectFilter
        basePath="/materials"
        subjects={subjects}
        selectedId={filterSubjectId ?? null}
        showAll
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileStack size={18} aria-hidden />}
          title={activeSubject ? `No material in ${activeSubject.name}` : "No material yet"}
          description="Upload a syllabus for headings, notes for evidence and a past paper for question style. A PDF, TXT or Markdown file is accepted."
          action={
            <Link
              href={`/materials/upload${filterSubjectId ? `?subject=${filterSubjectId}` : ""}`}
              className="btn btn-primary btn-sm"
            >
              Upload the first file
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {documents.map((document) => (
            <article key={document.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-all text-[0.98rem]">
                      <Link href={`/materials/${document.id}`} className="hover:text-[#7a5af8]">
                        {document.filename}
                      </Link>
                    </h2>
                    <StatusBadge status={document.status} />
                    <span className="badge badge-outline">{document.kind.replace("_", " ")}</span>
                    {document.subjectIsDemo ? <span className="badge badge-demo">Seeded demo</span> : null}
                  </div>
                  <p className="mt-1 text-[0.74rem] text-[#667085]">
                    {document.subjectName} · {formatFileSize(document.sizeBytes)} · added {formatDate(document.createdAt)}
                    {document.pageCount !== null ? ` · ${document.pageCount} page${document.pageCount === 1 ? "" : "s"}` : ""}
                  </p>

                  {document.excerpt ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#eaecf0] bg-[#f9fafb] px-3 py-2">
                      <Quote size={12} className="mt-0.5 shrink-0 text-[#7a5af8]" aria-hidden />
                      <p className="line-clamp-2 text-[0.76rem] leading-relaxed text-[#475467]">
                        {document.excerpt}
                      </p>
                    </div>
                  ) : null}

                  {document.status === "failed" && document.errorMessage ? (
                    <p className="mt-2 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.76rem] text-[#b42318]">
                      {document.errorMessage}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-[#667085]">
                    <span>{document.chunkCount} indexed chunk{document.chunkCount === 1 ? "" : "s"}</span>
                    <span>{document.citationCount} question{document.citationCount === 1 ? "" : "s"} citing it</span>
                    {document.processedAt ? <span>Processed {formatDate(document.processedAt)}</span> : null}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <Link href={`/materials/${document.id}`} className="btn btn-secondary btn-sm">
                    Inspect provenance
                    <ArrowUpRight size={13} aria-hidden />
                  </Link>
                  <DocumentActions
                    documentId={document.id}
                    subjectId={document.subjectId}
                    status={document.status}
                    isDemo={user.isDemo}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
