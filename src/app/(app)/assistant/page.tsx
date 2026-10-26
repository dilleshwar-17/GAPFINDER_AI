import type { Metadata } from "next";
import Link from "next/link";
import {
  FileSearch,
  FolderTree,
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { pageNotFoundIfMissing, requirePageUser, resolveSubjectId } from "@/lib/auth/page";
import { listSubjects } from "@/lib/services/subjects";
import { listTopics, type TopicView } from "@/lib/services/topics";
import {
  Callout,
  EmptyState,
  MasteryBadge,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { AssistantChat } from "@/components/assistant-chat";
import { SubjectFilter } from "@/components/subject-filter";

export const metadata: Metadata = { title: "BUDDY" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string | string[];
    topic?: string | string[];
    q?: string | string[];
  }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const subjects = listSubjects(user.id);
  const requestedSubjectId = resolveSubjectId(user, params.subject) ?? subjects[0]?.id ?? null;
  const selectedSubject = subjects.find((subject) => subject.id === requestedSubjectId) ?? null;

  let topics: TopicView[] = [];
  if (selectedSubject) {
    try {
      topics = listTopics(user.id, selectedSubject.id);
    } catch (error) {
      pageNotFoundIfMissing(error);
    }
  }

  const requestedTopicId = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const selectedTopic =
    topics.find((topic) => topic.id === requestedTopicId) ??
    topics.find((topic) => topic.childCount === 0) ??
    topics[0] ??
    null;
  const initialQuestion = Array.isArray(params.q) ? params.q[0] : params.q;
  const sourceCount = topics.reduce((sum, topic) => sum + topic.sourceCount, 0);

  return (
    <>
      <PageHeader
        eyebrow="Learn"
        title="BUDDY"
        description="Your source-grounded study buddy. Ask about a topic in your own material: retrieval runs only over your indexed chunks, every claim must resolve to a real citation, and BUDDY abstains when the evidence is thin. Type, dictate, or listen."
        meta={
          <>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={12} aria-hidden />
              Grounded answers only
            </span>
            {selectedSubject ? (
              <>
                <span aria-hidden>·</span>
                <span>{sourceCount} linked source chunks</span>
              </>
            ) : null}
          </>
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={18} aria-hidden />}
          title="No material to ask about"
          description="BUDDY answers only from your indexed sources. Create a subject, upload a syllabus or notes, then extract the topic map."
          action={
            <Link href="/subjects?intent=create" className="btn btn-primary btn-sm">
              Create a subject
            </Link>
          }
        />
      ) : (
        <>
          <SubjectFilter
            basePath="/assistant"
            subjects={subjects}
            selectedId={selectedSubject?.id ?? null}
            className="mb-4"
          />

          {!selectedSubject ? null : topics.length === 0 ? (
            <EmptyState
              icon={<FolderTree size={18} aria-hidden />}
              title="No topics in this subject"
              description="BUDDY needs a topic to scope retrieval. Extract topics from your syllabus headings or add them manually."
              action={
                <Link
                  href={`/subjects/${selectedSubject.id}/topics`}
                  className="btn btn-primary btn-sm"
                >
                  Build topic map
                </Link>
              }
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[0.32fr_0.68fr]">
              <section className="card h-fit p-4" aria-labelledby="assistant-topic-list">
                <SectionHeading
                  title="Topics"
                  description="Pick the topic to scope retrieval."
                  action={<FolderTree size={15} className="text-[#7a5af8]" aria-hidden />}
                />
                <ul id="assistant-topic-list" className="space-y-1">
                  {topics.map((topic) => {
                    const active = topic.id === selectedTopic?.id;
                    return (
                      <li key={topic.id}>
                        <Link
                          href={`/assistant?subject=${selectedSubject.id}&topic=${topic.id}`}
                          className={`flex items-start justify-between gap-2 rounded-lg border px-2.5 py-2 transition ${
                            active
                              ? "border-[#7a5af8] bg-[#f4f3ff]"
                              : "border-transparent hover:border-[#d0d5dd] hover:bg-[#fcfcfd]"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[0.8rem] font-medium text-[#344054]">
                              {topic.name}
                            </span>
                            <span className="mt-0.5 block text-[0.64rem] text-[#98a2b3]">
                              {topic.sourceCount} source{topic.sourceCount === 1 ? "" : "s"} ·{" "}
                              {topic.childCount > 0 ? `${topic.childCount} sub-topics` : "leaf topic"}
                            </span>
                          </span>
                          <span className="mt-0.5 shrink-0">
                            <MasteryBadge
                              classification={topic.classification}
                              sufficient={topic.sufficient}
                            />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="card p-5" aria-labelledby="assistant-panel">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 id="assistant-panel" className="text-[1.05rem]">
                      {selectedTopic ? selectedTopic.name : "Choose a topic"}
                    </h2>
                    <p className="mt-0.5 text-[0.74rem] text-[#667085]">
                      {selectedSubject.name}
                      {selectedTopic?.parentName ? ` · ${selectedTopic.parentName}` : ""}
                    </p>
                  </div>
                  <MessageSquareText size={17} className="text-[#7a5af8]" aria-hidden />
                </div>

                {!selectedTopic ? (
                  <p className="text-[0.84rem] text-[#667085]">Select a topic from the list.</p>
                ) : (
                  <>
                    {selectedTopic.sourceCount === 0 ? (
                      <div className="mb-4">
                        <Callout tone="warning" title="No linked sources for this topic">
                          Retrieval may still find relevant chunks in this subject, but this topic has
                          no ranked source links. If BUDDY abstains, upload material that covers
                          it.
                        </Callout>
                      </div>
                    ) : null}
                    <AssistantChat
                      subjectId={selectedSubject.id}
                      topicId={selectedTopic.id}
                      topicName={selectedTopic.name}
                      subjectName={selectedSubject.name}
                      initialQuestion={initialQuestion}
                    />
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#f2f4f7] pt-3">
                      <Link
                        href={`/learn/${selectedTopic.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        <FileSearch size={13} aria-hidden />
                        Read linked passages
                      </Link>
                      <Link
                        href={`/diagnostics?subject=${selectedSubject.id}&topic=${selectedTopic.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        Test this topic
                      </Link>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
