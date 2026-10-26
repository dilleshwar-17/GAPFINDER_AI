import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Cpu,
  Database,
  Info,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth/page";
import { getPreferences } from "@/lib/services/preferences";
import {
  isDemoEnabled,
  maxUploadBytes,
  minEvidenceChars,
  retrievalMinScore,
  retrievalTopK,
  runtimeMode,
} from "@/lib/env";
import { formatFileSize } from "@/lib/http";
import { Callout, PageHeader, SectionHeading } from "@/components/ui";
import { PasswordForm, PreferencesForm, ProfileForm } from "@/components/settings-forms";
import { LogoutButton } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePageUser();
  const preferences = getPreferences(user.id);
  const runtime = runtimeMode();
  const demoEnabled = isDemoEnabled();

  const rows: Array<{ label: string; value: string; icon: React.ReactNode }> = [
    {
      label: "Language model",
      value: runtime.llm.configured
        ? `${runtime.llm.provider} · ${runtime.llm.model}`
        : "Not configured · deterministic generators only",
      icon: <Sparkles size={14} aria-hidden />,
    },
    {
      label: "Embeddings",
      value: `${runtime.embeddings.provider} · ${runtime.embeddings.model} · ${runtime.embeddings.dimensions} dims${
        runtime.embeddings.neural ? "" : " · lexical, not neural"
      }`,
      icon: <Cpu size={14} aria-hidden />,
    },
    {
      label: "Retrieval",
      value: `top ${retrievalTopK()} chunks · minimum score ${retrievalMinScore()} · minimum ${minEvidenceChars()} evidence characters`,
      icon: <Layers size={14} aria-hidden />,
    },
    {
      label: "Upload limit",
      value: `${formatFileSize(maxUploadBytes())} per document`,
      icon: <Database size={14} aria-hidden />,
    },
    {
      label: "Demo access",
      value: demoEnabled ? "Enabled · shared read-only workspace" : "Disabled",
      icon: <Info size={14} aria-hidden />,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, security and the study defaults used by the plan builder. Configuration values below describe this running instance and never expose secrets."
        actions={<LogoutButton />}
      />

      {user.isDemo ? (
        <div className="mb-5">
          <Callout tone="gold" title="Shared demo workspace">
            This account is shared and read-only. Profile, password and preference changes are blocked.
            Practice diagnostics are still scored and saved, but they do not change the sample mastery
            history or plan.
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <ProfileForm defaultName={user.displayName} email={user.email} isDemo={user.isDemo} />
          <PasswordForm isDemo={user.isDemo} />
          <PreferencesForm
            defaultMinutes={preferences.minutesPerDay}
            defaultSession={preferences.sessionMinutes}
            isDemo={user.isDemo}
          />
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <SectionHeading
              title="This instance"
              description="Runtime configuration, resolved from server environment variables."
            />
            <dl className="space-y-3">
              {rows.map((row) => (
                <div key={row.label} className="flex gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[#7a5af8]">{row.icon}</span>
                  <div className="min-w-0">
                    <dt className="text-[0.63rem] font-semibold uppercase tracking-[0.08em] text-[#667085]">
                      {row.label}
                    </dt>
                    <dd className="mt-0.5 break-words font-mono text-[0.69rem] leading-relaxed text-[#344054]">
                      {row.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#7a5af8]" aria-hidden />
              <h2 className="text-[0.95rem]">Privacy</h2>
            </div>
            <p className="mt-2 text-[0.77rem] leading-relaxed text-[#667085]">
              Your material, answers and evidence are scoped to your account. Every read and write
              checks ownership on the server. There is no public sharing of a personal workspace.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[0.74rem]">
              <Link href="/privacy" className="font-medium text-[#7a5af8] hover:underline">
                Privacy notice
              </Link>
              <Link href="/terms" className="font-medium text-[#7a5af8] hover:underline">
                Terms of use
              </Link>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#dc6803]" aria-hidden />
              <div>
                <h2 className="text-[0.95rem]">Honest limitations</h2>
                <ul className="mt-2 space-y-1.5 text-[0.75rem] leading-relaxed text-[#667085]">
                  <li>Mastery bands are heuristics, not validated exam predictions.</li>
                  <li>Short answers are scored against rubric concepts with lexical matching fallback.</li>
                  <li>Password reset email delivery is not configured in this build.</li>
                  <li>Application data is managed by server database storage.</li>
                </ul>
                <Link
                  href="/demo-access"
                  className="mt-2 inline-flex text-[0.73rem] font-medium text-[#7a5af8] hover:underline"
                >
                  How the demo is provisioned
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
