import type { Metadata } from "next";
import Link from "next/link";
import { redirectIfSignedIn, safeNextPath } from "@/lib/auth/page";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  await redirectIfSignedIn();
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <div className="mx-auto grid min-h-[calc(100vh-13rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
      <section className="max-w-lg">
        <p className="eyebrow">Welcome back</p>
        <h1 className="display-lg mt-3 text-[#171f2e]">Pick up the evidence where you left it.</h1>
        <p className="mt-4 text-[0.92rem] leading-relaxed text-[#475467]">
          Your diagnoses, revision plans and source citations are waiting in the workspace you built.
        </p>
        <div className="mt-7 grid gap-3 text-[0.82rem] text-[#475467]">
          <div className="flex items-start gap-2.5">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a5af8]" />
            Every attempt is tied to the exact source chunks used to write its questions.
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a5af8]" />
            Plans are versioned after each assessment; completed tasks remain in the history.
          </div>
        </div>
      </section>

      <section className="card order-first p-6 sm:p-7 lg:order-last" aria-labelledby="login-heading">
        <h2 id="login-heading" className="text-[1.2rem]">
          Sign in to GapFinder AI
        </h2>
        <p className="mt-1 text-[0.8rem] text-[#667085]">
          Use the email and password you registered with.
        </p>
        <div className="mt-5">
          <LoginForm next={next} />
        </div>
        <p className="mt-5 border-t border-[#eaecf0] pt-4 text-[0.8rem] text-[#475467]">
          New here?{" "}
          <Link href="/signup" className="font-medium text-[#7a5af8] hover:underline">
            Create an account
          </Link>{" "}
          or{" "}
          <Link href="/demo-access" className="font-medium text-[#7a5af8] hover:underline">
            explore the demo
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
