import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  Gauge,
  Info,
  Layers,
  Target,
} from "lucide-react";
import { pageNotFoundIfMissing, requirePageUser } from "@/lib/auth/page";
import { getGapReport, type GapTopic } from "@/lib/services/gaps";
import { getSubjectOwned } from "@/lib/services/subjects";
import { getActivePlan } from "@/lib/services/plans";
import { formatDate, formatDateTime } from "@/lib/http";
import {
  Badge,
  Breadcrumbs,
  Callout,
  InlineMeterLegend,
  MasteryBadge,
  Meter,
  PageHeader,
  ScoreDisplay,
  SectionHeading,
  Stat,
} from "@/components/ui";
import type { TopicClassification } from "@/lib/domain/types";

export const metadata: Metadata = { title: "Gap report" };
export const dynamic = "force-dynamic";

const GROUP_ORDER: Array<{
  key: TopicClassification;
  title: string;
  description: string;
}> = [
  {
    key: "weak",
    title: "Measured weak",
    description: "At or below 49% difficulty-weighted marks, with enough evidence to report a band.",
  },
  {
    key: "developing",
    title: "Developing",
    description: "Between 50% and 79% weighted marks. The concepts are partly in place.",
  },
  {
    key: "strong",
    title: "Strong",
    description: "At or above 80% weighted marks. Keep the topic warm with short practice.",
  },
  {
    key: "not_assessed",
    title: "Not assessed",
    description: "Below the evidence minimum. This is missing evidence, not a measured weakness.",
  },
];

function confidenceBadge(confidence: GapTopic["confidence"]) {
  if (confidence === "moderate") return <Badge tone="strong">Moderate evidence</Badge>;
  if (confidence === "limited") return <Badge tone="outline">Limited evidence</Badge>;
  return <Badge tone="neutral">Insufficient evidence</Badge>;
}

function TopicCard({ topic }: { topic: GapTopic }) {
  return (
    <details className="group border-b border-[#f2f4f7] last:border-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 py-3.5 marker:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9rem] font-medium text-[#344054]">{topic.name}</span>
            <MasteryBadge classification={topic.classification} sufficient={topic.sufficient} />
            {confidenceBadge(topic.confidence)}
            {topic.parentName ? (
              <span className="text-[0.68rem] text-[#98a2b3]">under {topic.parentName}</span>
            ) : null}
          </div>
          <p className="mt-1 text-[0.73rem] text-[#667085]">
            {topic.sufficient && topic.mastery !== null ? (
              <>
                {Math.round(topic.mastery)}% weighted mastery ·{" "}
                {topic.masteryChange === null
                  ? "no earlier snapshot"
                  : `${topic.masteryChange >= 0 ? "+" : ""}${Math.round(topic.masteryChange)} pts since previous`}{" "}
                · {topic.evidenceAnswers} answers · {topic.evidenceMarks} marks
              </>
            ) : (
              <>
                Needs at least 2 answers, 3 marks and 2 distinct questions. Currently{" "}
                {topic.evidenceAnswers} answer{topic.evidenceAnswers === 1 ? "" : "s"} and{" "}
                {topic.evidenceMarks} marks.
              </>
            )}
          </p>
          <div className="mt-2 max-w-lg">
            <Meter
              value={topic.mastery}
              classification={topic.classification}
              label={`${topic.name} mastery`}
            />
          </div>
        </div>
        <span className="text-[0.68rem] font-medium text-[#7a5af8] group-open:hidden">Details</span>
        <span className="hidden text-[0.68rem] font-medium text-[#7a5af8] group-open:inline">Close</span>
      </summary>

      <div className="pb-4 pl-0 sm:pl-1">
        <p className="text-[0.8rem] leading-relaxed text-[#475467]">{topic.recommendedAction}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[#eaecf0] bg-[#fcfcfd] px-3 py-2.5">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#667085]">
              Evidence surface
            </p>
            <ul className="mt-1 space-y-0.5 text-[0.73rem] text-[#475467]">
              <li>{topic.questionCount} question{topic.questionCount === 1 ? "" : "s"} in the bank</li>
              <li>{topic.sourceCount} linked source chunk{topic.sourceCount === 1 ? "" : "s"}</li>
              <li>
                {topic.lastAssessedAt
                  ? `Last assessed ${formatDateTime(topic.lastAssessedAt)}`
                  : "Never assessed"}
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[#eaecf0] bg-[#fcfcfd] px-3 py-2.5">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#667085]">
              Missing concepts
            </p>
            {topic.missingConcepts.length === 0 ? (
              <p className="mt-1 text-[0.73rem] text-[#667085]">
                No rubric concept has been recorded as missing.
              </p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {topic.missingConcepts.map((concept) => (
                  <li key={concept.concept} className="badge badge-weak">
                    {concept.concept}
                    {concept.count > 1 ? ` ×${concept.count}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {topic.prerequisiteHypotheses.length > 0 ? (
          <div className="mt-3 rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2.5">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#b54708]">
              Prerequisite hypotheses
            </p>
            <ul className="mt-1 space-y-1 text-[0.74rem] leading-relaxed text-[#b54708]">
              {topic.prerequisiteHypotheses.map((hypothesis) => (
                <li key={hypothesis.prerequisiteName}>{hypothesis.message}</li>
              ))}
            </ul>
            <p className="mt-1 text-[0.66rem] text-[#b54708]">
              Explicit syllabus dependencies only. These are hypotheses for revision order, not causal
              claims.
            </p>
          </div>
        ) : null}

        {topic.recentEvidence.length > 0 ? (
          <div className="mt-3">
            <p className="eyebrow mb-1.5">Recent answers</p>
            <ul className="space-y-2">
              {topic.recentEvidence.map((evidence) => (
                <li
                  key={`${evidence.attemptId}-${evidence.questionId}`}
                  className="rounded-lg border border-[#f2f4f7] px-3 py-2"
                >
                  <p className="line-clamp-2 text-[0.76rem] leading-relaxed text-[#475467]">
                    {evidence.prompt}
                  </p>
                  <p className="mt-1 text-[0.67rem] text-[#667085]">
                    <ScoreDisplay score={evidence.score} total={evidence.maxMarks} size="sm" />
                    <span className="ml-2">
                      {evidence.correctness} · {evidence.difficulty} ·{" "}
                      {formatDate(evidence.submittedAt)}
                    </span>
                  </p>
                  {evidence.citation ? (
                    <p className="mt-1 text-[0.67rem] text-[#7a5af8]">
                      Source: {evidence.citation.documentTitle}
                      {evidence.citation.pageNumber === null
                        ? ""
                        : ` · page ${evidence.citation.pageNumber}`}
                      {evidence.citation.sectionHeading
                        ? ` · ${evidence.citation.sectionHeading}`
                        : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/learn/${topic.topicId}`} className="btn btn-secondary btn-sm">
            <BookOpen size={13} aria-hidden />
            Learn this topic
          </Link>
        </div>
      </div>
    </details>
  );
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const user = await requirePageUser();
  const { reportId } = await params;

  let subject;
  let report;
  let plan;
  try {
    subject = await getSubjectOwned(user.id, reportId);
    report = await getGapReport(user.id, reportId);
    plan = await getActivePlan(user.id, reportId);
  } catch (error) {
    pageNotFoundIfMissing(error);
  }

  if (!subject) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Gap reports", href: "/reports" },
          { label: subject.name, href: `/reports/${subject.id}` },
        ]}
      />

      <PageHeader
        eyebrow="Gap analysis"
        title={`${subject.name} — gap report`}
        description="Every value below is derived from saved answers and their validated source citations. The report is regenerated from evidence at request time."
        meta={
          <>
            {subject.is_demo === 1 ? <Badge tone="demo">Seeded demo</Badge> : null}
            <span>Generated {formatDateTime(report!.generatedAt)}</span>
            <span aria-hidden>·</span>
            <span>{report!.summary.attemptsConsidered} submitted attempts considered</span>
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
            <Link
              href={`/diagnostics?subject=${subject.id}`}
              className="btn btn-secondary btn-sm"
            >
              <ClipboardCheck size={14} aria-hidden />
              Retest
            </Link>
            <Link
              href={`/revision-plan?subject=${subject.id}`}
              className="btn btn-primary btn-sm"
            >
              <Target size={14} aria-hidden />
              {plan ? `Plan v${plan.version}` : "Build plan"}
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Leaf topics" value={report!.summary.leaves} detail="Assessable units" />
        <Stat label="Assessed" value={report!.summary.assessed} detail="Passed evidence minimum" />
        <Stat label="Weak" value={report!.summary.weak} detail="Measured, not inferred" />
        <Stat label="Developing" value={report!.summary.developing} detail="Partial understanding" />
        <Stat label="Strong" value={report!.summary.strong} detail="Keep warm" />
      </div>

      {report!.summary.notAssessed > 0 ? (
        <div className="mb-5">
          <Callout tone="info" title={`${report!.summary.notAssessed} leaf topics are not assessed`}>
            These topics have never met the evidence minimum. They are excluded from the weak count and
            from weakness-based planning. Take a diagnostic to establish evidence before allocating
            revision time.
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-5">
          {GROUP_ORDER.map((group) => {
            const topics = report!.topics.filter(
              (topic) => topic.classification === group.key,
            );
            if (topics.length === 0) return null;
            return (
              <section key={group.key} className="card p-5">
                <SectionHeading
                  title={`${group.title} · ${topics.length}`}
                  description={group.description}
                />
                {topics.map((topic) => (
                  <TopicCard key={topic.topicId} topic={topic} />
                ))}
              </section>
            );
          })}

          {report!.topics.length === 0 ? (
            <div className="card border-dashed bg-[#fcfcfd] p-6 text-[0.85rem] text-[#667085]">
              No leaf topics exist yet. Build a topic map from a syllabus, then submit a diagnostic.
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-[#7a5af8]" aria-hidden />
              <h2 className="text-[0.95rem]">Method</h2>
            </div>
            <dl className="mt-3 space-y-2 text-[0.76rem]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Version</dt>
                <dd className="font-mono text-[0.69rem] text-[#344054]">{report!.method.version}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Weak band</dt>
                <dd className="text-[#344054]">0–{report!.method.bands.weakMax}%</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Developing band</dt>
                <dd className="text-[#344054]">
                  {report!.method.bands.weakMax + 1}–{report!.method.bands.developingMax}%
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Strong band</dt>
                <dd className="text-[#344054]">{report!.method.bands.developingMax + 1}–100%</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Minimum answers</dt>
                <dd className="text-[#344054]">{report!.method.evidenceRules.minAnswers}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Minimum marks</dt>
                <dd className="text-[#344054]">{report!.method.evidenceRules.minMarks}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Distinct questions</dt>
                <dd className="text-[#344054]">{report!.method.evidenceRules.minDistinctQuestions}</dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-[#f2f4f7] pt-3">
              <InlineMeterLegend />
            </div>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-[#98a2b3]">
              Bands are provisional heuristics and have not been validated against an external
              educational standard.
            </p>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-[#7a5af8]" aria-hidden />
              <h2 className="text-[0.95rem]">Evidence confidence</h2>
            </div>
            <ul className="mt-2 space-y-2 text-[0.76rem] leading-relaxed text-[#475467]">
              <li>
                <strong className="text-[#344054]">Limited:</strong> the minimum is met, but there are
                fewer than four answers or eight marks.
              </li>
              <li>
                <strong className="text-[#344054]">Moderate:</strong> at least four answers and eight
                marks. Still a sample, not a full syllabus audit.
              </li>
              <li>
                <strong className="text-[#344054]">Insufficient:</strong> no band is applied. This is not
                a zero.
              </li>
            </ul>
          </section>

          <section className="card-forest p-5">
            <Info size={17} className="text-[#9b8afb]" aria-hidden />
            <h2 className="mt-2 text-[0.98rem] text-[#ffffff]">Check the source</h2>
            <p className="mt-1.5 text-[0.76rem] leading-relaxed text-[#bdb4fe]">
              A mastery figure is only as good as the evidence behind it. Open the indexed material and
              read the cited passage before you plan a revision block.
            </p>
            <Link
              href={`/materials?subject=${subject.id}`}
              className="btn btn-ghost btn-sm mt-3 text-[#a6f4c5] hover:bg-white/10"
            >
              Review sources
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
