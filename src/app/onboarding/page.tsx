import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";
import { getPreferences } from "@/lib/services/preferences";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Set up your workspace" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requirePageUser();
  if (user.isDemo) redirect("/dashboard");
  const preferences = getPreferences(user.id);

  return (
    <div className="hero-wash min-h-screen">
      <header className="border-b border-[#eaecf0] bg-[#f9fafb]/90">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-3 text-[0.78rem] text-[#475467]">
            <span className="hidden sm:inline">{user.displayName}</span>
            <LogoutButton compact />
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-7 max-w-2xl">
          <p className="eyebrow">Workspace setup</p>
          <h1 className="display-lg mt-3 text-[#171f2e]">
            {preferences.onboardingCompleted ? "Adjust your starting point." : "Build the smallest useful loop."}
          </h1>
          <p className="mt-4 text-[0.92rem] leading-relaxed text-[#475467]">
            One subject, one syllabus, one short diagnostic. That is enough to produce a cited gap
            report and a time-bounded plan.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <OnboardingWizard
            defaultName="Biology: Cells and Energy"
            defaultMinutes={preferences.minutesPerDay}
            defaultSession={preferences.sessionMinutes}
          />

          <aside className="space-y-4">
            <section className="card p-5">
              <p className="eyebrow mb-2">What happens next</p>
              <ol className="space-y-3 text-[0.8rem] leading-relaxed text-[#475467]">
                <li>
                  <strong className="text-[#344054]">1. Upload sources.</strong> A syllabus with headings
                  gives the topic extractor something real to work with.
                </li>
                <li>
                  <strong className="text-[#344054]">2. Build the topic map.</strong> Headings become
                  topics linked to the chunk and page where they appeared.
                </li>
                <li>
                  <strong className="text-[#344054]">3. Take a diagnostic.</strong> Up to three topics,
                  three questions per topic. Topics with too little evidence are skipped, not padded.
                </li>
              </ol>
            </section>

            <section className="card p-5">
              <p className="eyebrow mb-2">Not sure yet?</p>
              <p className="text-[0.8rem] leading-relaxed text-[#475467]">
                Explore the sample workspace instead. It is a shared, read-only sample workspace with a
                complete Biology loop already in place.
              </p>
              <Link href="/demo-access" className="btn btn-secondary btn-sm mt-3">
                About the demo
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
