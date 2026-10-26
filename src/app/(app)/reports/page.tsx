import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ChartNoAxesCombined, GraduationCap, Target } from "lucide-react";
import { requirePageUser } from "@/lib/auth/page";
import { listSubjects } from "@/lib/services/subjects";
import { getGapReport } from "@/lib/services/gaps";
import { getActivePlan } from "@/lib/services/plans";
import {
  Badge,
  Callout,
  EmptyState,
  PageHeader,
  SectionHeading,
} from "@/components/ui";

export const metadata: Metadata = { title: "Gap reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requirePageUser();
  const subjects = await listSubjects(user.id);

  const cards = await Promise.all(subjects.map(async (subject) => {
    const [report, plan] = await Promise.all([
      getGapReport(user.id, subject.id),
      getActivePlan(user.id, subject.id),
    ]);
    return { subject, report, plan };
  }));

  return (
    <>
      <PageHeader
        eyebrow="Gap analysis"
        title="Gap reports"
        description="A report combines the latest evidence for each leaf topic into a single, inspectable view. Unmeasured topics are reported as not assessed, not as weak."
        actions={
          <Link href="/diagnostics" className="btn btn-primary btn-sm">
            <Target size={14} aria-hidden />
            Start diagnostic
          </Link>
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={18} aria-hidden />}
          title="No subjects to report on"
          description="Create a subject, index its material and submit a diagnostic. The report is built from saved answers and their cited sources."
          action={
            <Link href="/subjects?intent=create" className="btn btn-primary btn-sm">
              Create a subject
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5">
            <Callout tone="info" title="How to read a report">
              Mastery is a difficulty-weighted ratio of marks earned to marks available. The weak,
              developing and strong bands are provisional heuristics. A topic needs at least two answers,
              three marks and two distinct questions before any band is applied.
            </Callout>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {cards.map(({ subject, report, plan }) => {
              const summary = report.summary;
              return (
                <article key={subject.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-[1.05rem]">
                        <Link
                          href={`/reports/${subject.id}`}
                          className="hover:text-[#7a5af8]"
                        >
                          {subject.name}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-[0.72rem] text-[#667085]">
                        {summary.leaves} leaf topics · {summary.attemptsConsidered} submitted attempt
                        {summary.attemptsConsidered === 1 ? "" : "s"}
                      </p>
                    </div>
                    {subject.is_demo === 1 ? <Badge tone="demo">Seeded demo</Badge> : null}
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      ["Weak", summary.weak, "text-[#d92d20]"],
                      ["Developing", summary.developing, "text-[#b54708]"],
                      ["Strong", summary.strong, "text-[#027a48]"],
                      ["Not assessed", summary.notAssessed, "text-[#667085]"],
                    ].map(([label, value, tone]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg border border-[#eaecf0] bg-[#fcfcfd] px-2.5 py-2"
                      >
                        <p className="text-[0.57rem] uppercase tracking-[0.08em] text-[#667085]">
                          {label}
                        </p>
                        <p className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-[0.76rem] leading-relaxed text-[#667085]">
                    {summary.assessed === 0
                      ? "No topic has passed the evidence minimum yet. Submit a diagnostic to establish evidence."
                      : `${summary.assessed} of ${summary.leaves} leaf topics currently have sufficient evidence.`}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/reports/${subject.id}`} className="btn btn-primary btn-sm">
                      Open report
                    </Link>
                    <Link
                      href={`/revision-plan?subject=${subject.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      {plan ? `Plan v${plan.version}` : "Build plan"}
                    </Link>
                    <Link
                      href={`/subjects/${subject.id}/topics`}
                      className="btn btn-ghost btn-sm"
                    >
                      Topic map
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <Target size={15} className="text-[#7a5af8]" aria-hidden />
                <h2 className="text-[0.92rem]">Measured weakness only</h2>
              </div>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-[#667085]">
                The weak count excludes not-assessed topics. A topic you have never been tested on is a
                gap in evidence, not a confirmed weakness, and the planner treats it accordingly.
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <ChartNoAxesCombined size={15} className="text-[#7a5af8]" aria-hidden />
                <h2 className="text-[0.92rem]">Every report is traceable</h2>
              </div>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-[#667085]">
                Each topic links back to the questions, marks and source citations that produced its
                figure. Open the source before deciding what to revise.
              </p>
              <Link
                href="/progress"
                className="mt-2 inline-flex items-center gap-1 text-[0.76rem] font-medium text-[#7a5af8] hover:underline"
              >
                Compare attempts over time
                <ArrowUpRight size={13} aria-hidden />
              </Link>
            </div>
          </section>
        </>
      )}
    </>
  );
}
