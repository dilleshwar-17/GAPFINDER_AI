import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  ClipboardCheck,
  Clock3,
  FileStack,
  GraduationCap,
  Plus,
  Target,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth/page";
import { getDashboard } from "@/lib/services/progress";
import { formatDate } from "@/lib/http";
import {
  EmptyState,
  InlineMeterLegend,
  MasteryBadge,
  Meter,
  PageHeader,
  ScoreDisplay,
  SectionHeading,
  Stat,
} from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const dashboard = await getDashboard(user.id);
  const { totals, nextAction } = dashboard;

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={`Welcome back, ${user.displayName.split(" ")[0]}.`}
        description="Your next evidence-backed step, the gaps currently measured, and the work already queued."
        actions={
          <>
            <Link href="/subjects?intent=create" className="btn btn-secondary btn-sm">
              <Plus size={14} aria-hidden />
              New subject
            </Link>
            <Link href="/diagnostics" className="btn btn-primary btn-sm">
              <ClipboardCheck size={14} aria-hidden />
              Start diagnostic
            </Link>
          </>
        }
      />

      <section className="card-forest relative mb-6 overflow-hidden p-6">
        <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-[#7a5af8]/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="eyebrow text-[#9b8afb]">Recommended next action</p>
            <h2 className="mt-2 text-[1.45rem] text-[#ffffff]">{nextAction.label}</h2>
            <p className="mt-2 text-[0.86rem] leading-relaxed text-[#bdb4fe]">{nextAction.detail}</p>
          </div>
          <Link href={nextAction.href} className="btn btn-gold btn-lg">
            {nextAction.label}
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Subjects"
          value={totals.subjects}
          detail={`${totals.readyDocuments} indexed source${totals.readyDocuments === 1 ? "" : "s"}`}
          href="/subjects"
        />
        <Stat
          label="Assessed topics"
          value={totals.assessedTopics}
          detail={`${totals.weakTopics} measured weak`}
          href="/reports"
        />
        <Stat
          label="Submitted diagnostics"
          value={totals.submittedAttempts}
          detail="Source-grounded attempts"
          href="/diagnostics"
        />
        <Stat
          label="Open tasks"
          value={totals.pendingTasks}
          detail="Across active plans"
          href="/revision-plan"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <section>
            <SectionHeading
              title="Your subjects"
              description="Each subject keeps its own sources, topic map and evidence history."
              action={
                <Link href="/subjects" className="text-[0.76rem] font-medium text-[#7a5af8] hover:underline">
                  View all
                </Link>
              }
            />
            {dashboard.subjects.length === 0 ? (
              <EmptyState
                icon={<GraduationCap size={18} aria-hidden />}
                title="No subjects yet"
                description="Create a subject, then upload a syllabus and notes. Nothing is diagnosed until there is evidence."
                action={
                  <Link href="/subjects?intent=create" className="btn btn-primary btn-sm">
                    Create a subject
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {dashboard.subjects.slice(0, 4).map((subject) => (
                  <article key={subject.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/subjects/${subject.id}/topics`}
                          className="line-clamp-1 text-[0.94rem] font-semibold text-[#1a2231] hover:text-[#7a5af8]"
                        >
                          {subject.name}
                        </Link>
                        <p className="mt-0.5 text-[0.72rem] text-[#667085]">
                          {subject.exam_date ? `Exam ${formatDate(subject.exam_date)}` : "No exam date"}
                        </p>
                      </div>
                      {subject.is_demo === 1 ? (
                        <span className="badge badge-demo">Demo</span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-[#667085]">
                      <span>{subject.readyDocuments} sources</span>
                      <span>{subject.topicCount} topics</span>
                      <span>{subject.submittedAttempts} attempts</span>
                    </div>
                    <div className="mt-2.5 flex gap-1.5 text-[0.66rem]">
                      {subject.weakTopics > 0 ? <span className="badge badge-weak">{subject.weakTopics} weak</span> : null}
                      {subject.developingTopics > 0 ? (
                        <span className="badge badge-developing">{subject.developingTopics} developing</span>
                      ) : null}
                      {subject.strongTopics > 0 ? (
                        <span className="badge badge-strong">{subject.strongTopics} strong</span>
                      ) : null}
                      {subject.assessedTopics === 0 ? <span className="badge badge-neutral">Not assessed</span> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/subjects/${subject.id}/topics`} className="btn btn-secondary btn-sm">
                        Topic map
                      </Link>
                      <Link href={`/reports/${subject.id}`} className="btn btn-ghost btn-sm">
                        Gap report
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeading
              title="Recent diagnostics"
              description="The last submitted attempts, newest first."
              action={
                <Link href="/diagnostics" className="text-[0.76rem] font-medium text-[#7a5af8] hover:underline">
                  All diagnostics
                </Link>
              }
            />
            {dashboard.recentAttempts.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck size={18} aria-hidden />}
                title="No submitted attempts"
                description="A diagnostic needs indexed material and a topic with enough evidence. Start after uploading sources."
                action={
                  <Link href="/diagnostics" className="btn btn-primary btn-sm">
                    Open diagnostics
                  </Link>
                }
              />
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Subject</th>
                        <th scope="col">Submitted</th>
                        <th scope="col">Score</th>
                        <th scope="col"><span className="sr-only">Open</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentAttempts.map((attempt) => (
                        <tr key={attempt.id}>
                          <td>
                            <Link
                              href={`/diagnostics/${attempt.id}/results`}
                              className="font-medium text-[#344054] hover:text-[#7a5af8]"
                            >
                              {attempt.subjectName}
                            </Link>
                            {attempt.isSeededDemo ? (
                              <span className="badge badge-demo ml-2">Demo</span>
                            ) : null}
                          </td>
                          <td className="text-[#667085]">{formatDate(attempt.submittedAt)}</td>
                          <td>
                            <ScoreDisplay score={attempt.score} total={attempt.totalMarks} size="sm" />
                          </td>
                          <td className="text-right">
                            <Link
                              href={`/diagnostics/${attempt.id}/results`}
                              className="inline-flex items-center gap-1 text-[0.76rem] font-medium text-[#7a5af8] hover:underline"
                            >
                              Results
                              <ArrowUpRight size={13} aria-hidden />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[1rem]">Measured weak topics</h2>
              <Target size={16} className="text-[#d92d20]" aria-hidden />
            </div>
            {dashboard.weakTopics.length === 0 ? (
              <p className="text-[0.8rem] leading-relaxed text-[#667085]">
                No topic has passed the evidence minimum and landed in the weak band yet. Not assessed
                is not the same as weak.
              </p>
            ) : (
              <ul className="space-y-3.5">
                {dashboard.weakTopics.map((topic) => (
                  <li key={topic.topicId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <Link
                        href={`/learn/${topic.topicId}`}
                        className="truncate text-[0.82rem] font-medium text-[#344054] hover:text-[#7a5af8]"
                      >
                        {topic.name}
                      </Link>
                      <span className="shrink-0 font-mono text-[0.66rem] text-[#667085]">
                        {topic.mastery === null ? "—" : `${Math.round(topic.mastery)}%`}
                      </span>
                    </div>
                    <Meter value={topic.mastery} classification="weak" label={`${topic.name} mastery`} />
                    <p className="mt-1 text-[0.66rem] text-[#667085]">
                      {topic.evidenceAnswers} answers · {topic.subjectName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-[#eaecf0] pt-3">
              <InlineMeterLegend />
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[1rem]">Queued revision</h2>
              <Clock3 size={16} className="text-[#7a5af8]" aria-hidden />
            </div>
            {dashboard.pendingTasks.length === 0 ? (
              <p className="text-[0.8rem] leading-relaxed text-[#667085]">
                No active plan tasks. Generate a plan from an assessed subject once evidence exists.
              </p>
            ) : (
              <ul className="space-y-3">
                {dashboard.pendingTasks.map((task) => (
                  <li key={task.id} className="border-b border-[#f2f4f7] pb-2.5 last:border-0 last:pb-0">
                    <p className="text-[0.8rem] font-medium text-[#344054]">{task.topicName}</p>
                    <p className="mt-0.5 line-clamp-2 text-[0.73rem] leading-relaxed text-[#667085]">
                      {task.objective}
                    </p>
                    <p className="mt-1 font-mono text-[0.64rem] text-[#98a2b3]">
                      {task.durationMinutes} min · priority {Math.round(task.priority)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/revision-plan" className="btn btn-secondary btn-sm mt-4 w-full justify-center">
              <BookOpenCheck size={14} aria-hidden />
              Open revision plan
            </Link>
          </section>

          <section className="card p-5">
            <div className="flex items-start gap-2.5">
              <FileStack size={16} className="mt-0.5 shrink-0 text-[#7a5af8]" aria-hidden />
              <div>
                <h2 className="text-[0.92rem]">Grounding check</h2>
                <p className="mt-1 text-[0.76rem] leading-relaxed text-[#667085]">
                  Open any gap report and follow a citation before you revise. A mastery figure without
                  its source is not evidence.
                </p>
                <Link href="/materials" className="mt-2 inline-flex items-center gap-1 text-[0.76rem] font-medium text-[#7a5af8] hover:underline">
                  Review indexed material
                  <ArrowUpRight size={13} aria-hidden />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
