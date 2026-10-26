"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the message in the browser console so the digest can be reported.
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-5 py-16"
    >
      <p className="eyebrow mb-2">Something failed</p>
      <h1 className="text-[1.9rem] leading-tight">This page could not finish loading.</h1>
      <p className="mt-3 text-[0.91rem] leading-relaxed text-[#475467]">
        The server rejected the request or hit an unexpected error. No partial or invented result is
        shown. Retrying re-runs the same server-side checks.
      </p>

      <div className="mt-5 flex items-start gap-2 rounded-[10px] border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-[0.8rem] leading-relaxed text-[#b54708]">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">What you can try</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Retry the request.</li>
            <li>Return to the dashboard and open the item again.</li>
            <li>If you were submitting a diagnostic, your saved draft should still be available.</li>
          </ul>
          {error.digest ? (
            <p className="mt-1.5 font-mono text-[0.66rem] text-[#b54708]">Digest: {error.digest}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={reset}>
          <RotateCcw size={15} aria-hidden />
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          <Home size={15} aria-hidden />
          Dashboard
        </Link>
      </div>
    </main>
  );
}
