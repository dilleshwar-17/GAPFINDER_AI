import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Terms of use</p>
      <h1 className="display-lg mt-3 text-[#171f2e]">An educational tool with explicit limits.</h1>
      <p className="mt-4 text-[0.92rem] leading-relaxed text-[#475467]">
        These terms describe the self-hosted build in this repository. They are not a substitute for a
        deployment-specific agreement.
      </p>

      <div className="prose-note card mt-8 p-6">
        <h2>What the service is</h2>
        <p>
          GapFinder AI helps a learner turn their own study material into source-grounded diagnostic
          questions, an evidence-based gap report and a time-bounded revision plan. It is study support,
          not an accredited assessment, a prediction of exam performance, or a substitute for a teacher.
        </p>

        <h2>Accuracy and mastery estimates</h2>
        <p>
          Mastery values are heuristic: a difficulty-weighted ratio of marks earned to marks available,
          subject to a minimum-evidence rule. The weak/developing/strong bands are provisional and have
          not been validated against an external educational standard. Topics below the evidence floor
          are reported as not assessed and must not be interpreted as weak.
        </p>

        <h2>Your responsibilities</h2>
        <ul>
          <li>Upload only material you own or are permitted to process. Do not upload confidential third-party data.</li>
          <li>Keep your password private. The service stores only a hash and cannot recover your password.</li>
          <li>Do not attempt to bypass authorisation, extract another user&apos;s data, or disrupt the shared demo.</li>
          <li>Do not rely on generated explanations as a sole source of truth; open and check the cited passage.</li>
        </ul>

        <h2>Availability</h2>
        <p>
          The demo and this build may be withdrawn or reset without notice. The SQLite implementation is
          not durable on ephemeral serverless storage and should not be treated as a production system of
          record.
        </p>

        <h2>Intellectual property</h2>
        <p>
          You retain responsibility for the material you upload. No licence is granted to third-party
          content beyond what you are entitled to provide. The application code is provided under the
          repository&apos;s licence, if one is present.
        </p>

        <h2>Liability</h2>
        <p>
          To the extent permitted by applicable law, the authors provide the software without warranties
          and are not liable for decisions made on the basis of its estimates, generated questions or
          explanations.
        </p>

        <h2>Changes</h2>
        <p>
          Material changes to these terms should be published with the deployment. This page does not
          claim legal review or compliance certification.
        </p>
      </div>

      <p className="mt-6 text-[0.8rem] text-[#667085]">
        See also the <Link href="/privacy" className="underline hover:text-[#7a5af8]">privacy notice</Link>.
      </p>
    </div>
  );
}
