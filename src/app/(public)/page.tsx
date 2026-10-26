import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  Fingerprint,
  Gauge,
  ListChecks,
  Lock,
  Quote,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { DemoLaunchButton } from "@/components/auth-forms";

const methodSteps = [
  {
    icon: FileSearch,
    title: "Read your sources",
    body: "Upload a syllabus, notes and past paper. Text is extracted, chunked with page and heading provenance, and embedded.",
  },
  {
    icon: ScanSearch,
    title: "Retrieve before generating",
    body: "Questions and explanations are requested only from authorised chunks that pass a relevance threshold. Too little evidence means no question, not a confident guess.",
  },
  {
    icon: ListChecks,
    title: "Test, then score by rule",
    body: "Multiple-choice scoring is deterministic. Short answers are graded against rubric concepts, with a source-linked fallback when no model is configured.",
  },
  {
    icon: Gauge,
    title: "Report the evidence",
    body: "Mastery is a difficulty-weighted marks ratio with explicit sufficiency rules. Below the evidence floor the topic is reported as not assessed.",
  },
];

const workflow = [
  ["01", "Upload", "Syllabus, notes and a past paper, indexed with page-level citations."],
  ["02", "Map", "Headings become a topic map. Each topic keeps the source chunk it came from."],
  ["03", "Diagnose", "A short source-grounded diagnostic measures selected topics, up to three at a time."],
  ["04", "Plan", "Weakness, importance and urgency are combined inside your declared time budget."],
  ["05", "Learn", "Ask the source-grounded assistant, then log evidence of understanding on the task."],
  ["06", "Retest", "A new diagnostic updates mastery and versions the plan while keeping history."],
];

const promises = [
  {
    icon: Quote,
    title: "Citations resolve or the claim goes",
    body: "Model output is accepted only when every source label maps to a chunk retrieved for that request. Otherwise the app falls back to labelled extractive text.",
  },
  {
    icon: Fingerprint,
    title: "No answer key before submission",
    body: "Expected answers, rubrics and scoring are withheld from the quiz payload until an attempt is submitted. The browser never receives the key early.",
  },
  {
    icon: Lock,
    title: "Ownership checked on the server",
    body: "Every subject, document, topic, attempt, task and conversation lookup is scoped to the signed-in owner. Session cookies are HTTP-only and hashed at rest.",
  },
  {
    icon: CheckCircle2,
    title: "Honest about uncertainty",
    body: "The bands are provisional heuristics, not validated educational thresholds. Insufficient evidence is shown as not assessed and excluded from the weak-topic count.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="hero-wash relative overflow-hidden">
        <div className="panel-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-20 lg:pt-20">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2fa77a]" />
              Learning diagnosis, grounded in your own material
            </p>
            <h1 className="display-xl mt-5 max-w-[15ch] text-[#12382d]">
              Find the gaps that actually cost you marks.
            </h1>
            <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-[#4f6056]">
              GapFinder AI turns your syllabus and notes into a cited diagnostic, an evidence-based
              gap report and a revision plan that fits the time you actually have. When the evidence
              is thin, it says so.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-primary btn-lg">
                Start with your own material
                <ArrowRight size={16} aria-hidden />
              </Link>
              <DemoLaunchButton label="Open the seeded demo" className="btn btn-secondary btn-lg" />
            </div>
            <p className="mt-4 max-w-lg text-[0.74rem] leading-relaxed text-[#718078]">
              The demo is a shared, read-only sample workspace. Practice attempts are scored but do not
              alter the seeded mastery history. No demo password is published.
            </p>
            <dl className="mt-9 grid grid-cols-3 gap-4 border-t border-[#dfe6db] pt-5">
              <div>
                <dt className="text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-[#7a877f]">Grounding</dt>
                <dd className="mt-1 text-[0.85rem] font-medium text-[#2c4034]">Chunk-level citations</dd>
              </div>
              <div>
                <dt className="text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-[#7a877f]">Scoring</dt>
                <dd className="mt-1 text-[0.85rem] font-medium text-[#2c4034]">Deterministic marks</dd>
              </div>
              <div>
                <dt className="text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-[#7a877f]">Evidence</dt>
                <dd className="mt-1 text-[0.85rem] font-medium text-[#2c4034]">Explicit minimums</dd>
              </div>
            </dl>
          </div>

          <div className="relative">
            <div className="absolute -right-3 -top-3 hidden rounded-full border border-[#e4d3a6] bg-[#fbf6e7] px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[#7b601f] sm:block">
              Sample diagnosis
            </div>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#e5eae2] bg-[#fbfcf8] px-4 py-3">
                <div>
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-[#728178]">Gap report</p>
                  <p className="mt-0.5 text-[0.88rem] font-semibold text-[#243a2e]">Biology: Cells and Energy</p>
                </div>
                <span className="badge badge-demo">Demo data</span>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-[#e8ede4] bg-[#fbfcf8] p-2.5">
                    <p className="text-[0.58rem] uppercase tracking-[0.1em] text-[#7b887f]">Weak</p>
                    <p className="mt-1 text-xl font-semibold text-[#a63d2f]">2</p>
                  </div>
                  <div className="rounded-lg border border-[#e8ede4] bg-[#fbfcf8] p-2.5">
                    <p className="text-[0.58rem] uppercase tracking-[0.1em] text-[#7b887f]">Developing</p>
                    <p className="mt-1 text-xl font-semibold text-[#9a6414]">1</p>
                  </div>
                  <div className="rounded-lg border border-[#e8ede4] bg-[#fbfcf8] p-2.5">
                    <p className="text-[0.58rem] uppercase tracking-[0.1em] text-[#7b887f]">Strong</p>
                    <p className="mt-1 text-xl font-semibold text-[#176b50]">1</p>
                  </div>
                </div>

                {[
                  { name: "Photosynthesis", value: 38, tone: "weak", label: "Weak" },
                  { name: "Cellular respiration", value: 44, tone: "weak", label: "Weak" },
                  { name: "Cell organelles", value: 71, tone: "developing", label: "Developing" },
                  { name: "Cell membrane", value: 88, tone: "strong", label: "Strong" },
                ].map((topic) => (
                  <div key={topic.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="text-[0.8rem] text-[#34483c]">{topic.name}</span>
                      <span className="font-mono text-[0.68rem] text-[#6e7d73]">
                        {topic.value}% · {topic.label}
                      </span>
                    </div>
                    <div className={`meter meter-${topic.tone}`} role="img" aria-label={`${topic.name}: ${topic.value} percent, ${topic.label}`}>
                      <span style={{ width: `${topic.value}%` }} />
                    </div>
                  </div>
                ))}

                <div className="citation">
                  <div className="flex items-start gap-2">
                    <Quote size={12} className="mt-0.5 shrink-0 text-[#49806b]" aria-hidden />
                    <p className="text-[0.73rem] leading-relaxed text-[#4e6056]">
                      <span className="font-semibold text-[#275544]">demo-notes.txt · page 2</span> — “The
                      Calvin cycle is a sequence of enzyme-controlled reactions that use ATP and NADPH to
                      fix carbon dioxide into glucose.”
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-[#dce8dd] bg-[#f4faf5] px-3 py-2">
                  <span className="text-[0.72rem] text-[#3c5a48]">Next evidence check</span>
                  <span className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-[#176b50]">
                    2 answers · 5 marks
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-[0.68rem] leading-relaxed text-[#75837b]">
              <Sparkles size={13} className="mt-0.5 shrink-0" aria-hidden />
              <p>
                Illustrative demo values. A real report only shows topics that passed the evidence
                minimum; everything else is marked not assessed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="method" className="border-y border-[#e2e7dd] bg-[#fbfbf6]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="eyebrow">The method</p>
            <h2 className="display-lg mt-3 text-[#12382d]">Retrieve, measure, then recommend.</h2>
            <p className="mt-4 text-[0.94rem] leading-relaxed text-[#5a6a60]">
              The product is deliberately sequenced. No diagnosis before retrieval, no plan before
              evidence, and no claim without a source you can open.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {methodSteps.map((step, index) => (
              <article key={step.title} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e9f3ec] text-[#176b50]">
                    <step.icon size={17} aria-hidden />
                  </span>
                  <span className="diagnosis-mark">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-[0.95rem]">{step.title}</h3>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-[#64746a]">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow">One loop, not a content dump</p>
            <h2 className="display-lg mt-3 text-[#12382d]">A study workflow that remembers what changed.</h2>
            <p className="mt-4 text-[0.92rem] leading-relaxed text-[#5a6a60]">
              Each assessment creates evidence. Each plan version preserves what you already finished.
              Weakness is measured against marks available, not against how often a topic was clicked.
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex gap-3">
                <BookOpenCheck size={17} className="mt-0.5 shrink-0 text-[#176b50]" aria-hidden />
                <p className="text-[0.82rem] leading-relaxed text-[#516158]">
                  A diagnostic draws on at most three topics and three questions per topic, and skips a
                  topic rather than inventing unsupported questions.
                </p>
              </div>
              <div className="flex gap-3">
                <Gauge size={17} className="mt-0.5 shrink-0 text-[#176b50]" aria-hidden />
                <p className="text-[0.82rem] leading-relaxed text-[#516158]">
                  A plan is capped to a fourteen-day horizon and your declared daily minutes. It never
                  silently exceeds the budget.
                </p>
              </div>
            </div>
          </div>

          <ol className="grid gap-3 sm:grid-cols-2">
            {workflow.map(([number, title, body]) => (
              <li key={number} className="card card-tight flex gap-3 p-4">
                <span className="font-mono text-[0.68rem] font-semibold text-[#b08a3e]">{number}</span>
                <div>
                  <h3 className="text-[0.9rem]">{title}</h3>
                  <p className="mt-1 text-[0.77rem] leading-relaxed text-[#68776e]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#12382d] text-[#edf3ed]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="eyebrow text-[#8fc9ad]">What the product refuses to do</p>
              <h2 className="display-lg mt-3 text-[#fbfbf4]">Trust has to be engineered.</h2>
            </div>
            <Link href="/privacy" className="inline-flex items-center gap-1 text-[0.8rem] font-medium text-[#c8ddcf] hover:underline">
              Read the privacy notice
              <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {promises.map((promise) => (
              <article key={promise.title} className="rounded-xl border border-[#2c5746] bg-[#174535]/60 p-5">
                <promise.icon size={18} className="text-[#8fc9ad]" aria-hidden />
                <h3 className="mt-3 text-[0.98rem] text-[#fbfbf4]">{promise.title}</h3>
                <p className="mt-2 text-[0.81rem] leading-relaxed text-[#bed0c3]">{promise.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="card-forest relative overflow-hidden p-7 sm:p-10">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#2fa77a]/20 blur-3xl" aria-hidden />
          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-xl">
              <p className="eyebrow text-[#8fc9ad]">Try the loop</p>
              <h2 className="display-lg mt-3 text-[#fbfbf4]">See a seeded workspace before you upload anything.</h2>
              <p className="mt-4 text-[0.9rem] leading-relaxed text-[#bcd0c2]">
                The demo contains a coherent Biology workspace: three indexed sources, a topic map,
                baseline and follow-up attempts, mastery history and a versioned revision plan. Enter
                with one click; no password is shared.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <DemoLaunchButton label="Enter demo workspace" className="btn btn-gold btn-lg" />
              <Link href="/demo-access" className="btn btn-ghost btn-sm text-[#c8ddcf] hover:bg-white/10">
                How the demo works
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
