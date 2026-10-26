import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Eye, Lock, RefreshCcw, ShieldCheck } from "lucide-react";
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
        <h1 className="display-lg mt-3 text-[#171f2e]">A coherent workspace, without a published password.</h1>
        <p className="mt-4 text-[0.94rem] leading-relaxed text-[#475467]">
          The demo is a dedicated, seeded account. The button below asks the server to provision or
          reuse that account and to issue a normal HTTP-only session cookie. No demo credential is
          printed here, in the repository, or in the interface.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[1.1rem]">Enter the demo workspace</h2>
              <p className="mt-1 text-[0.82rem] text-[#475467]">
                {status.enabled
                  ? "The shared sample workspace is enabled on this deployment."
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
              Three indexed Biology sources: syllabus, notes and a past paper.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#7a5af8]" aria-hidden />
              A topic map, baseline and follow-up attempts, mastery history and an active plan.
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
            <Callout tone="gold" title="You are signed in to the shared demo">
              You can take practice diagnostics and use BUDDY. Uploads, subject edits, topic
              extraction, plan generation and preference changes are blocked server-side so the
              workspace stays intact for the next reviewer.
            </Callout>
          ) : null}

          <div className="mt-6 border-t border-[#eaecf0] pt-4">
            <p className="eyebrow mb-2">How to reset or disable</p>
            <p className="text-[0.78rem] leading-relaxed text-[#475467]">
              {status.enabled
                ? "An operator can set DISABLE_DEMO=1 to withdraw access, or reset the SQLite database with `npm run db:reset`. Deleting the reserved demo user also forces a clean re-seed on the next entry."
                : "Set DISABLE_DEMO to 0 or remove it, then restart the server to re-enable the demo."}
            </p>
          </div>
        </section>

        <div className="space-y-4">
          <section className="card-forest p-5">
            <Eye size={18} className="text-[#9b8afb]" aria-hidden />
            <h2 className="mt-3 text-[1rem] text-[#ffffff]">What is seeded</h2>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#bdb4fe]">
              {status.subjectName}
            </p>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-[#98a2b3]">
              The seed is idempotent. Re-entering the demo does not duplicate subjects, attempts or
              plans.
            </p>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#7a5af8]" aria-hidden />
              <h2 className="text-[0.95rem]">Shared-demo protection</h2>
            </div>
            <ul className="mt-2 space-y-2 text-[0.78rem] leading-relaxed text-[#475467]">
              <li className="flex gap-2">
                <Lock size={13} className="mt-0.5 shrink-0 text-[#dc6803]" aria-hidden />
                Writes are refused by service-level guards, not only hidden in the UI.
              </li>
              <li className="flex gap-2">
                <RefreshCcw size={13} className="mt-0.5 shrink-0 text-[#dc6803]" aria-hidden />
                Practice submissions are stored but do not mutate shared mastery or the seeded plan.
              </li>
              <li className="flex gap-2">
                <Eye size={13} className="mt-0.5 shrink-0 text-[#dc6803]" aria-hidden />
                Other reviewers may use the same workspace concurrently; expect shared practice history.
              </li>
            </ul>
          </section>

          <section className="card p-5">
            <p className="eyebrow mb-2">Runtime configuration</p>
            <dl className="space-y-1.5 text-[0.76rem]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Language model</dt>
                <dd className="font-mono text-[0.7rem] text-[#344054]">
                  {mode.llm.configured ? mode.llm.model : "not configured"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Embeddings</dt>
                <dd className="font-mono text-[0.7rem] text-[#344054]">
                  {mode.embeddings.model}
                  {mode.embeddings.neural ? " (neural)" : " (local, non-neural)"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Demo email</dt>
                <dd className="font-mono text-[0.7rem] text-[#344054]">{status.email}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-[#667085]">
              The email is shown only for operator diagnostics; it has a random stored password that is
              not disclosed.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
