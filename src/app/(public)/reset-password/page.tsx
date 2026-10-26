import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui";
import { PasswordResetForm } from "@/components/password-recovery-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Account recovery</p>
      <h1 className="display-lg mt-3 text-[#171f2e]">Choose a new password.</h1>
      <p className="mt-4 text-[0.93rem] leading-relaxed text-[#475467]">
        Open this page from a valid Supabase password-reset link, then set a new password for your
        account.
      </p>

      <PasswordResetForm />

      <div className="mt-6">
        <Callout tone="info" title="Link expired?">
          Request another password reset link. Never send the link or your password to anyone.
        </Callout>
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
