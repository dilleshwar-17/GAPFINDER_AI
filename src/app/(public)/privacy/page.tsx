import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Privacy notice</p>
      <h1 className="display-lg mt-3 text-[#12382d]">What this build stores, and where it goes.</h1>
      <p className="mt-4 text-[0.92rem] leading-relaxed text-[#5a6a60]">
        This notice describes the self-hosted GapFinder AI build in this repository. It is an operational
        description, not legal advice. A production deployment must add its own retention policy,
        controller details and lawful-basis analysis.
      </p>

      <div className="prose-note card mt-8 p-6">
        <h2>Data you provide</h2>
        <ul>
          <li>Account display name, email address and a salted password hash (never the password itself).</li>
          <li>Subjects, exam dates, preferences and revision-plan settings you enter.</li>
          <li>
            Uploaded files (PDF, TXT or Markdown), extracted text, page and heading metadata, and vector
            embeddings. The original file bytes are retained in the database so a failed extraction can
            be retried.
          </li>
          <li>Diagnostic questions, your answers, marks, feedback and mastery snapshots.</li>
          <li>Assistant questions and the responses generated for them. These are not stored in this build.</li>
        </ul>

        <h2>Where data is stored</h2>
        <p>
          Data is stored in a single SQLite database opened by the Node server. The path is controlled by
          the <code>DATABASE_PATH</code> environment variable. Session cookies are HTTP-only and only a
          SHA-256 hash of the session token is stored. The database is not encrypted at rest by the
          application; rely on host-disk encryption if that is required.
        </p>

        <h2>When data leaves the server</h2>
        <ul>
          <li>
            If <code>GEMINI_API_KEY</code> is set, document chunk text is sent to Google&apos;s Gemini
            embedding API and selected excerpts are sent for question generation, short-answer evaluation
            and assistant explanations.
          </li>
          <li>
            If no key is configured, embeddings are computed locally with a non-neural hashing model and
            question generation, evaluation and explanations use deterministic source-grounded fallbacks.
            No document text leaves the server in that mode.
          </li>
          <li>No analytics, advertising or third-party tracking scripts are included.</li>
        </ul>

        <h2>Logging</h2>
        <p>
          AI telemetry records the task kind, method, model name, latency and whether a fallback occurred.
          It deliberately excludes document text, question text and student answers. Unexpected server
          errors log an error message without request bodies.
        </p>

        <h2>Retention and deletion</h2>
        <p>
          There is no automatic retention timer. Data remains until an operator resets the database or
          the application deletes a record. A subject cannot be deleted after it has submitted assessment
          history, and a document cannot be deleted if it supports answers in saved attempts, because
          deleting either would break the audit trail behind reported mastery. Uploaded material can be
          deleted while it has no answered questions.
        </p>

        <h2>The shared demo</h2>
        <p>
          The demo is a single shared account. Anything you type into practice answers, assistant
          questions or profile-adjacent fields may be visible to another reviewer using the same
          workspace. Do not enter personal, sensitive or confidential information into the demo. Shared
          reference data is protected by server-side write guards, but practice submissions are shared.
        </p>

        <h2>Your choices</h2>
        <p>
          You can change your display name and password from Settings. Self-service account deletion and
          email-based password reset are not implemented in this build. Operators can withdraw the demo
          with <code>DISABLE_DEMO=1</code> or reset all local data with <code>npm run db:reset</code>.
        </p>

        <h2>Contact</h2>
        <p>
          No data-protection contact address is configured in this repository. Do not invent one. The
          deploying organisation must publish its own contact and complaint route before public use.
        </p>
      </div>

      <p className="mt-6 text-[0.8rem] text-[#6d7b72]">
        See also the <Link href="/terms" className="underline hover:text-[#176b50]">terms of use</Link> and{" "}
        <Link href="/demo-access" className="underline hover:text-[#176b50]">demo access notes</Link>.
      </p>
    </div>
  );
}
