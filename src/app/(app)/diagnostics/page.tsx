import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardCheck,
  Clock3,
  FileStack,
  FolderTree,
  GraduationCap,
} from "lucide-react";
import { requirePageUser, resolveSubjectId } from "@/lib/auth/page";
import { listSubjects } from "@/lib/services/subjects";
import { listLeafTopics } from "@/lib/services/topics";
import { listAllAttempts } from "@/lib/services/assessment";
import { formatDate, formatDateTime } from "@/lib/http";
import {
  Callout,
  EmptyState,
  PageHeader,
  ScoreDisplay,
  SectionHeading,
  StatusBadge,
} from "@/components/ui";
import { DiagnosticStarter } from "@/components/diagnostic-starter";
import { SubjectFilter } from "@/components/subject-filter";

export const metadata: Metadata = { title: "Diagnostics" };
export const dynamic = "force-dynamic";

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[]; topic?: string | string[] }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const subjects = listSubjects(user.id);
  const selectedSubjectId = resolveSubjectId(user, params.subject) ?? subjects[0]?.id ?? null;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const leafTopics = selectedSubject ? listLeafTopics(user.id, selectedSubject.id) : [];
  const attempts = listAllAttempts(user.id);
  const inProgress = attempts.filter((attempt) => attempt.status === "in_progress");
  const submitted = attempts.filter((attempt) => attempt.status === "submitted");
  const initialTopicId = Array.isArray(params.topic) ? params.topic[0] : params.topic;

  return (
    <>
      <PageHeader
        eyebrow="Diagnose"
        title="Diagnostics"
        description="A diagnostic is a short, source-grounded check. It measures only the topics you select, and it never reports mastery below the evidence minimum."
        actions={
          selectedSubject ? (
            <Link
              href={`/subjects/${selectedSubject.id}/topics`}
              className="btn btn-secondary btn-sm"
            >
              <FolderTree size={14} aria-hidden />
              Open topic map
            </Link>
          ) : null
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={18} aria-hidden />}
          title="Create a subject before you diagnose"
          description="A diagnostic belongs to a subject and draws on that subject's indexed material. Create a subject, upload a syllabus and notes, then return here."
          action={
            <Link href="/subjects?intent=create" className="btn btn-primary btn-sm">
              Create a subject
            </Link>
          }
        />
      ) : (
        <>
          <SubjectFilter
            basePath="/diagnostics"
            subjects={subjects}
            selectedId={selectedSubjectId}
          />

          {inProgress.length > 0 ? (
            <section className="mb-5">
              <Callout tone="warning" title="Unfinished attempts">
                <ul className="mt-1 space-y-1">
                  {inProgress.map((attempt) => (
                    <li key={attempt.id} className="flex flex-wrap items-center gap-2">
                      <span>
                        {attempt.subjectName} · started {formatDateTime(attempt.startedAt)} ·{" "}
                        {attempt.questionCount} question{attempt.questionCount === 1 ? "" : "s"}
                      </span>
                      <Link
                        href={`/diagnostics/${attempt.id}`}
                        className="font-semibold text-[#b54708] underline underline-offset-2"
                      >
                        Resume
                      </Link>
                    </li>
                  ))}
                </ul>
              </Callout>
            </section>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="card p-5 sm:p-6" aria-labelledby="diagnostic-starter-heading">
              <SectionHeading
                title="Prepare a diagnostic"
                level={2}
                description="Pick up to three leaf topics. Retrieval, generation and citation validation happen before the attempt exists."
              />
              {!selectedSubject ? (
                <p className="text-[0.84rem] text-[#667085]">Choose a subject above.</p>
              ) : leafTopics.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#d0d5dd] bg-[#fcfcfd] p-5">
                  <h3 className="text-[0.95rem]">No leaf topics in {selectedSubject.name}</h3>
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-[#667085]">
                    Diagnostics run on leaf topics. Extract a topic map from a syllabus or add topics
                    manually first.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/subjects/${selectedSubject.id}/topics`}
                      className="btn btn-primary btn-sm"
                    >
                      Build topic map
                    </Link>
                    <Link
                      href={`/materials/upload?subject=${selectedSubject.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      <FileStack size={13} aria-hidden />
                      Upload material
                    </Link>
                  </div>
                </div>
              ) : (
                <DiagnosticStarter
                  subjectId={selectedSubject.id}
                  subjectName={selectedSubject.name}
                  initialTopicId={initialTopicId}
                  isDemo={user.isDemo}
                  topics={leafTopics.map((topic) => ({
                    id: topic.id,
                    name: topic.name,
                    classification: topic.classification,
                    sufficient: topic.sufficient,
                    mastery: topic.mastery,
                    questionCount: topic.questionCount,
                    sourceCount: topic.sourceCount,
                  }))}
                />
              )}
            </section>

            <div className="space-y-5">
              <section className="card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[1rem]">How it works</h2>
                  <ClipboardCheck size={16} className="text-[#7a5af8]" aria-hidden />
                </div>
                <ol className="mt-3 space-y-3 text-[0.79rem] leading-relaxed text-[#475467]">
                  <li>
                    <strong className="text-[#344054]">1. Retrieve.</strong> Each selected topic is turned
                    into a query and matched against your ready chunks only.
                  </li>
                  <li>
                    <strong className="text-[#344054]">2. Generate and validate.</strong> Questions must
                    map every source label to a retrieved chunk ID. Invalid questions are discarded.
                  </li>
                  <li>
                    <strong className="text-[#344054]">3. Answer without a key.</strong> Expected answers
                    and rubrics are withheld until the attempt is submitted.
                  </li>
                  <li>
                    <strong className="text-[#344054]">4. Score and update evidence.</strong> Multiple
                    choice is exact; short answers use rubric concepts with a deterministic lexical
                    fallback. Mastery changes only if evidence is sufficient.
                  </li>
                </ol>
              </section>

              <section className="card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[1rem]">Submitted</h2>
                  <Clock3 size={16} className="text-[#7a5af8]" aria-hidden />
                </div>
                {submitted.length === 0 ? (
                  <p className="mt-2 text-[0.8rem] leading-relaxed text-[#667085]">
                    No submitted diagnostics yet. Your first one will create the evidence history used by
                    reports and plans.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-[#f2f4f7]">
                    {submitted.slice(0, 6).map((attempt) => (
                      <li key={attempt.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={`/diagnostics/${attempt.id}/results`}
                            className="text-[0.8rem] font-medium text-[#344054] hover:text-[#7a5af8]"
                          >
                            {attempt.subjectName}
                          </Link>
                          <StatusBadge status={attempt.status} />
                        </div>
                        <p className="mt-0.5 text-[0.69rem] text-[#667085]">
                          {formatDate(attempt.submittedAt)} · {attempt.questionCount} questions
                        </p>
                        <div className="mt-1">
                          <ScoreDisplay
                            score={attempt.score}
                            total={attempt.totalMarks}
                            size="sm"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/progress"
                  className="mt-3 inline-flex items-center gap-1 text-[0.76rem] font-medium text-[#7a5af8] hover:underline"
                >
                  View progress over time
                  <ArrowUpRight size={13} aria-hidden />
                </Link>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
