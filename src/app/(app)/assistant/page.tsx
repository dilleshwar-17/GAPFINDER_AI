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

export const metadata: Metadata = { title: "Source assistant" };
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
        title="Source assistant"
        description="Ask about a topic in your own material. Retrieval runs only over your indexed chunks, every claim must resolve to a real citation, and the assistant abstains when the evidence is thin."
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
          description="The assistant answers only from your indexed sources. Create a subject, upload a syllabus or notes, then extract the topic map."
          action={
            <Link href="/subjects?intent=create" className="btn btn-primary btn-sm">
              Create a subject
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {subjects.map((subject) => (
              <Link
                key={subject.id}
                href={`/assistant?subject=${subject.id}`}
                className={
                  subject.id === selectedSubject?.id ? "badge badge-strong" : "badge badge-outline"
                }
              >
                {subject.name}
              </Link>
            ))}
          </div>

          {!selectedSubject ? null : topics.length === 0 ? (
            <EmptyState
              icon={<FolderTree size={18} aria-hidden />}
              title="No topics in this subject"
              description="The assistant needs a topic to scope retrieval. Extract topics from your syllabus headings or add them manually."
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
                  action={<FolderTree size={15} className="text-[#176b50]" aria-hidden />}
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
                              ? "border-[#176b50] bg-[#f2f9f4]"
                              : "border-transparent hover:border-[#dbe5da] hover:bg-[#fbfcf8]"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[0.8rem] font-medium text-[#34483c]">
                              {topic.name}
                            </span>
                            <span className="mt-0.5 block text-[0.64rem] text-[#85928a]">
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
                    <p className="mt-0.5 text-[0.74rem] text-[#7a877f]">
                      {selectedSubject.name}
                      {selectedTopic?.parentName ? ` · ${selectedTopic.parentName}` : ""}
                    </p>
                  </div>
                  <MessageSquareText size={17} className="text-[#176b50]" aria-hidden />
                </div>

                {!selectedTopic ? (
                  <p className="text-[0.84rem] text-[#68756d]">Select a topic from the list.</p>
                ) : (
                  <>
                    {selectedTopic.sourceCount === 0 ? (
                      <div className="mb-4">
                        <Callout tone="warning" title="No linked sources for this topic">
                          Retrieval may still find relevant chunks in this subject, but this topic has
                          no ranked source links. If the assistant abstains, upload material that covers
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
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eef1ea] pt-3">
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
