import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  History,
  Target,
} from "lucide-react";
import { requirePageUser, resolveSubjectId } from "@/lib/auth/page";
import { listSubjects } from "@/lib/services/subjects";
import { listTopics } from "@/lib/services/topics";
import { getActivePlan, listPlanHistory } from "@/lib/services/plans";
import { getPreferences } from "@/lib/services/preferences";
import { formatDate, formatDateTime } from "@/lib/http";
import {
  Badge,
  Callout,
  EmptyState,
  Meter,
  PageHeader,
  SectionHeading,
  Stat,
} from "@/components/ui";
import { PlanBuilder, TaskChecklist } from "@/components/plan-workspace";
import { SubjectFilter } from "@/components/subject-filter";

export const metadata: Metadata = { title: "Revision plan" };
export const dynamic = "force-dynamic";

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export default async function RevisionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const subjects = await listSubjects(user.id);
  const selectedSubjectId = (await resolveSubjectId(user, params.subject)) ?? subjects[0]?.id ?? null;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const preferences = await getPreferences(user.id);
  const plan = selectedSubject ? await getActivePlan(user.id, selectedSubject.id) : null;
  const history = selectedSubject ? await listPlanHistory(user.id, selectedSubject.id) : [];
  const leafTopics = selectedSubject
    ? (await listTopics(user.id, selectedSubject.id)).filter((topic) => topic.childCount === 0)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Plan"
        title="Revision plan"
        description="A time-bounded schedule built from measured weakness, syllabus importance and exam urgency. The server refuses to exceed the daily budget you declare."
        actions={
          selectedSubject ? (
            <>
              <Link
                href={`/reports/${selectedSubject.id}`}
                className="btn btn-secondary btn-sm"
              >
                <Target size={14} aria-hidden />
                Gap report
              </Link>
              <Link
                href={`/diagnostics?subject=${selectedSubject.id}`}
                className="btn btn-primary btn-sm"
              >
                <ClipboardCheck size={14} aria-hidden />
                Retest
              </Link>
            </>
          ) : null
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpenCheck size={18} aria-hidden />}
          title="No subject to plan"
          description="A revision plan belongs to one subject. Create a subject and upload material first."
          action={
            <Link href="/subjects?intent=create" className="btn btn-primary btn-sm">
              Create a subject
            </Link>
          }
        />
      ) : (
        <>
          <SubjectFilter
            basePath="/revision-plan"
            subjects={subjects}
            selectedId={selectedSubjectId}
          />

          {!selectedSubject ? null : (
            <>
              {plan ? (
                <>
                  <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat
                      label="Plan version"
                      value={`v${plan.version}`}
                      detail={`Created ${formatDate(plan.createdAt)}`}
                    />
                    <Stat
                      label="Horizon"
                      value={`${plan.horizonDays} day${plan.horizonDays === 1 ? "" : "s"}`}
                      detail={
                        plan.daysUntilExam === 0
                          ? "Exam date has passed"
                          : `${plan.daysUntilExam} day${plan.daysUntilExam === 1 ? "" : "s"} until exam`
                      }
                    />
                    <Stat
                      label="Scheduled"
                      value={`${plan.allocatedMinutes} min`}
                      detail={`${plan.pendingMinutes} min pending`}
                    />
                    <Stat
                      label="Completed"
                      value={`${plan.completedMinutes} min`}
                      detail={`${plan.tasks.filter((task) => task.status === "completed").length} of ${plan.tasks.length} tasks`}
                    />
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
                    <div className="space-y-5">
                      <section className="card p-5" aria-labelledby="tasks-heading">
                        <SectionHeading
                          title="Scheduled tasks"
                          description="Ordered by priority. Marking a task complete only changes this plan version; history is never rewritten."
                          action={
                            <Link
                              href={`/progress?subject=${selectedSubject.id}`}
                              className="text-[0.76rem] font-medium text-[#7a5af8] hover:underline"
                            >
                              Progress
                            </Link>
                          }
                        />
                        <div id="tasks-heading">
                          <TaskChecklist tasks={plan.tasks} isDemo={user.isReadOnlyDemo} />
                        </div>
                      </section>

                      <section className="card p-5">
                        <SectionHeading
                          title="Why these topics"
                          description="Priority components are exposed so you can inspect the recommendation rather than trust it blindly."
                        />
                        <div className="overflow-x-auto">
                          <table className="table">
                            <thead>
                              <tr>
                                <th scope="col">Topic</th>
                                <th scope="col">Mastery</th>
                                <th scope="col">Weak</th>
                                <th scope="col">Importance</th>
                                <th scope="col">Urgency</th>
                                <th scope="col">Priority</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.rationale.slice(0, 10).map((entry) => (
                                <tr key={entry.topicId}>
                                  <td>
                                    <Link
                                      href={`/learn/${entry.topicId}`}
                                      className="font-medium text-[#344054] hover:text-[#7a5af8]"
                                    >
                                      {entry.name}
                                    </Link>
                                    {entry.prerequisiteBoost > 0 ? (
                                      <span className="badge badge-developing ml-2">Prerequisite</span>
                                    ) : null}
                                  </td>
                                  <td>
                                    {entry.mastery === null ? (
                                      <span className="text-[#98a2b3]">Not assessed</span>
                                    ) : (
                                      `${Math.round(entry.mastery)}%`
                                    )}
                                  </td>
                                  <td className="font-mono text-[0.72rem]">{entry.weaknessComponent.toFixed(2)}</td>
                                  <td className="font-mono text-[0.72rem]">{entry.importanceComponent.toFixed(2)}</td>
                                  <td className="font-mono text-[0.72rem]">{entry.urgencyComponent.toFixed(2)}</td>
                                  <td className="font-mono text-[0.72rem] font-semibold">
                                    {Math.round(entry.priority * 10) / 10}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <PlanBuilder
                        subjectId={selectedSubject.id}
                        defaultExamDate={plan.examDate}
                        defaultMinutes={plan.minutesPerDay}
                        defaultSession={plan.sessionMinutes}
                        isDemo={user.isReadOnlyDemo}
                        hasActivePlan
                        assessableTopics={leafTopics.length}
                      />
                    </div>

                    <div className="space-y-4">
                      <section className="card p-5">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-[0.98rem]">Budget</h2>
                          <Clock3 size={16} className="text-[#7a5af8]" aria-hidden />
                        </div>
                        <p className="mt-2 text-[0.76rem] text-[#667085]">
                          {plan.minutesPerDay} minutes per day · {plan.sessionMinutes}-minute sessions
                        </p>
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-[0.7rem] text-[#667085]">
                            <span>Allocated</span>
                            <span className="font-mono">
                              {plan.allocatedMinutes} / {plan.capacityMinutes} min
                            </span>
                          </div>
                          <Meter
                            value={
                              plan.capacityMinutes === 0
                                ? 0
                                : Math.round((plan.allocatedMinutes / plan.capacityMinutes) * 100)
                            }
                            classification="developing"
                            label="Plan capacity used"
                          />
                        </div>
                        <dl className="mt-4 space-y-1.5 text-[0.74rem]">
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#667085]">Capacity</dt>
                            <dd className="text-[#344054]">{plan.capacityMinutes} min</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#667085]">Allocated</dt>
                            <dd className="text-[#344054]">{plan.allocatedMinutes} min</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#667085]">Exam</dt>
                            <dd className="text-[#344054]">{formatDate(plan.examDate)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#667085]">Trigger</dt>
                            <dd className="text-[#344054]">{plan.trigger.replace(/_/g, " ")}</dd>
                          </div>
                        </dl>
                      </section>

                      {plan.changeSummary.length > 0 ? (
                        <section className="card p-5">
                          <h2 className="text-[0.98rem]">What changed</h2>
                          <ul className="mt-2 space-y-1.5 text-[0.77rem] leading-relaxed text-[#475467]">
                            {plan.changeSummary.map((item) => (
                              <li key={item} className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#7a5af8]" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null}

                      <section className="card p-5">
                        <div className="flex items-center gap-2">
                          <History size={15} className="text-[#7a5af8]" aria-hidden />
                          <h2 className="text-[0.95rem]">Plan history</h2>
                        </div>
                        {history.length <= 1 ? (
                          <p className="mt-2 text-[0.77rem] leading-relaxed text-[#667085]">
                            This is the first plan version. Submitting a diagnostic versions it forward
                            while preserving completed tasks.
                          </p>
                        ) : (
                          <ul className="mt-2 divide-y divide-[#f2f4f7]">
                            {history.map((entry) => (
                              <li key={entry.id} className="py-2 first:pt-0 last:pb-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[0.78rem] font-medium text-[#344054]">
                                    v{entry.version}
                                  </span>
                                  {entry.status === "active" ? (
                                    <Badge tone="strong">Active</Badge>
                                  ) : (
                                    <Badge tone="neutral">Superseded</Badge>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[0.68rem] text-[#667085]">
                                  {formatDateTime(entry.createdAt)} · {entry.allocatedMinutes} min ·{" "}
                                  {entry.tasks.filter((task) => task.status === "completed").length} completed
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <section className="card p-5">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={15} className="text-[#7a5af8]" aria-hidden />
                          <h2 className="text-[0.95rem]">Plan rules</h2>
                        </div>
                        <ul className="mt-2 space-y-2 text-[0.75rem] leading-relaxed text-[#475467]">
                          <li>The horizon is capped at 14 days even when the exam is further away.</li>
                          <li>Maximum 12 tasks; each session is bounded to 20–90 minutes.</li>
                          <li>Completed tasks stay complete when the plan is regenerated.</li>
                          <li>
                            Not-assessed topics are not treated as zero mastery; they are scheduled only
                            as evidence-building work.
                          </li>
                        </ul>
                      </section>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                  <PlanBuilder
                    subjectId={selectedSubject.id}
                    defaultExamDate={
                      selectedSubject.exam_date ?? addDays(new Date().toISOString().slice(0, 10), 14)
                    }
                    defaultMinutes={preferences.minutesPerDay}
                    defaultSession={preferences.sessionMinutes}
                    isDemo={user.isReadOnlyDemo}
                    hasActivePlan={false}
                    assessableTopics={leafTopics.length}
                  />

                  <aside className="space-y-4">
                    <section className="card p-5">
                      <p className="eyebrow mb-2">Before a plan helps</p>
                      <ol className="space-y-2 text-[0.79rem] leading-relaxed text-[#475467]">
                        <li>1. Index at least one syllabus or notes file.</li>
                        <li>2. Build or extract the topic map.</li>
                        <li>3. Submit a short diagnostic so weakness has evidence.</li>
                        <li>4. Set a realistic daily budget, then build the plan.</li>
                      </ol>
                      <Link
                        href={`/subjects/${selectedSubject.id}/topics`}
                        className="btn btn-secondary btn-sm mt-3"
                      >
                        Topic map
                        <ArrowUpRight size={13} aria-hidden />
                      </Link>
                    </section>

                    <section className="card p-5">
                      <h2 className="text-[0.95rem]">What the planner uses</h2>
                      <p className="mt-2 text-[0.77rem] leading-relaxed text-[#475467]">
                        Only leaf topics are scheduled. Measured weakness is the largest component;
                        importance comes from the topic map and urgency from the remaining days. When an
                        explicit prerequisite is measured weak, a bounded boost changes the order.
                      </p>
                    </section>

                    {leafTopics.length === 0 ? (
                      <Callout tone="warning" title="No leaf topics yet">
                        A plan needs topics. Upload a syllabus and extract headings, or add topics
                        manually, then retest.
                      </Callout>
                    ) : null}
                  </aside>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
