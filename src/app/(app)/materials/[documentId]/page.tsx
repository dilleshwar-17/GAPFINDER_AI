import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Quote } from "lucide-react";
import { requirePageUser, pageNotFoundIfMissing } from "@/lib/auth/page";
import { getDocumentDetail } from "@/lib/services/documents";
import { formatDate, formatFileSize, pageLabel } from "@/lib/http";
import { Badge, Callout, PageHeader, StatusBadge } from "@/components/ui";
import { DocumentActions } from "@/components/document-actions";

export const metadata: Metadata = { title: "Document provenance" };
export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const user = await requirePageUser();
  const { documentId } = await params;

  let detail;
  try {
    detail = getDocumentDetail(user.id, documentId);
  } catch (error) {
    pageNotFoundIfMissing(error);
  }
  const { document, chunks } = detail;

  return (
    <>
      <Link
        href={`/materials?subject=${document.subjectId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[0.78rem] text-[#65756b] hover:text-[#176b50]"
      >
        <ArrowLeft size={13} aria-hidden />
        Materials in {document.subjectName}
      </Link>

      <PageHeader
        eyebrow="Document provenance"
        title={document.filename}
        meta={
          <>
            <Link href={`/subjects/${document.subjectId}/topics`} className="hover:text-[#176b50] hover:underline">
              {document.subjectName}
            </Link>
            <span aria-hidden>·</span>
            <span>{document.kind.replace("_", " ")}</span>
            <StatusBadge status={document.status} />
            {document.subjectIsDemo ? <Badge tone="demo">Seeded demo</Badge> : null}
          </>
        }
        description="This is the exact text the retrieval layer can cite. Chunk boundaries carry the page and heading that were present in the uploaded file; they are not reconstructed after the fact."
        actions={
          <DocumentActions
            documentId={document.id}
            subjectId={document.subjectId}
            status={document.status}
            isDemo={user.isDemo}
            redirectOnDelete
          />
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["File size", formatFileSize(document.sizeBytes)],
          ["Pages", document.pageCount === null ? "Not available" : String(document.pageCount)],
          ["Indexed chunks", String(document.chunkCount)],
          ["Questions citing", String(document.citationCount)],
        ].map(([label, value]) => (
          <div key={label} className="card p-3.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#7a877f]">{label}</p>
            <p className="mt-1 text-[1rem] font-semibold text-[#2c4034]">{value}</p>
          </div>
        ))}
      </div>

      <p className="mb-5 text-[0.74rem] text-[#74837a]">
        Added {formatDate(document.createdAt)}
        {document.processedAt ? ` · last processed ${formatDate(document.processedAt)}` : ""}
      </p>

      {document.status === "failed" ? (
        <div className="mb-5">
          <Callout tone="danger" title="Indexing failed">
            {document.errorMessage ?? "The document could not be processed."} The stored file is retained,
            so you can retry processing without re-uploading.
          </Callout>
        </div>
      ) : null}

      {document.status === "processing" ? (
        <div className="mb-5">
          <Callout tone="info" title="Still processing">
            This document is not yet available for retrieval. Refresh after processing completes.
          </Callout>
        </div>
      ) : null}

      {chunks.length === 0 ? (
        <div className="card border-dashed bg-[#fcfcf8] p-6 text-[0.84rem] text-[#68756d]">
          No chunks are available.{" "}
          {document.status === "failed"
            ? "Retry processing or replace the file."
            : "The extractor may have found no usable text, such as in a scanned PDF without a text layer."}
        </div>
      ) : (
        <section aria-labelledby="chunks-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="chunks-heading" className="text-[1.05rem]">
              Indexed chunks
            </h2>
            <p className="text-[0.72rem] text-[#74837a]">
              Showing {chunks.length} of {document.chunkCount} · page and heading are source metadata
            </p>
          </div>
          <div className="space-y-3">
            {chunks.map((chunk) => (
              <article key={chunk.id} className="card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-[#6b7a71]">
                    <span className="inline-flex items-center gap-1 font-mono text-[0.66rem]">
                      <FileText size={12} aria-hidden />
                      chunk {chunk.chunkIndex + 1}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{pageLabel(chunk.pageNumber)}</span>
                    {chunk.sectionHeading ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-medium text-[#3f5147]">{chunk.sectionHeading}</span>
                      </>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span>{chunk.charCount.toLocaleString("en-GB")} characters</span>
                  </div>
                  {chunk.citationCount > 0 ? (
                    <span className="badge badge-strong">
                      {chunk.citationCount} citation{chunk.citationCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="badge badge-neutral">Not yet cited</span>
                  )}
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-[#f7faf5] px-3 py-2.5">
                  <Quote size={13} className="mt-0.5 shrink-0 text-[#49806b]" aria-hidden />
                  <p className="text-[0.8rem] leading-relaxed text-[#46564d]">{chunk.excerpt}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
