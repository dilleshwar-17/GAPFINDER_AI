import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  MinusCircle,
  RotateCcw,
  Target,
} from "lucide-react";
import { pageNotFoundIfMissing, requirePageUser } from "@/lib/auth/page";
import { getQuizView } from "@/lib/services/assessment";
import { getGapReport } from "@/lib/services/gaps";
import { formatDateTime } from "@/lib/http";
import {
  Badge,
  Breadcrumbs,
  Callout,
  CitationList,
  MasteryBadge,
  Meter,
  PageHeader,
  ScoreDisplay,
  SectionHeading,
  SourceLinks,
  Stat,
} from "@/components/ui";
import type { CitationView } from "@/lib/domain/types";

export const metadata: Metadata = { title: "Diagnostic results" };
export const dynamic = "force-dynamic";

function correctnessBadge(correctness: "correct" | "partial" | "incorrect") {
  if (correctness === "correct") return <Badge tone="strong">Correct</Badge>;
  if (correctness === "partial") return <Badge tone="developing">Partial</Badge>;
  return <Badge tone="weak">Incorrect</Badge>;
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const user = await requirePageUser();
  const { assessmentId } = await params;

  let view;
  try {
    view = await getQuizView(user.id, assessmentId);
  } catch (error) {
    pageNotFoundIfMissing(error);
  }
  if (view.status !== "submitted") redirect(`/diagnostics/${view.attemptId}`);

  const report = await getGapReport(user.id, view.subjectId);
  const topicIds = [...new Set(view.questions.map((question) => question.topicId))];
  const measuredTopics = topicIds
    .map((topicId) => report.topics.find((topic) => topic.topicId === topicId))
    .filter((topic): topic is NonNullable<typeof topic> => Boolean(topic));
  const percentage =
    view.score === null || view.totalMarks === 0
      ? null
      : Math.round((view.score / view.totalMarks) * 100);
  const practiceOnly = user.isDemo && !view.isSeededDemo;

  if (!view.submittedAt) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Diagnostics", href: "/diagnostics" },
          { label: view.subjectName, href: `/diagnostics?subject=${view.subjectId}` },
          { label: "Results" },
        ]}
      />

      <PageHeader
        eyebrow="Diagnostic results"
        title={view.subjectName}
        description="Your answers, the source passages behind each question, and the mastery change the evidence supports."
        meta={
          <>
            <Badge tone="strong">Submitted</Badge>
            <span>Submitted {formatDateTime(view.submittedAt)}</span>
            {view.isSeededDemo ? <Badge tone="demo">Seeded demo attempt</Badge> : null}
          </>
        }
        actions={
          <>
            <Link
              href={`/diagnostics?subject=${view.subjectId}`}
              className="btn btn-secondary btn-sm"
            >
              <RotateCcw size={14} aria-hidden />
              Retake
            </Link>
            <Link href={`/reports/${view.subjectId}`} className="btn btn-primary btn-sm">
              <Target size={14} aria-hidden />
              Gap report
            </Link>
          </>
        }
      />

      {practiceOnly ? (
        <div className="mb-5">
          <Callout tone="gold" title="Practice attempt in the shared demo">
            This attempt is scored and saved for this browser session, but it deliberately does not
            overwrite the seeded mastery history or plan that every visitor sees. The measured topic
            values below are the shared seed values.
          </Callout>
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Score"
          value={<ScoreDisplay score={view.score} total={view.totalMarks} size="md" />}
          detail={percentage === null ? "No marks available" : `${percentage}% of available marks`}
        />
        <Stat label="Questions" value={view.questions.length} detail="Source-grounded items" />
        <Stat label="Topics assessed" value={measuredTopics.length} detail="Within this attempt" />
        <Stat
          label="Generator"
          value={view.generator === "mixed" ? "Mixed" : view.generator.replace(/-/g, " ")}
          detail={view.generator.includes("gemini") ? "Model with citation validation" : "Deterministic source-grounded fallback"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <SectionHeading
            title="Question review"
            description="Expected answers and rubrics are shown only now that the attempt is submitted."
            action={<span className="text-[0.72rem] text-[#667085]">{view.questions.length} items</span>}
          />

          {view.questions.map((question, index) => {
            const answer = question.answer;
            const chosen =
              question.type === "mcq" && answer?.selectedIndex !== null && answer?.selectedIndex !== undefined
                ? question.options[answer.selectedIndex] ?? `Option ${answer.selectedIndex + 1}`
                : null;
            const citations: CitationView[] = question.sources.map((source, sourceIndex) => ({
              chunkId: `${source.documentId}-${source.pageNumber ?? "na"}-${sourceIndex}`,
              documentId: source.documentId,
              documentTitle: source.documentTitle,
              pageNumber: source.pageNumber,
              sectionHeading: source.sectionHeading,
              excerpt: source.excerpt ?? "",
            }));

            return (
              <article key={question.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[0.67rem] text-[#667085]">
                    <span className="font-mono font-semibold text-[#344054]">
                      Q{String(index + 1).padStart(2, "0")}
                    </span>
                    <Badge tone="outline">{question.topicName}</Badge>
                    <span className="badge badge-neutral">{question.difficulty}</span>
                    {answer ? correctnessBadge(answer.correctness) : null}
                  </div>
                  {answer ? (
                    <span className="font-mono text-[0.72rem] text-[#344054]">
                      {Math.round(answer.score * 10) / 10} / {answer.maxMarks}
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-3 whitespace-pre-line text-[0.96rem] leading-relaxed text-[#1d2939]">
                  {question.prompt}
                </h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#eaecf0] bg-[#fcfcfd] px-3 py-2.5">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-[#667085]">
                      Your answer
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[0.81rem] leading-relaxed text-[#475467]">
                      {question.type === "mcq"
                        ? chosen ?? "No option selected"
                        : answer?.answerText?.trim() || "Skipped"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#d9d6fe] bg-[#f4f3ff] px-3 py-2.5">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-[#344054]">
                      Source-grounded expected answer
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[0.81rem] leading-relaxed text-[#475467]">
                      {answer?.expectedAnswer ?? "Not available"}
                    </p>
                  </div>
                </div>

                {answer ? (
                  <div className="mt-3">
                    <p className="text-[0.8rem] leading-relaxed text-[#475467]">{answer.feedback}</p>
                    <p className="mt-1 font-mono text-[0.63rem] uppercase tracking-[0.07em] text-[#98a2b3]">
                      Method: {answer.evaluationMethod}
                    </p>
                    {answer.rubric.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {answer.rubric.map((concept) => (
                          <span
                            key={`${question.id}-rubric-${concept}`}
                            className={
                              answer.matchedConcepts.includes(concept)
                                ? "badge badge-strong"
                                : answer.missingConcepts.includes(concept)
                                  ? "badge badge-weak"
                                  : "badge badge-outline"
                            }
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {answer.matchedConcepts.length > 0 ? (
                      <p className="mt-2 inline-flex items-start gap-1.5 text-[0.72rem] text-[#027a48]">
                        <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden />
                        Matched: {answer.matchedConcepts.join(", ")}
                      </p>
                    ) : null}
                    {answer.missingConcepts.length > 0 ? (
                      <p className="mt-1 inline-flex items-start gap-1.5 text-[0.72rem] text-[#b42318]">
                        <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
                        Missing: {answer.missingConcepts.join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {citations.length > 0 ? (
                  <div className="mt-4 border-t border-[#f2f4f7] pt-3">
                    <CitationList citations={citations} title="Evidence used" />
                    <div className="mt-2">
                      <SourceLinks citations={citations} />
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[1rem]">Measured topics</h2>
              <Target size={16} className="text-[#7a5af8]" aria-hidden />
            </div>
            {measuredTopics.length === 0 ? (
              <p className="text-[0.8rem] leading-relaxed text-[#667085]">
                No mastery figure is available for these topics yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {measuredTopics.map((topic) => (
                  <li key={topic.topicId}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/learn/${topic.topicId}`}
                        className="text-[0.82rem] font-medium text-[#344054] hover:text-[#7a5af8]"
                      >
                        {topic.name}
                      </Link>
                      <MasteryBadge classification={topic.classification} sufficient={topic.sufficient} />
                    </div>
                    <Meter
                      value={topic.mastery}
                      classification={topic.classification}
                      label={`${topic.name} mastery`}
                    />
                    <p className="mt-1 text-[0.68rem] text-[#667085]">
                      {topic.sufficient ? (
                        <>
                          {topic.mastery === null ? "—" : `${Math.round(topic.mastery)}%`} ·{" "}
                          {topic.evidenceAnswers} answers · {topic.evidenceMarks} marks
                          {topic.masteryChange === null
                            ? ""
                            : ` · ${topic.masteryChange >= 0 ? "+" : ""}${Math.round(topic.masteryChange)} pts`}
                        </>
                      ) : (
                        <>
                          Not assessed: needs at least 2 answers, 3 marks and 2 distinct questions.
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/reports/${view.subjectId}`}
              className="btn btn-secondary btn-sm mt-4 w-full justify-center"
            >
              Open full gap report
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <BookOpenCheck size={16} className="text-[#7a5af8]" aria-hidden />
              <h2 className="text-[0.95rem]">Next evidence step</h2>
            </div>
            <p className="mt-2 text-[0.79rem] leading-relaxed text-[#475467]">
              Read the cited passages for any topic marked weak or developing, then retake a short
              diagnostic. Mastery moves only when new answers add evidence.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href={`/revision-plan?subject=${view.subjectId}`}
                className="btn btn-primary btn-sm justify-center"
              >
                View revision plan
              </Link>
              <Link
                href={`/assistant?subject=${view.subjectId}${
                  measuredTopics[0] ? `&topic=${measuredTopics[0].topicId}` : ""
                }`}
                className="btn btn-ghost btn-sm justify-center"
              >
                Ask about the source
              </Link>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-[0.95rem]">What this score is not</h2>
            <ul className="mt-2 space-y-2 text-[0.77rem] leading-relaxed text-[#475467]">
              <li className="flex gap-2">
                <MinusCircle size={13} className="mt-0.5 shrink-0 text-[#dc6803]" aria-hidden />
                Not a predicted exam grade.
              </li>
              <li className="flex gap-2">
                <MinusCircle size={13} className="mt-0.5 shrink-0 text-[#dc6803]" aria-hidden />
                Not evidence for topics this attempt did not cover.
              </li>
              <li className="flex gap-2">
                <MinusCircle size={13} className="mt-0.5 shrink-0 text-[#dc6803]" aria-hidden />
                Not comparable across different question sets.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
