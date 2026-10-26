"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setPending(true);
    try {
      const result = await apiRequest<{ message: string }>("/api/auth/supabase/reset-password", {
        method: "POST",
        body: { email },
      });
      setNotice(result.message);
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-7 space-y-4 p-5">
      <div>
        <label htmlFor="recovery-email" className="label">Email</label>
        <input
          id="recovery-email"
          type="email"
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {error ? <p role="alert" className="text-[0.8rem] text-[#b42318]">{error}</p> : null}
      {notice ? <p role="status" className="text-[0.8rem] text-[#067647]">{notice}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
        {pending ? "Sending…" : "Send password reset link"}
      </button>
    </form>
  );
}

export function PasswordResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-7 space-y-4 p-5">
      <div>
        <label htmlFor="reset-password" className="label">New password</label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={200}
          required
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="reset-password-confirm" className="label">Confirm new password</label>
        <input
          id="reset-password-confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={200}
          required
          className="input"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      {error ? <p role="alert" className="text-[0.8rem] text-[#b42318]">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
