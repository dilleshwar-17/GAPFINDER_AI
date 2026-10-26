import type { Metadata } from "next";
import Link from "next/link";
import { MailX } from "lucide-react";
import { Callout } from "@/components/ui";

export const metadata: Metadata = { title: "Password help" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Account recovery</p>
      <h1 className="display-lg mt-3 text-[#171f2e]">Password reset is not available yet.</h1>
      <p className="mt-4 text-[0.93rem] leading-relaxed text-[#475467]">
        This deployment has no transactional email provider configured. The application therefore
        cannot send a reset link, and it will not pretend that it did. No reset email has been sent.
      </p>

      <div className="mt-7">
        <Callout tone="warning" title="What you can do now">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>If you are already signed in, change your password from Settings → Security.</li>
            <li>
              If you cannot sign in, ask the deployment operator to reset the local database, or create
              a new account with a different email address. There is no self-service recovery path in
              this build.
            </li>
            <li>Do not send your password to anyone claiming to support the demo.</li>
          </ul>
        </Callout>
      </div>

      <div className="card mt-6 p-5">
        <div className="flex items-start gap-3">
          <MailX size={18} className="mt-0.5 shrink-0 text-[#b54708]" aria-hidden />
          <div>
            <h2 className="text-[0.95rem]">Why the page exists</h2>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-[#475467]">
              The route is part of the required information architecture. It is intentionally honest
              about an unavailable capability rather than collecting an email address and silently
              discarding it.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login" className="btn btn-primary">
          Back to sign in
        </Link>
        <Link href="/signup" className="btn btn-secondary">
          Create a new account
        </Link>
      </div>
    </div>
  );
}
