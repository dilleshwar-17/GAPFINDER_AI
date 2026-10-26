"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileSearch,
  FolderTree,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";
import { Badge, MasteryBadge, Meter, SectionHeading } from "@/components/ui";
import type { TopicClassification } from "@/lib/domain/types";

export interface TopicMapItem {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  importance: number;
  sourceDocumentId: string | null;
  sourcePage: number | null;
  childCount: number;
  mastery: number | null;
  classification: TopicClassification;
  sufficient: boolean;
  evidenceAnswers: number;
  evidenceMarks: number;
  questionCount: number;
  sourceCount: number;
  lastAssessedAt: string | null;
}

function TopicRow({ topic, isDemo }: { topic: TopicMapItem; isDemo: boolean }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/learn/${topic.id}`}
            className="text-[0.9rem] font-medium text-[#344054] hover:text-[#7a5af8]"
          >
            {topic.name}
          </Link>
          <MasteryBadge classification={topic.classification} sufficient={topic.sufficient} />
          {topic.importance >= 0.8 ? <Badge tone="outline">High importance</Badge> : null}
          {topic.childCount > 0 ? (
            <span className="text-[0.66rem] text-[#98a2b3]">{topic.childCount} sub-topics</span>
          ) : null}
        </div>
        {topic.description ? (
          <p className="mt-1 max-w-2xl text-[0.76rem] leading-relaxed text-[#667085]">
            {topic.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-[#667085]">
          <span>{topic.questionCount} question{topic.questionCount === 1 ? "" : "s"} in bank</span>
          <span>{topic.sourceCount} linked source{topic.sourceCount === 1 ? "" : "s"}</span>
          {topic.evidenceAnswers > 0 ? (
            <span>
              {topic.evidenceAnswers} answer{topic.evidenceAnswers === 1 ? "" : "s"} ·{" "}
              {topic.evidenceMarks} marks of evidence
            </span>
          ) : (
            <span>No evidence yet</span>
          )}
          {topic.sourceDocumentId ? (
            <Link
              href={`/materials/${topic.sourceDocumentId}`}
              className="font-medium text-[#7a5af8] hover:underline"
            >
              Source
              {topic.sourcePage === null ? "" : ` · page ${topic.sourcePage}`}
            </Link>
          ) : null}
        </div>
        <div className="mt-2 max-w-md">
          <Meter
            value={topic.mastery}
            classification={topic.classification}
            label={`${topic.name} mastery`}
          />
        </div>
      </div>
      <Link href={`/learn/${topic.id}`} className="btn btn-ghost btn-sm shrink-0">
        <BookOpen size={13} aria-hidden />
        Learn
      </Link>
      {isDemo ? <span className="sr-only">Read-only demo topic</span> : null}
    </li>
  );
}

export function TopicMap({
  subjectId,
  topics,
  isDemo,
}: {
  subjectId: string;
  topics: TopicMapItem[];
  isDemo: boolean;
}) {
  const router = useRouter();
  const [extracting, setExtracting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const tree = useMemo(() => {
    const roots = topics.filter((topic) => !topic.parentId);
    const childrenByParent = new Map<string, TopicMapItem[]>();
    for (const topic of topics) {
      if (!topic.parentId) continue;
      const list = childrenByParent.get(topic.parentId) ?? [];
      list.push(topic);
      childrenByParent.set(topic.parentId, list);
    }
    return { roots, childrenByParent };
  }, [topics]);

  async function onExtract() {
    setExtracting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{
        result: { created: number; linked: number; source: string; message: string };
      }>(`/api/subjects/${subjectId}/topics/extract`, { method: "POST" });
      setNotice(response.result.message);
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setExtracting(false);
    }
  }

  async function onAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/api/subjects/${subjectId}/topics`, {
        method: "POST",
        body: {
          name,
          description,
          ...(parentId ? { parentId } : {}),
        },
      });
      setName("");
      setDescription("");
      setParentId("");
      setShowAdd(false);
      setNotice("Topic added to the map.");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.78rem] text-[#667085]">
          {topics.length} topic{topics.length === 1 ? "" : "s"} in this subject
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onExtract}
            disabled={isDemo || extracting}
            title={isDemo ? "The shared demo workspace is read-only." : undefined}
          >
            {extracting ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <FileSearch size={13} aria-hidden />
            )}
            {extracting ? "Reading headings…" : "Extract from headings"}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowAdd((value) => !value);
              setError(null);
            }}
            disabled={isDemo}
            title={isDemo ? "The shared demo workspace is read-only." : undefined}
          >
            <Plus size={13} aria-hidden />
            Add topic
          </button>
        </div>
      </div>

      {isDemo ? (
        <div className="rounded-lg border border-[#fedf89] bg-[#fffaeb] px-3 py-2 text-[0.78rem] leading-relaxed text-[#b54708]">
          The sample topic map is shared and read-only. Create a personal account to extract or add
          topics.
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.8rem] text-[#b42318]">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-lg border border-[#a6f4c5] bg-[#ecfdf3] px-3 py-2 text-[0.8rem] text-[#027a48]">
          {notice}
        </div>
      ) : null}

      {showAdd ? (
        <form onSubmit={onAdd} className="card border-[#d0d5dd] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[0.95rem]">Add a topic manually</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAdd(false)}
              aria-label="Close add-topic form"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="topic-name" className="label">
                Topic name
              </label>
              <input
                id="topic-name"
                className="input"
                value={name}
                minLength={2}
                maxLength={120}
                required
                placeholder="e.g. Light-dependent reactions"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="topic-parent" className="label">
                Parent topic <span className="font-normal normal-case tracking-normal text-[#98a2b3]">(optional)</span>
              </label>
              <select
                id="topic-parent"
                className="select"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">Top level</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="topic-description" className="label">
                Description <span className="font-normal normal-case tracking-normal text-[#98a2b3]">(optional)</span>
              </label>
              <textarea
                id="topic-description"
                className="textarea min-h-[60px]"
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
              {pending ? "Adding…" : "Add topic"}
            </button>
          </div>
        </form>
      ) : null}

      {topics.length === 0 ? (
        <div className="card border-dashed bg-[#fcfcfd] p-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ebe9fe] text-[#7a5af8]">
            <FolderTree size={18} aria-hidden />
          </span>
          <h3 className="mt-3 text-[1rem]">No topics mapped yet</h3>
          <p className="mt-1 max-w-xl text-[0.84rem] leading-relaxed text-[#667085]">
            Upload a syllabus with headings and use “Extract from headings”. The extractor only creates
            topics that actually appear in your indexed material, and links each one to the page it came
            from. You can also add a topic manually.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/materials/upload?subject=${subjectId}`} className="btn btn-primary btn-sm">
              Upload a syllabus
            </Link>
          </div>
        </div>
      ) : (
        <section className="card p-5" aria-labelledby="topic-list-heading">
          <SectionHeading
            title="Topic map"
            level={2}
            description="Mastery is shown only when the evidence minimum is met. A missing figure means not assessed, not weak."
            action={
              <span className="inline-flex items-center gap-1 text-[0.7rem] text-[#667085]">
                <Sparkles size={12} aria-hidden />
                Citation-linked
              </span>
            }
          />
          <ul id="topic-list-heading" className="divide-y divide-[#f2f4f7]">
            {tree.roots.map((root) => (
              <li key={root.id}>
                <ul className="divide-y divide-[#f2f4f7]">
                  <TopicRow topic={root} isDemo={isDemo} />
                  {(tree.childrenByParent.get(root.id) ?? []).map((child) => (
                    <li key={child.id} className="ml-4 border-l border-[#eaecf0] pl-4 sm:ml-8">
                      <ul>
                        <TopicRow topic={child} isDemo={isDemo} />
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
