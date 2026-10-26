import type { Metadata } from "next";
import Link from "next/link";
import { redirectIfSignedIn } from "@/lib/auth/page";
import { SignupForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create an account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  await redirectIfSignedIn();

  return (
    <div className="mx-auto grid min-h-[calc(100vh-13rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1fr]">
      <section className="card p-6 sm:p-7" aria-labelledby="signup-heading">
        <h1 id="signup-heading" className="text-[1.35rem]">
          Create your workspace
        </h1>
        <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[#475467]">
          Start with a subject you are preparing for. You will upload material, build a topic map and
          take a short diagnostic before any mastery figure is reported.
        </p>
        <div className="mt-5">
          <SignupForm />
        </div>
        <p className="mt-5 border-t border-[#eaecf0] pt-4 text-[0.8rem] text-[#475467]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#7a5af8] hover:underline">
            Sign in
          </Link>
          .
        </p>
      </section>

      <section className="max-w-lg lg:order-first">
        <p className="eyebrow">What you get</p>
        <h2 className="display-lg mt-3 text-[#171f2e]">A diagnosis you can inspect line by line.</h2>
        <ol className="mt-7 space-y-5">
          {[
            ["Sources first", "Upload a syllabus, notes and past paper. Each chunk keeps its document, page and heading."],
            ["Measured gaps", "Mastery is a weighted marks ratio. Below two answers, three marks and two distinct questions, the topic is not assessed."],
            ["Time-aware plans", "Your daily minutes and session length are enforced when the plan is generated on the server."],
            ["No hidden answer keys", "Expected answers and rubrics are withheld from the quiz payload until you submit."],
          ].map(([title, body], index) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d0d5dd] bg-[#f9fafb] font-mono text-[0.66rem] font-semibold text-[#7a5af8]">
                {index + 1}
              </span>
              <div>
                <h3 className="text-[0.92rem]">{title}</h3>
                <p className="mt-1 text-[0.81rem] leading-relaxed text-[#475467]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-xl border border-[#fedf89] bg-[#fffaeb] p-4 text-[0.78rem] leading-relaxed text-[#b54708]">
          <strong className="font-semibold">Before you upload:</strong> use material you are allowed to
          process. Files are stored in this deployment&apos;s database and are sent to the configured
          embedding or language-model provider only when that provider is enabled.
        </div>
      </section>
    </div>
  );
}
