import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { requirePageUser, resolveSubjectId } from "@/lib/auth/page";
import { listSubjects } from "@/lib/services/subjects";
import { getProgressOverview } from "@/lib/services/progress";
import { formatDate, formatDateTime } from "@/lib/http";
import {
  Badge,
  Callout,
  EmptyState,
  InlineMeterLegend,
  MasteryBadge,
  Meter,
  PageHeader,
  ScoreDisplay,
  SectionHeading,
  Sparkline,
  Stat,
  StatusBadge,
} from "@/components/ui";
import { SubjectFilter } from "@/components/subject-filter";

export const metadata: Metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const subjects = listSubjects(user.id);
  const selectedSubjectId = resolveSubjectId(user, params.subject) ?? subjects[0]?.id ?? null;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const overview = selectedSubject ? getProgressOverview(user.id, selectedSubject.id) : null;
  const percentages = overview
    ? overview.scoreSeries
        .map((point) => point.percentage)
        .filter((value): value is number => value !== null)
    : [];
  const latest = percentages.length > 0 ? percentages[percentages.length - 1] : null;
  const first = percentages.length > 0 ? percentages[0] : null;
  const delta = latest !== null && first !== null ? latest - first : null;

  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Evidence over time"
        description="Score history, mastery movement and plan completion for one subject. Only submitted diagnostics and real task changes appear here."
        actions={
          selectedSubject ? (
            <>
              <Link href={`/reports/${selectedSubject.id}`} className="btn btn-secondary btn-sm">
                <ChartNoAxesCombined size={14} aria-hidden />
                Gap report
              </Link>
              <Link
                href={`/diagnostics?subject=${selectedSubject.id}`}
                className="btn btn-primary btn-sm"
              >
                <ClipboardCheck size={14} aria-hidden />
                New diagnostic
              </Link>
            </>
          ) : null
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={18} aria-hidden />}
          title="No progress to show yet"
          description="Progress is derived from submitted diagnostics and plan task changes. Create a subject, index material and take a diagnostic."
          action={
            <Link href="/subjects?intent=create" className="btn btn-primary btn-sm">
              Create a subject
            </Link>
          }
        />
      ) : (
        <>
          <SubjectFilter
            basePath="/progress"
            subjects={subjects}
            selectedId={selectedSubjectId}
          />

          {!overview || !selectedSubject ? null : (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Submitted diagnostics"
                  value={overview.scoreSeries.length}
                  detail={`${overview.attempts.filter((attempt) => attempt.status === "in_progress").length} unfinished`}
                />
                <Stat
                  label="Latest score"
                  value={latest === null ? "—" : `${latest}%`}
                  detail={
                    delta === null
                      ? "Needs at least one scored attempt"
                      : `${delta >= 0 ? "+" : ""}${delta} points since first attempt`
                  }
                />
                <Stat
                  label="Plan tasks"
                  value={`${overview.taskStats.completed} / ${overview.taskStats.total}`}
                  detail={
                    overview.taskStats.planVersion === null
                      ? "No active plan"
                      : `Plan v${overview.taskStats.planVersion} · ${overview.taskStats.pendingMinutes} min pending`
                  }
                />
                <Stat
                  label="Not assessed"
                  value={overview.notAssessedCount}
                  detail="Leaf topics without a band"
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="space-y-5">
                  <section className="card p-5">
                    <SectionHeading
                      title="Score history"
                      description="Each point is one submitted attempt. Attempts with different question sets are not directly comparable."
                      action={
                        percentages.length >= 2 ? (
                          <Sparkline points={percentages} label="Score history" />
                        ) : null
                      }
                    />
                    {overview.scoreSeries.length === 0 ? (
                      <p className="text-[0.82rem] leading-relaxed text-[#667085]">
                        No submitted attempt yet.{" "}
                        <Link
                          href={`/diagnostics?subject=${selectedSubject.id}`}
                          className="font-medium text-[#7a5af8] hover:underline"
                        >
                          Prepare the first diagnostic
                        </Link>
                        .
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="table">
                          <thead>
                            <tr>
                              <th scope="col">Submitted</th>
                              <th scope="col">Score</th>
                              <th scope="col">Percentage</th>
                              <th scope="col">Source</th>
                              <th scope="col"><span className="sr-only">Open</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {overview.scoreSeries
                              .slice()
                              .reverse()
                              .map((point) => (
                                <tr key={point.attemptId}>
                                  <td className="text-[#667085]">
                                    {formatDateTime(point.submittedAt)}
                                  </td>
                                  <td>
                                    <ScoreDisplay
                                      score={point.score}
                                      total={point.totalMarks}
                                      size="sm"
                                    />
                                  </td>
                                  <td className="font-mono text-[0.76rem]">
                                    {point.percentage === null ? "—" : `${point.percentage}%`}
                                  </td>
                                  <td>
                                    {point.isSeededDemo ? (
                                      <Badge tone="demo">Seeded</Badge>
                                    ) : (
                                      <Badge tone="outline">Practice</Badge>
                                    )}
                                  </td>
                                  <td className="text-right">
                                    <Link
                                      href={`/diagnostics/${point.attemptId}/results`}
                                      className="inline-flex items-center gap-1 text-[0.74rem] font-medium text-[#7a5af8] hover:underline"
                                    >
                                      Results
                                      <ArrowUpRight size={12} aria-hidden />
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section className="card p-5">
                    <SectionHeading
                      title="Topic trends"
                      description="Mastery snapshots recorded when evidence produced a band. A flat line is stable evidence, not progress."
                    />
                    {overview.topicTrends.length === 0 ? (
                      <p className="text-[0.82rem] leading-relaxed text-[#667085]">
                        No topic has passed the evidence minimum yet, so there is no trend to plot.
                        Submit a diagnostic first.
                      </p>
                    ) : (
                      <ul className="divide-y divide-[#f2f4f7]">
                        {overview.topicTrends.map((trend) => {
                          const latestPoint = trend.points[trend.points.length - 1];
                          return (
                            <li
                              key={trend.topicId}
                              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    href={`/learn/${trend.topicId}`}
                                    className="text-[0.85rem] font-medium text-[#344054] hover:text-[#7a5af8]"
                                  >
                                    {trend.topicName}
                                  </Link>
                                  <MasteryBadge
                                    classification={latestPoint.classification}
                                    sufficient
                                  />
                                  {trend.change === null ? (
                                    <span className="inline-flex items-center gap-1 text-[0.68rem] text-[#98a2b3]">
                                      <Minus size={11} aria-hidden />
                                      one snapshot
                                    </span>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center gap-1 text-[0.68rem] ${
                                        trend.change >= 0 ? "text-[#027a48]" : "text-[#b42318]"
                                      }`}
                                    >
                                      {trend.change >= 0 ? (
                                        <TrendingUp size={11} aria-hidden />
                                      ) : (
                                        <TrendingDown size={11} aria-hidden />
                                      )}
                                      {trend.change >= 0 ? "+" : ""}
                                      {Math.round(trend.change)} pts
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1.5 max-w-md">
                                  <Meter
                                    value={latestPoint.mastery}
                                    classification={latestPoint.classification}
                                    label={`${trend.topicName} mastery`}
                                  />
                                </div>
                                <p className="mt-1 text-[0.67rem] text-[#98a2b3]">
                                  {trend.points.length} snapshot
                                  {trend.points.length === 1 ? "" : "s"} · latest{" "}
                                  {formatDate(latestPoint.createdAt)}
                                </p>
                              </div>
                              {trend.points.length >= 2 ? (
                                <Sparkline
                                  points={trend.points.map((point) => point.mastery)}
                                  label={`${trend.topicName} mastery trend`}
                                />
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="mt-4 border-t border-[#eaecf0] pt-3">
                      <InlineMeterLegend />
                    </div>
                  </section>
                </div>

                <div className="space-y-4">
                  <section className="card p-5">
                    <div className="flex items-center gap-2">
                      <Clock3 size={15} className="text-[#7a5af8]" aria-hidden />
                      <h2 className="text-[0.95rem]">Plan completion</h2>
                    </div>
                    {overview.taskStats.planVersion === null ? (
                      <p className="mt-2 text-[0.78rem] leading-relaxed text-[#667085]">
                        No active plan.{" "}
                        <Link
                          href={`/revision-plan?subject=${selectedSubject.id}`}
                          className="font-medium text-[#7a5af8] hover:underline"
                        >
                          Build one
                        </Link>{" "}
                        after a diagnostic establishes evidence.
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-[0.78rem] text-[#667085]">
                          Plan v{overview.taskStats.planVersion}: {overview.taskStats.completed} of{" "}
                          {overview.taskStats.total} tasks completed.
                        </p>
                        <div className="mt-3">
                          <Meter
                            value={
                              overview.taskStats.total === 0
                                ? 0
                                : Math.round(
                                    (overview.taskStats.completed / overview.taskStats.total) * 100,
                                  )
                            }
                            classification="strong"
                            label="Plan completion"
                          />
                        </div>
                        <dl className="mt-3 space-y-1.5 text-[0.74rem]">
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#667085]">Pending tasks</dt>
                            <dd className="text-[#344054]">{overview.taskStats.pending}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#667085]">Pending minutes</dt>
                            <dd className="text-[#344054]">{overview.taskStats.pendingMinutes}</dd>
                          </div>
                        </dl>
                        <Link
                          href={`/revision-plan?subject=${selectedSubject.id}`}
                          className="btn btn-secondary btn-sm mt-3 w-full justify-center"
                        >
                          Open plan
                        </Link>
                      </>
                    )}
                  </section>

                  <section className="card p-5">
                    <div className="flex items-center gap-2">
                      <ChartNoAxesCombined size={15} className="text-[#7a5af8]" aria-hidden />
                      <h2 className="text-[0.95rem]">Latest mastery changes</h2>
                    </div>
                    {overview.masteryChanges.length === 0 ? (
                      <p className="mt-2 text-[0.77rem] leading-relaxed text-[#667085]">
                        A change needs two mastery snapshots for the same topic. Take another diagnostic
                        on a measured topic.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2.5">
                        {overview.masteryChanges.map((change) => (
                          <li key={change.topicId}>
                            <div className="flex items-baseline justify-between gap-2">
                              <Link
                                href={`/learn/${change.topicId}`}
                                className="truncate text-[0.79rem] font-medium text-[#344054] hover:text-[#7a5af8]"
                              >
                                {change.topicName}
                              </Link>
                              <span
                                className={`shrink-0 font-mono text-[0.68rem] ${
                                  change.change >= 0 ? "text-[#027a48]" : "text-[#b42318]"
                                }`}
                              >
                                {change.change >= 0 ? "+" : ""}
                                {Math.round(change.change)} pts
                              </span>
                            </div>
                            <p className="mt-0.5 text-[0.66rem] text-[#98a2b3]">
                              {Math.round(change.previous)}% → {Math.round(change.next)}%
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="card p-5">
                    <h2 className="text-[0.95rem]">Attempt history</h2>
                    {overview.attempts.length === 0 ? (
                      <p className="mt-2 text-[0.77rem] leading-relaxed text-[#667085]">
                        No attempts recorded for this subject.
                      </p>
                    ) : (
                      <ul className="mt-2 divide-y divide-[#f2f4f7]">
                        {overview.attempts.slice(0, 8).map((attempt) => (
                          <li key={attempt.id} className="py-2 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[0.74rem] text-[#344054]">
                                {formatDate(attempt.submittedAt ?? attempt.startedAt)}
                              </span>
                              <StatusBadge status={attempt.status} />
                            </div>
                            <p className="mt-0.5 text-[0.66rem] text-[#98a2b3]">
                              {attempt.questionCount} questions ·{" "}
                              {attempt.status === "submitted" ? (
                                <Link
                                  href={`/diagnostics/${attempt.id}/results`}
                                  className="text-[#7a5af8] hover:underline"
                                >
                                  results
                                </Link>
                              ) : (
                                <Link
                                  href={`/diagnostics/${attempt.id}`}
                                  className="text-[#7a5af8] hover:underline"
                                >
                                  resume
                                </Link>
                              )}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <Callout tone="info" title="How to read progress">
                    Scores come from different question sets, so compare the same topic over time rather
                    than adding percentages together. Not-assessed topics are excluded from every
                    average.
                  </Callout>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
