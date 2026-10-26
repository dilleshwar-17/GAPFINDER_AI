import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, FileStack, FolderTree } from "lucide-react";
import { pageNotFoundIfMissing, requirePageUser } from "@/lib/auth/page";
import { getSubjectOwned } from "@/lib/services/subjects";
import { listTopics } from "@/lib/services/topics";
import { formatDate } from "@/lib/http";
import { Badge, Breadcrumbs, Callout, PageHeader } from "@/components/ui";
import { TopicMap } from "@/components/topic-map";

export const metadata: Metadata = { title: "Topic map" };
export const dynamic = "force-dynamic";

export default async function TopicsPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const user = await requirePageUser();
  const { subjectId } = await params;

  let subject;
  let topics;
  try {
    subject = getSubjectOwned(user.id, subjectId);
    topics = listTopics(user.id, subjectId);
  } catch (error) {
    pageNotFoundIfMissing(error);
  }

  const assessed = topics.filter((topic) => topic.sufficient).length;
  const weak = topics.filter((topic) => topic.classification === "weak").length;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Subjects", href: "/subjects" },
          { label: subject.name, href: `/subjects/${subject.id}/topics` },
          { label: "Topic map" },
        ]}
      />

      <PageHeader
        eyebrow="Topic map"
        title={subject.name}
        description={
          subject.description ||
          "Topics are created from headings in your own material, so every topic keeps a route back to the page it came from."
        }
        meta={
          <>
            {subject.is_demo === 1 ? <Badge tone="demo">Seeded demo</Badge> : null}
            <span>{topics.length} topics</span>
            <span aria-hidden>·</span>
            <span>{assessed} with sufficient evidence</span>
            <span aria-hidden>·</span>
            <span>{weak} measured weak</span>
            {subject.exam_date ? (
              <>
                <span aria-hidden>·</span>
                <span>Exam {formatDate(subject.exam_date)}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href={`/materials?subject=${subject.id}`} className="btn btn-secondary btn-sm">
              <FileStack size={14} aria-hidden />
              Materials
            </Link>
            <Link
              href={`/diagnostics?subject=${subject.id}`}
              className="btn btn-primary btn-sm"
            >
              <ClipboardCheck size={14} aria-hidden />
              Start diagnostic
            </Link>
          </>
        }
      />

      {topics.length === 0 ? (
        <div className="mb-4">
          <Callout tone="info" title="How a topic map is built">
            Upload a syllabus with unit or chapter headings, then extract. Extraction is deterministic:
            it reads heading structure that is present in your indexed files and refuses to invent
            topics when the material does not contain them.
          </Callout>
        </div>
      ) : null}

      <TopicMap
        subjectId={subject.id}
        isDemo={user.isDemo}
        topics={topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          description: topic.description,
          parentId: topic.parentId,
          parentName: topic.parentName,
          importance: topic.importance,
          sourceDocumentId: topic.sourceDocumentId,
          sourcePage: topic.sourcePage,
          childCount: topic.childCount,
          mastery: topic.mastery,
          classification: topic.classification,
          sufficient: topic.sufficient,
          evidenceAnswers: topic.evidenceAnswers,
          evidenceMarks: topic.evidenceMarks,
          questionCount: topic.questionCount,
          sourceCount: topic.sourceCount,
          lastAssessedAt: topic.lastAssessedAt,
        }))}
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <FolderTree size={15} className="text-[#176b50]" aria-hidden />
            <h2 className="text-[0.92rem]">Extraction is not generation</h2>
          </div>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-[#68756d]">
            Headings such as “Unit 1”, “Chapter 2” and “1.1 Cell membrane” become topics. If a heading
            is absent from the indexed text, no topic is created for it. You can add topics manually
            when your source has no heading structure.
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={15} className="text-[#176b50]" aria-hidden />
            <h2 className="text-[0.92rem]">What a diagnostic needs</h2>
          </div>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-[#68756d]">
            A diagnostic selects up to three leaf topics and asks up to three citation-validated
            questions per topic. If retrieval cannot find enough source text, that topic is skipped
            rather than filled with an unsupported question.
          </p>
        </div>
      </section>
    </>
  );
}
