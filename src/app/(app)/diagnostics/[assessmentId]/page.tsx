import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { pageNotFoundIfMissing, requirePageUser } from "@/lib/auth/page";
import { getQuizView } from "@/lib/services/assessment";
import { formatDateTime } from "@/lib/http";
import { Badge, Breadcrumbs, Callout, PageHeader } from "@/components/ui";
import { QuizRunner } from "@/components/quiz-runner";

export const metadata: Metadata = { title: "Diagnostic" };
export const dynamic = "force-dynamic";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const user = await requirePageUser();
  const { assessmentId } = await params;

  let view;
  try {
    view = getQuizView(user.id, assessmentId);
  } catch (error) {
    pageNotFoundIfMissing(error);
  }

  if (view.status === "submitted") {
    redirect(`/diagnostics/${view.attemptId}/results`);
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Diagnostics", href: "/diagnostics" },
          { label: view.subjectName, href: `/diagnostics?subject=${view.subjectId}` },
          { label: "Attempt" },
        ]}
      />

      <PageHeader
        eyebrow="Diagnostic in progress"
        title={view.subjectName}
        description="Answer from your own understanding. The expected answer, rubric and scoring stay on the server until you submit."
        meta={
          <>
            <Badge tone="developing">In progress</Badge>
            <span>{view.questions.length} questions</span>
            <span aria-hidden>·</span>
            <span>{view.totalMarks} marks</span>
            <span aria-hidden>·</span>
            <span>Started {formatDateTime(view.startedAt)}</span>
            {view.generator.startsWith("demo-seed") ? <Badge tone="demo">Seeded demo</Badge> : null}
          </>
        }
        actions={
          <Link href="/diagnostics" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} aria-hidden />
            All diagnostics
          </Link>
        }
      />

      <div className="mb-5">
        <Callout tone="info" title="Evidence rules">
          <span className="inline-flex items-start gap-1.5">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Questions were generated only from retrieved chunks of your indexed material. If a topic did
              not have enough evidence it was skipped before this attempt was created. Submitting requires
              an explicit answer or an intentional blank for every question.
            </span>
          </span>
        </Callout>
      </div>

      <QuizRunner view={view} />
    </>
  );
}
