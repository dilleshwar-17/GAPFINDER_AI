"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-[0.76rem] font-medium text-[#b42318]" role="alert">
      {message}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiRequest("/api/auth/login", { method: "POST", body: { email, password } });
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="login-email" className="label">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="login-password" className="label">
            Password
          </label>
          <Link href="/forgot-password" className="mb-1 text-[0.74rem] text-[#7a5af8] hover:underline">
            Forgot password?
          </Link>
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? (
        <div id="login-error" role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.8rem] text-[#b42318]">
          {error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: { displayName, email, password },
      });
      router.push("/onboarding");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="signup-name" className="label">
          Display name
        </label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          className="input"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="signup-email" className="label">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="signup-password" className="label">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="signup-password-help"
        />
        <p id="signup-password-help" className="field-help">
          At least 8 characters. Use a unique password you do not reuse elsewhere.
        </p>
      </div>
      {error ? (
        <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.8rem] text-[#b42318]">
          {error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-[0.72rem] leading-relaxed text-[#667085]">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="underline hover:text-[#7a5af8]">
          terms
        </Link>{" "}
        and acknowledge the{" "}
        <Link href="/privacy" className="underline hover:text-[#7a5af8]">
          privacy notice
        </Link>
        . Upload only material you are permitted to use.
      </p>
    </form>
  );
}

export function DemoLaunchButton({
  label = "Enter the demo workspace",
  className = "btn btn-gold",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLaunch() {
    setPending(true);
    setError(null);
    try {
      await apiRequest("/api/auth/demo", { method: "POST" });
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onLaunch} className={className} disabled={pending}>
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        {pending ? "Preparing demo…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[0.76rem] text-[#b42318]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      className={compact ? "btn btn-ghost btn-sm" : "btn btn-secondary btn-sm"}
    >
      {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
