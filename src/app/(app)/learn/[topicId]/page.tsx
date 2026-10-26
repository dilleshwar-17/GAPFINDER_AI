import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderTree,
  Layers,
  MessageSquareText,
  Target,
} from "lucide-react";
import { pageNotFoundIfMissing, requirePageUser } from "@/lib/auth/page";
import {
  getPrerequisites,
  getTopicContext,
  getTopicSources,
  listTopics,
  type TopicView,
} from "@/lib/services/topics";
import { getSubjectOwned } from "@/lib/services/subjects";
import { getGapReport, type GapTopic } from "@/lib/services/gaps";
import { getActivePlan } from "@/lib/services/plans";
import { formatDateTime } from "@/lib/http";
import {
  Badge,
  Breadcrumbs,
  Callout,
  CitationList,
  MasteryBadge,
  Meter,
  PageHeader,
  SectionHeading,
  SourceLinks,
  Stat,
} from "@/components/ui";
import { AssistantChat } from "@/components/assistant-chat";

export const metadata: Metadata = { title: "Learn a topic" };
export const dynamic = "force-dynamic";

function prerequisiteTone(classification: GapTopic["classification"]) {
  if (classification === "weak") return "weak" as const;
  if (classification === "developing") return "developing" as const;
  if (classification === "strong") return "strong" as const;
  return "neutral" as const;
}

export default async function LearnTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const user = await requirePageUser();
  const { topicId } = await params;

  let context;
  try {
    context = getTopicContext(user.id, topicId);
  } catch (error) {
    pageNotFoundIfMissing(error);
  }
  if (!context) notFound();

  const subjectId = context.topic.subject_id;
  let subject;
  let topics: TopicView[];
  try {
    subject = getSubjectOwned(user.id, subjectId);
    topics = listTopics(user.id, subjectId);
  } catch (error) {
    pageNotFoundIfMissing(error);
  }
  if (!subject || !topics) notFound();

  const topic = topics.find((entry) => entry.id === topicId);
  if (!topic) notFound();

  const sources = getTopicSources(user.id, topicId);
  const prerequisites = getPrerequisites(user.id, topicId);
  const subTopics = topics.filter((entry) => entry.parentId === topicId);
  const report = getGapReport(user.id, subjectId);
  const gapTopic: GapTopic | undefined = report.topics.find((entry) => entry.topicId === topicId);
  const plan = getActivePlan(user.id, subjectId);
  const planTasks = plan ? plan.tasks.filter((task) => task.topicId === topicId) : [];

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Subjects", href: "/subjects" },
          { label: subject.name, href: `/subjects/${subject.id}/topics` },
          { label: topic.name },
        ]}
      />

      <PageHeader
        eyebrow="Learn from source"
        title={topic.name}
        description={
          topic.description ??
          "Read the cited passages from your own material before you revise. BUDDY answers only from those passages."
        }
        meta={
          <>
            <MasteryBadge classification={topic.classification} sufficient={topic.sufficient} />
            {topic.parentName ? <span>under {topic.parentName}</span> : null}
            {subject.is_demo === 1 ? <Badge tone="demo">Seeded demo</Badge> : null}
            <span>{sources.length} linked source{sources.length === 1 ? "" : "s"}</span>
          </>
        }
        actions={
          <>
            <Link
              href={`/subjects/${subject.id}/topics`}
              className="btn btn-secondary btn-sm"
            >
              <FolderTree size={14} aria-hidden />
              Topic map
            </Link>
            <Link
              href={`/diagnostics?subject=${subject.id}&topic=${topic.id}`}
              className="btn btn-primary btn-sm"
            >
              <ClipboardCheck size={14} aria-hidden />
              Test this topic
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Measured mastery"
          value={topic.mastery === null ? "—" : `${Math.round(topic.mastery)}%`}
          detail={
            topic.sufficient
              ? `${topic.classification} band · difficulty-weighted`
              : "Not assessed: evidence minimum not met"
          }
        />
        <Stat
          label="Evidence"
          value={`${topic.evidenceAnswers} / ${topic.evidenceMarks}`}
          detail="Answers / marks counted"
        />
        <Stat
          label="Question bank"
          value={topic.questionCount}
          detail="Cached source-grounded items"
        />
        <Stat
          label="Last assessed"
          value={topic.lastAssessedAt ? formatDateTime(topic.lastAssessedAt).split(",")[0] : "Never"}
          detail={topic.lastAssessedAt ? formatDateTime(topic.lastAssessedAt) : "No diagnostic yet"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <section className="card p-5">
            <SectionHeading
              title="Where you stand"
              description="The band is applied only when the evidence minimum is met. A missing figure is missing evidence, not a zero."
            />
            <Meter
              value={topic.mastery}
              classification={topic.classification}
              label={`${topic.name} mastery`}
            />
            {gapTopic ? (
              <div className="mt-4 space-y-3">
                <p className="text-[0.84rem] leading-relaxed text-[#475467]">
                  {gapTopic.recommendedAction}
                </p>
                {gapTopic.missingConcepts.length > 0 ? (
                  <div>
                    <p className="eyebrow mb-1.5">Missing rubric concepts</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {gapTopic.missingConcepts.map((concept) => (
                        <li key={concept.concept} className="badge badge-weak">
                          {concept.concept}
                          {concept.count > 1 ? ` ×${concept.count}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[0.78rem] text-[#667085]">
                    No rubric concept has been recorded as missing for this topic.
                  </p>
                )}
                {gapTopic.recentEvidence.length > 0 ? (
                  <div>
                    <p className="eyebrow mb-1.5">Recent answers</p>
                    <ul className="space-y-1.5">
                      {gapTopic.recentEvidence.slice(0, 4).map((evidence) => (
                        <li
                          key={`${evidence.attemptId}-${evidence.questionId}`}
                          className="rounded-lg border border-[#f2f4f7] px-3 py-2 text-[0.76rem] text-[#475467]"
                        >
                          <span className="line-clamp-2">{evidence.prompt}</span>
                          <span className="mt-1 block font-mono text-[0.64rem] text-[#98a2b3]">
                            {evidence.score}/{evidence.maxMarks} marks · {evidence.correctness} ·{" "}
                            {evidence.difficulty}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[0.78rem] leading-relaxed text-[#667085]">
                This topic has no evidence rows yet. Take a short diagnostic to establish a measured
                baseline.
              </p>
            )}
          </section>

          <section className="card p-5" aria-labelledby="sources-heading">
            <SectionHeading
              title="Linked source passages"
              description="Each passage is a real chunk from an indexed document. Open the material to read the surrounding context."
              action={<span className="text-[0.72rem] text-[#667085]">{sources.length} chunks</span>}
            />
            <div id="sources-heading">
              {sources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#d0d5dd] bg-[#fcfcfd] p-4 text-[0.82rem] leading-relaxed text-[#667085]">
                  <p className="flex items-center gap-1.5 font-medium text-[#344054]">
                    <FileText size={14} aria-hidden />
                    No indexed source is linked to this topic yet
                  </p>
                  <p className="mt-1.5">
                    Upload material that covers this topic and extract the topic map again. Until then
                    BUDDY will refuse to answer rather than invent content.
                  </p>
                  <Link
                    href={`/materials/upload?subject=${subject.id}`}
                    className="btn btn-secondary btn-sm mt-2"
                  >
                    Upload material
                  </Link>
                </div>
              ) : (
                <>
                  <CitationList citations={sources} title="Passages" />
                  <div className="mt-3 border-t border-[#f2f4f7] pt-3">
                    <SourceLinks citations={sources} />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="card p-5" aria-labelledby="assistant-heading">
            <SectionHeading
              title="Ask BUDDY"
              description="Retrieval runs against this topic's material. Answers without enough evidence are refused, not filled in."
              action={
                <span className="inline-flex items-center gap-1 text-[0.7rem] text-[#667085]">
                  <MessageSquareText size={12} aria-hidden />
                  Grounded only
                </span>
              }
            />
            <div id="assistant-heading">
              <AssistantChat
                subjectId={subject.id}
                topicId={topic.id}
                topicName={topic.name}
                subjectName={subject.name}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {prerequisites.length > 0 ? (
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-[#7a5af8]" aria-hidden />
                <h2 className="text-[0.95rem]">Prerequisites</h2>
              </div>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-[#98a2b3]">
                Explicit syllabus dependencies. Revision order only; not a causal claim.
              </p>
              <ul className="mt-3 space-y-2.5">
                {prerequisites.map((prerequisite) => (
                  <li key={prerequisite.prerequisiteId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/learn/${prerequisite.prerequisiteId}`}
                        className="text-[0.82rem] font-medium text-[#344054] hover:text-[#7a5af8]"
                      >
                        {prerequisite.prerequisiteName}
                      </Link>
                      <Badge tone={prerequisiteTone(prerequisite.prerequisiteClassification)}>
                        {prerequisite.prerequisiteClassification === "not_assessed"
                          ? "Not assessed"
                          : prerequisite.prerequisiteClassification}
                      </Badge>
                    </div>
                    {prerequisite.evidence ? (
                      <p className="mt-0.5 text-[0.7rem] leading-relaxed text-[#667085]">
                        {prerequisite.evidence}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-[#7a5af8]" aria-hidden />
                <h2 className="text-[0.95rem]">Prerequisites</h2>
              </div>
              <p className="mt-2 text-[0.77rem] leading-relaxed text-[#667085]">
                No dependency has been recorded for this topic. The planner will treat it as
                independent rather than guessing an order.
              </p>
            </section>
          )}

          {subTopics.length > 0 ? (
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-[#7a5af8]" aria-hidden />
                <h2 className="text-[0.95rem]">Sub-topics</h2>
              </div>
              <ul className="mt-2 space-y-2">
                {subTopics.map((subTopic) => (
                  <li key={subTopic.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/learn/${subTopic.id}`}
                      className="text-[0.81rem] text-[#344054] hover:text-[#7a5af8]"
                    >
                      {subTopic.name}
                    </Link>
                    <MasteryBadge
                      classification={subTopic.classification}
                      sufficient={subTopic.sufficient}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {planTasks.length > 0 ? (
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <Clock3 size={15} className="text-[#7a5af8]" aria-hidden />
                <h2 className="text-[0.95rem]">In your revision plan</h2>
              </div>
              <ul className="mt-2 space-y-2.5">
                {planTasks.map((task) => (
                  <li key={task.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={task.status === "completed" ? "strong" : "outline"}>
                        {task.status === "completed" ? "Completed" : "Pending"}
                      </Badge>
                      <span className="font-mono text-[0.66rem] text-[#667085]">
                        {task.durationMinutes} min
                      </span>
                    </div>
                    <p className="mt-1 text-[0.78rem] leading-relaxed text-[#475467]">
                      {task.objective}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                href={`/revision-plan?subject=${subject.id}`}
                className="btn btn-secondary btn-sm mt-3"
              >
                Open plan
                <ArrowUpRight size={13} aria-hidden />
              </Link>
            </section>
          ) : (
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <Target size={15} className="text-[#7a5af8]" aria-hidden />
                <h2 className="text-[0.95rem]">Next step</h2>
              </div>
              <p className="mt-2 text-[0.77rem] leading-relaxed text-[#667085]">
                Read the cited passages, then check yourself with a short diagnostic. A plan only
                schedules topics that have topics and evidence to schedule.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href={`/diagnostics?subject=${subject.id}&topic=${topic.id}`}
                  className="btn btn-primary btn-sm justify-center"
                >
                  Test this topic
                </Link>
                <Link
                  href={`/reports/${subject.id}`}
                  className="btn btn-ghost btn-sm justify-center"
                >
                  See the subject report
                </Link>
              </div>
            </section>
          )}

          {topic.sourceDocumentId ? (
            <Callout tone="info" title="Topic provenance">
              This topic was extracted from{" "}
              <Link
                href={`/materials/${topic.sourceDocumentId}`}
                className="font-semibold underline underline-offset-2"
              >
                an indexed document
              </Link>
              {topic.sourcePage === null ? "" : ` at page ${topic.sourcePage}`}. Open it to confirm the
              scope of the topic.
            </Callout>
          ) : null}
        </div>
      </div>
    </>
  );
}
