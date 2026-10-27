import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/page";
import { listSubjects } from "@/lib/services/subjects";
import { PageHeader } from "@/components/ui";
import { SubjectManager } from "@/components/subject-manager";

export const metadata: Metadata = { title: "Subjects" };
export const dynamic = "force-dynamic";

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const subjects = await listSubjects(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Subjects"
        description="A subject contains its own sources, topic map, assessment evidence and revision history. Mastery never moves between subjects."
      />
      <SubjectManager
        isDemo={user.isReadOnlyDemo}
        initialCreate={params.intent === "create"}
        subjects={subjects.map((subject) => ({
          id: subject.id,
          name: subject.name,
          description: subject.description,
          examDate: subject.exam_date,
          isDemo: subject.is_demo === 1,
          readyDocuments: subject.readyDocuments,
          topicCount: subject.topicCount,
          submittedAttempts: subject.submittedAttempts,
          weakTopics: subject.weakTopics,
          developingTopics: subject.developingTopics,
          strongTopics: subject.strongTopics,
          assessedTopics: subject.assessedTopics,
        }))}
      />
    </>
  );
}
