"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";

export function DocumentActions({
  documentId,
  subjectId,
  status,
  isDemo,
  redirectOnDelete = false,
}: {
  documentId: string;
  subjectId: string;
  status: string;
  isDemo: boolean;
  redirectOnDelete?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"retry" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRetry() {
    setPending("retry");
    setError(null);
    try {
      await apiRequest(`/api/documents/${documentId}/retry`, { method: "POST" });
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPending(null);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm(
      "Delete this document? It is refused if it supports questions already answered in a saved attempt.",
    );
    if (!confirmed) return;
    setPending("delete");
    setError(null);
    try {
      await apiRequest(`/api/documents/${documentId}`, { method: "DELETE" });
      if (redirectOnDelete) router.push(`/materials?subject=${subjectId}`);
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "failed" ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRetry}
            disabled={isDemo || pending !== null}
            title={isDemo ? "The shared demo workspace is read-only." : undefined}
          >
            {pending === "retry" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RefreshCcw size={13} aria-hidden />}
            Retry processing
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={onDelete}
          disabled={isDemo || pending !== null}
          title={isDemo ? "The shared demo workspace is read-only." : undefined}
        >
          {pending === "delete" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Trash2 size={13} aria-hidden />}
          Delete
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 max-w-md text-[0.76rem] leading-relaxed text-[#b42318]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
