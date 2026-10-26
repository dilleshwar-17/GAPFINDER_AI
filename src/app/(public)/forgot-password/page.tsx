import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/ui";
import { PasswordResetRequestForm } from "@/components/password-recovery-forms";

export const metadata: Metadata = { title: "Password help" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="eyebrow">Account recovery</p>
      <h1 className="display-lg mt-3 text-[#171f2e]">Reset your password.</h1>
      <p className="mt-4 text-[0.93rem] leading-relaxed text-[#475467]">
        Enter your account email to request a secure reset link. The response will not reveal
        whether an account exists.
      </p>

      <PasswordResetRequestForm />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login" className="btn btn-primary">
          Back to sign in
        </Link>
        <Link href="/signup" className="btn btn-secondary">
          Create a new account
        </Link>
      </div>
      <div className="mt-6">
        <Callout tone="info" title="Email delivery">
          Password recovery depends on an enabled and correctly configured Supabase Auth email
          provider. Never share a reset link with anyone.
        </Callout>
      </div>
    </div>
  );
}
