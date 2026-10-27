import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Eye } from "lucide-react";
import { demoStatus } from "@/lib/services/demo";
import { runtimeMode } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { DemoLaunchButton } from "@/components/auth-forms";
import { Callout } from "@/components/ui";

export const metadata: Metadata = { title: "Demo access" };

export const dynamic = "force-dynamic";

export default async function DemoAccessPage() {
  const status = demoStatus();
  const mode = runtimeMode();
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="max-w-3xl">
        <p className="eyebrow">Judge and reviewer access</p>
        <h1 className="display-lg mt-3 text-[#171f2e]">A complete workspace, private to your demo session.</h1>
        <p className="mt-4 text-[0.94rem] leading-relaxed text-[#475467]">
          Each visit gets a fresh, isolated workspace with sample content. You can try the full
          learning flow; ending the demo deletes its application data. No demo credential is shown.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[1.1rem]">Enter the demo workspace</h2>
              <p className="mt-1 text-[0.82rem] text-[#475467]">
                {status.enabled
                  ? "A private interactive workspace is enabled on this deployment."
                  : "The demo workspace is disabled on this deployment."}
              </p>
            </div>
            <span className={status.enabled ? "badge badge-strong" : "badge badge-neutral"}>
              {status.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mt-5 grid gap-2 text-[0.8rem] text-[#475467]">
            <p className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#7a5af8]" aria-hidden />
              Three sample subjects, each with five indexed study materials.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#7a5af8]" aria-hidden />
              Topic maps, diagnostics, mastery history and a revision plan for each subject.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#7a5af8]" aria-hidden />
              Sample citations resolve to the seeded document pages.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {status.enabled ? (
              user ? (
                <Link href="/dashboard" className="btn btn-primary">
                  Return to your workspace
                </Link>
              ) : (
                <DemoLaunchButton />
              )
            ) : (
              <button type="button" className="btn btn-primary" disabled>
                Demo unavailable
              </button>
            )}
            <Link href="/signup" className="btn btn-secondary">
              Create a personal workspace
            </Link>
          </div>

          {user?.isDemo ? (
          <Callout tone="gold" title={user.isReadOnlyDemo ? "Shared read-only demo" : "Private interactive demo"}>
            {user.isReadOnlyDemo
              ? "This legacy shared demo account is read-only. Start a new demo session to try the full interactive workspace."
              : "This session is isolated from other visitors. Changes are temporary and will be removed when you end the demo or when the session expires."}
            </Callout>
          ) : null}

        </section>

        <div className="space-y-4">
          <section className="card-forest p-5">
            <Eye size={18} className="text-[#9b8afb]" aria-hidden />
            <h2 className="mt-3 text-[1rem] text-[#ffffff]">What is seeded</h2>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#bdb4fe]">
              {status.subjectName}
            </p>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-[#98a2b3]">
              Each new session gets its own three subjects and five indexed materials per subject.
              Start fresh any time; ending this session removes its workspace data.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
