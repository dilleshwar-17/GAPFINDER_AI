"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { apiRequest, messageForError } from "@/lib/client/api";

function Notice({ message, tone }: { message: string; tone: "success" | "error" }) {
  if (tone === "success") {
    return (
      <p
        role="status"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#a6f4c5] bg-[#ecfdf3] px-3 py-2 text-[0.78rem] text-[#027a48]"
      >
        <CheckCircle2 size={13} aria-hidden />
        {message}
      </p>
    );
  }
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[0.78rem] text-[#b42318]"
    >
      {message}
    </p>
  );
}

export function ProfileForm({
  defaultName,
  email,
  isDemo,
}: {
  defaultName: string;
  email: string;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest("/api/profile", { method: "PATCH", body: { displayName: name } });
      setNotice("Display name updated.");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-5">
      <div className="flex items-center gap-2">
        <UserRound size={15} className="text-[#7a5af8]" aria-hidden />
        <h2 className="text-[0.98rem]">Profile</h2>
      </div>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-[#667085]">
        Signed in as <span className="font-medium text-[#344054]">{email}</span>
        {isDemo ? " · shared demo account" : ""}
      </p>
      <div className="mt-4">
        <label htmlFor="settings-name" className="label">
          Display name
        </label>
        <input
          id="settings-name"
          className="input"
          value={name}
          minLength={2}
          maxLength={80}
          required
          disabled={isDemo || pending}
          onChange={(event) => setName(event.target.value)}
        />
        {isDemo ? (
          <p className="field-help">The shared demo profile is fixed so every visitor sees the same workspace.</p>
        ) : null}
      </div>
      {error ? <Notice message={error} tone="error" /> : null}
      {notice ? <Notice message={notice} tone="success" /> : null}
      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn btn-primary btn-sm" disabled={isDemo || pending}>
          {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Save size={13} aria-hidden />}
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

export function PasswordForm({ isDemo }: { isDemo: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (nextPassword !== confirm) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setPending(true);
    try {
      await apiRequest("/api/password", {
        method: "PATCH",
        body: { currentPassword, nextPassword },
      });
      setCurrentPassword("");
      setNextPassword("");
      setConfirm("");
      setNotice("Password changed. Other sessions were signed out and this browser was kept signed in.");
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-5">
      <div className="flex items-center gap-2">
        <KeyRound size={15} className="text-[#7a5af8]" aria-hidden />
        <h2 className="text-[0.98rem]">Password</h2>
      </div>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-[#667085]">
        {isDemo
          ? "The demo account password is managed by the operator and cannot be changed from the shared workspace."
          : "Changing your password revokes every other session. This browser stays signed in."}
      </p>
      {isDemo ? null : (
        <>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="current-password" className="label">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                className="input"
                autoComplete="current-password"
                value={currentPassword}
                required
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="new-password" className="label">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={200}
                  value={nextPassword}
                  required
                  onChange={(event) => setNextPassword(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="label">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={200}
                  value={confirm}
                  required
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
            </div>
          </div>
          {error ? <Notice message={error} tone="error" /> : null}
          {notice ? <Notice message={notice} tone="success" /> : null}
          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <KeyRound size={13} aria-hidden />}
              {pending ? "Updating…" : "Change password"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

export function PreferencesForm({
  defaultMinutes,
  defaultSession,
  isDemo,
}: {
  defaultMinutes: number;
  defaultSession: number;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [minutesPerDay, setMinutesPerDay] = useState(defaultMinutes);
  const [sessionMinutes, setSessionMinutes] = useState(defaultSession);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest("/api/preferences", {
        method: "PUT",
        body: { minutesPerDay, sessionMinutes },
      });
      setNotice("Study preferences saved. New plans use these bounds.");
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-5">
      <h2 className="text-[0.98rem]">Study preferences</h2>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-[#667085]">
        These defaults prefill the plan builder. The server still enforces the same limits on every
        request.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pref-minutes" className="label">
            Minutes per day
          </label>
          <input
            id="pref-minutes"
            type="number"
            className="input"
            min={10}
            max={480}
            value={minutesPerDay}
            disabled={isDemo || pending}
            onChange={(event) => setMinutesPerDay(Number(event.target.value))}
          />
        </div>
        <div>
          <label htmlFor="pref-session" className="label">
            Session length
          </label>
          <select
            id="pref-session"
            className="select"
            value={sessionMinutes}
            disabled={isDemo || pending}
            onChange={(event) => setSessionMinutes(Number(event.target.value))}
          >
            {[20, 30, 45, 60, 90].map((value) => (
              <option key={value} value={value}>
                {value} minutes
              </option>
            ))}
          </select>
        </div>
      </div>
      {isDemo ? (
        <p className="field-help">Preferences are fixed in the shared demo workspace.</p>
      ) : null}
      {error ? <Notice message={error} tone="error" /> : null}
      {notice ? <Notice message={notice} tone="success" /> : null}
      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn btn-primary btn-sm" disabled={isDemo || pending}>
          {pending ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Save size={13} aria-hidden />}
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
