import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Account recovery</p>
      <h1 className="display-lg mt-3 text-[#171f2e]">No reset token can be accepted.</h1>
      <p className="mt-4 text-[0.93rem] leading-relaxed text-[#475467]">
        Password-reset tokens require an email delivery service that this deployment does not have.
        This page does not accept or validate a token, because no legitimate token can be issued.
      </p>

      <div className="mt-7">
        <Callout tone="info" title="Use an authenticated password change instead">
          Sign in, open <strong>Settings → Security</strong>, and provide your current password plus a
          new password. The change is recorded only after the current password is verified.
        </Callout>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="text-[0.95rem]">If you are locked out</h2>
        <p className="mt-1 text-[0.82rem] leading-relaxed text-[#475467]">
          Account recovery requires administrator assistance for security reasons. You can register a new account or contact your system administrator.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login" className="btn btn-primary">
          Go to sign in
        </Link>
        <Link href="/forgot-password" className="btn btn-secondary">
          Password help
        </Link>
      </div>
    </div>
  );
}
