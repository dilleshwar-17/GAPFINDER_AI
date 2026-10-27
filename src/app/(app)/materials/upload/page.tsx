import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requirePageUser, resolveSubjectId } from "@/lib/auth/page";
import { listSubjects } from "@/lib/services/subjects";
import { maxUploadBytes } from "@/lib/env";
import { PageHeader } from "@/components/ui";
import { UploadForm } from "@/components/upload-form";

export const metadata: Metadata = { title: "Upload material" };
export const dynamic = "force-dynamic";

export default async function UploadMaterialPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const subjects = await listSubjects(user.id);
  const selected = (await resolveSubjectId(user, params.subject)) ?? subjects[0]?.id ?? "";

  return (
    <>
      <Link href="/materials" className="mb-4 inline-flex items-center gap-1.5 text-[0.78rem] text-[#475467] hover:text-[#7a5af8]">
        <ArrowLeft size={13} aria-hidden />
        Materials
      </Link>
      <PageHeader
        eyebrow="Add evidence"
        title="Upload study material"
        description="The file is read on the server, split page by page, chunked with heading context and embedded. It only appears as indexed when every chunk has a vector."
      />
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <UploadForm
          subjects={subjects.map((subject) => ({
            id: subject.id,
            name: subject.name,
            documentCount: subject.readyDocuments,
          }))}
          initialSubjectId={selected}
          isDemo={user.isReadOnlyDemo}
          maxUploadMb={Math.round(maxUploadBytes() / (1024 * 1024))}
        />

        <aside className="space-y-4">
          <section className="card p-5">
            <p className="eyebrow mb-2">What makes a good source</p>
            <ul className="space-y-2.5 text-[0.79rem] leading-relaxed text-[#475467]">
              <li>
                <strong className="text-[#344054]">Syllabus with headings.</strong> The extractor looks
                for patterns such as “Unit 1”, “Chapter 2” and “1.1 Cell membrane”.
              </li>
              <li>
                <strong className="text-[#344054]">Notes that explain concepts.</strong> Questions are
                generated from sentences in the retrieved chunks, so definitions and processes work best.
              </li>
              <li>
                <strong className="text-[#344054]">Past papers for style.</strong> Past papers are evidence
                of question format, not a hidden answer key. Expected answers are never shipped to the
                quiz client before submission.
              </li>
            </ul>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#7a5af8]" aria-hidden />
              <h2 className="text-[0.92rem]">Handling and limits</h2>
            </div>
            <ul className="mt-2 space-y-2 text-[0.76rem] leading-relaxed text-[#475467]">
              <li>PDF, .txt and .md only. Duplicate content in one subject is rejected by SHA-256 hash.</li>
              <li>Up to 400 chunks per document. Split larger files instead of uploading one giant book.</li>
              <li>Extraction failures preserve the original file so processing can be retried.</li>
              <li>Scanned PDFs without a text layer cannot be indexed by this build.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
