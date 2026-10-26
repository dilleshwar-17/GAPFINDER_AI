import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Fingerprint,
  Gauge,
  Headphones,
  Layers,
  ListChecks,
  Lock,
  Mic,
  Quote,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Timer,
  Volume2,
  Waves,
} from "lucide-react";
import { DemoLaunchButton } from "@/components/auth-forms";

const workflow = [
  {
    number: "01",
    title: "Upload",
    body: "A syllabus, your notes and a past paper. Text is extracted and chunked with page and heading provenance.",
  },
  {
    number: "02",
    title: "Map",
    body: "Headings become a topic map. Every topic keeps a link back to the chunk it came from.",
  },
  {
    number: "03",
    title: "Diagnose",
    body: "A short diagnostic samples up to three topics and three questions per topic, drawn only from your material.",
  },
  {
    number: "04",
    title: "Plan",
    body: "Weakness, importance and urgency are scored inside the daily minutes and session length you declare.",
  },
  {
    number: "05",
    title: "Learn",
    body: "Ask BUDDY by voice or text. Read the cited passage, then log what you actually understood.",
  },
  {
    number: "06",
    title: "Retest",
    body: "A new diagnostic updates mastery and versions the plan. Completed tasks stay in the history.",
  },
];

const guarantees = [
  {
    icon: Quote,
    title: "Citations resolve or the answer is dropped",
    body: "Model output is accepted only when every source label maps to a chunk retrieved for that request. Otherwise the app falls back to labelled extractive text.",
  },
  {
    icon: Fingerprint,
    title: "No answer key before you submit",
    body: "Expected answers, rubrics and scoring are withheld from the quiz payload until an attempt is submitted. The browser never receives the key early.",
  },
  {
    icon: Lock,
    title: "Every lookup is scoped to its owner",
    body: "Subjects, documents, topics, attempts, plans and conversations are checked against the signed-in user on the server. Session cookies are HTTP-only and stored hashed.",
  },
  {
    icon: CheckCircle2,
    title: "Thin evidence is reported as thin",
    body: "Two answers, three marks and two distinct questions are required before a topic is scored. Anything below the floor is shown as not assessed.",
  },
];

const bands = [
  {
    label: "Weak",
    range: "0–49",
    className: "band-weak",
    body: "Marks are being lost on core ideas. The planner raises these topics first.",
  },
  {
    label: "Developing",
    range: "50–79",
    className: "band-developing",
    body: "The idea is partly there. The next step is retrieval practice, not re-reading.",
  },
  {
    label: "Strong",
    range: "80–100",
    className: "band-strong",
    body: "Evidence is consistent. Keep it warm with spaced checks, not more notes.",
  },
];

const faqs = [
  {
    question: "Is BUDDY just a general chatbot?",
    answer:
      "No. BUDDY retrieves passages from the material indexed for that subject and answers from those passages. If the retrieved evidence is too thin, it abstains instead of guessing. Every answer shows the document, page and excerpt it used.",
  },
  {
    question: "What happens if no AI provider is configured?",
    answer:
      "The app still runs. It uses deterministic, source-grounded question generation and a labelled extractive answer fallback. Embeddings fall back to a local non-neural hash method, so retrieval is weaker but remains inspectable.",
  },
  {
    question: "Does the shared demo change its data?",
    answer:
      "No. The demo is a read-only sample workspace. Practice diagnostics are scored for you, but they do not write mastery history or version the sample plan. Uploads and workspace edits are blocked on the server.",
  },
  {
    question: "Are the mastery bands official?",
    answer:
      "No. They are provisional heuristics, not validated educational thresholds and not an official grade. Use them to decide what to study next, then check the cited source before relying on a figure.",
  },
  {
    question: "How do voice and live transcription work?",
    answer:
      "Dictation uses your browser's Web Speech API and shows interim and final words while you speak. Spoken replies use the browser speech synthesizer, with live word highlighting where the browser reports boundary events. Audio is not stored by GapFinder, and unsupported browsers fall back to typing and reading.",
  },
  {
    question: "Where is my material stored?",
    answer:
      "In the database of this deployment. Extracted text and embeddings are sent to the configured AI provider only when that provider is enabled. Check the privacy notice and the deployment notes for the exact configuration.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="landing-hero relative overflow-hidden">
        <div className="landing-dots pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <Link
              href="#buddy"
              className="landing-announce group inline-flex items-center gap-2 rounded-full border border-[#d9d6fe] bg-white/80 py-1 pl-1.5 pr-3.5 text-[0.72rem] font-medium text-[#475467] shadow-sm backdrop-blur"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7a5af8] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-white">
                <AudioLines size={12} aria-hidden />
                New
              </span>
              BUDDY listens and speaks — with a live transcript
              <ArrowRight
                size={12}
                className="text-[#7a5af8] transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>

            <h1 className="display-xl mx-auto mt-6 max-w-[19ch] text-[#171f2e]">
              Study the gaps.
              <span className="landing-gradient-text"> Not the whole syllabus.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[1.03rem] leading-relaxed text-[#475467]">
              GapFinder AI turns your syllabus and notes into a cited diagnostic, an honest gap
              report and a revision plan that fits the time you actually have. BUDDY answers by voice
              or text — and shows the passage behind every claim.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="btn btn-primary btn-lg">
                Start with your own material
                <ArrowRight size={16} aria-hidden />
              </Link>
              <DemoLaunchButton label="Open the sample workspace" className="btn btn-secondary btn-lg" />
            </div>

            <p className="mx-auto mt-4 max-w-xl text-[0.74rem] leading-relaxed text-[#667085]">
              One-click demo. No password is published. Practice attempts are scored but never change
              the shared sample plan.
            </p>
          </div>

          <div className="relative mx-auto mt-12 max-w-5xl">
            <div
              className="absolute -inset-x-6 -top-6 bottom-6 rounded-[32px] bg-[#7a5af8]/10 blur-2xl"
              aria-hidden
            />
            <div className="landing-console relative">
              <div className="flex flex-wrap items-center gap-3 border-b border-[#eaecf0] px-4 py-2.5 sm:px-5">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f97066]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#fdb022]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#32d583]" />
                </span>
                <span className="font-mono text-[0.66rem] tracking-[0.04em] text-[#667085]">
                  gapfinder / biology / buddy
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5">
                  <span className="badge badge-demo">Sample workspace</span>
                  <span className="hidden text-[0.65rem] text-[#667085] sm:inline">
                    Illustrative preview
                  </span>
                </span>
              </div>

              <div className="grid lg:grid-cols-[168px_1fr_216px]">
                <aside className="hidden border-r border-[#eaecf0] bg-[#fcfcfd] p-3 lg:block">
                  <p className="px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                    Workspace
                  </p>
                  <div className="mt-2 space-y-1">
                    <span className="flex items-center gap-2 rounded-lg bg-[#f4f3ff] px-2 py-1.5 text-[0.76rem] font-medium text-[#5925dc]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#7a5af8]" aria-hidden />
                      Biology
                    </span>
                    <span className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.76rem] text-[#667085]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#d0d5dd]" aria-hidden />
                      Chemistry
                    </span>
                  </div>
                  <p className="mt-5 px-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                    Topic map
                  </p>
                  <div className="mt-2 space-y-1.5 px-2">
                    {[
                      ["Photosynthesis", "#f04438"],
                      ["Cellular respiration", "#f79009"],
                      ["Cell organelles", "#12b76a"],
                      ["Cell membrane", "#12b76a"],
                    ].map(([name, dot]) => (
                      <span
                        key={name}
                        className="flex items-center gap-2 text-[0.7rem] text-[#475467]"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: dot }}
                          aria-hidden
                        />
                        <span className="truncate">{name}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 rounded-lg border border-[#eaecf0] bg-white px-2.5 py-2">
                    <p className="text-[0.58rem] uppercase tracking-[0.1em] text-[#667085]">
                      Indexed
                    </p>
                    <p className="mt-0.5 text-[0.74rem] font-medium text-[#344054]">
                      3 sources · indexed
                    </p>
                  </div>
                </aside>

                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ebe9fe] text-[#5925dc]">
                        <Sparkles size={14} aria-hidden />
                      </span>
                      <div>
                        <p className="text-[0.8rem] font-semibold text-[#1d2939]">BUDDY</p>
                        <p className="text-[0.64rem] text-[#667085]">Source-locked study assistant</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a6f4c5] bg-[#ecfdf3] px-2.5 py-1 text-[0.64rem] font-medium text-[#027a48]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#12b76a]" aria-hidden />
                      Listening
                    </span>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <div className="max-w-[85%] rounded-[14px] rounded-br-[4px] bg-[#7a5af8] px-3.5 py-2.5 text-[0.78rem] leading-relaxed text-white">
                      Why does the Calvin cycle need both ATP and NADPH?
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7] text-[#5925dc]">
                      <Sparkles size={11} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 rounded-[14px] rounded-tl-[4px] border border-[#eaecf0] bg-white px-3.5 py-3">
                      <p className="text-[0.78rem] leading-relaxed text-[#475467]">
                        Your notes describe the Calvin cycle as using ATP and NADPH to fix carbon
                        dioxide into glucose. ATP supplies the energy for the reactions; NADPH supplies
                        the reducing power.
                      </p>
                      <div className="citation mt-2.5">
                        <p className="text-[0.62rem] font-semibold text-[#5925dc]">
                          demo-notes.txt · page 2
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[0.66rem] leading-relaxed text-[#475467]">
                          “The Calvin cycle is a sequence of enzyme-controlled reactions that use ATP
                          and NADPH to fix carbon dioxide into glucose.”
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.6rem] text-[#667085]">
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck size={10} aria-hidden />
                          Citation checked
                        </span>
                        <span aria-hidden>·</span>
                        <span>6 passages retrieved</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#d9d6fe] bg-[#f4f3ff] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-[#5925dc]">
                        <Volume2 size={11} aria-hidden />
                        BUDDY speaking · live captions
                      </span>
                      <span className="font-mono text-[0.6rem] text-[#7a5af8]">42%</span>
                    </div>
                    <div className="mt-2 flex items-end gap-[3px]" aria-hidden>
                      {[8, 14, 20, 11, 24, 16, 9, 22, 13, 18, 7, 15, 21, 10, 17, 12, 23, 8].map(
                        (height, index) => (
                          <span
                            key={`${height}-${index}`}
                            className="voice-bar w-[3px] rounded-full bg-[#7a5af8]"
                            style={{ height, animationDelay: `${index * 70}ms` }}
                          />
                        ),
                      )}
                    </div>
                    <p className="mt-2 text-[0.7rem] leading-relaxed text-[#475467]">
                      <span className="text-[#344054]">Your notes describe the Calvin cycle as</span>{" "}
                      <span className="rounded bg-[#ded9ff] px-0.5 font-medium text-[#5925dc]">
                        using ATP and NADPH
                      </span>{" "}
                      <span className="text-[#667085]">to fix carbon dioxide into glucose…</span>
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-full border border-[#d0d5dd] bg-white py-1.5 pl-3.5 pr-1.5">
                    <Mic size={13} className="text-[#7a5af8]" aria-hidden />
                    <span className="truncate text-[0.72rem] text-[#98a2b3]">
                      Ask a question, or press Speak…
                    </span>
                    <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#171f2e] text-white">
                      <ArrowRight size={12} aria-hidden />
                    </span>
                  </div>
                </div>

                <aside className="border-t border-[#eaecf0] bg-[#fcfcfd] p-4 lg:border-l lg:border-t-0">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                    Measured now
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[#b54708]">
                      71
                    </span>
                    <span className="text-[0.7rem] text-[#667085]">/ 100 · Developing</span>
                  </div>
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-[#667085]">
                    Cell organelles · difficulty-weighted marks
                  </p>
                  <div className="meter meter-developing mt-2.5">
                    <span style={{ width: "71%" }} />
                  </div>

                  <p className="mt-5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#667085]">
                    Evidence floor
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[0.68rem] text-[#475467]">
                    {["2 answers", "3 marks", "2 distinct questions"].map((item) => (
                      <li key={item} className="flex items-center gap-1.5">
                        <CheckCircle2 size={11} className="text-[#027a48]" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 rounded-lg border border-[#d9d6fe] bg-white px-3 py-2.5">
                    <p className="text-[0.58rem] uppercase tracking-[0.1em] text-[#667085]">Tonight</p>
                    <p className="mt-0.5 text-[0.76rem] font-semibold text-[#1d2939]">
                      25 min · Active recall
                    </p>
                    <p className="mt-0.5 text-[0.66rem] leading-relaxed text-[#667085]">
                      Photosynthesis · priority 1
                    </p>
                  </div>
                </aside>
              </div>
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[0.68rem] leading-relaxed text-[#667085]">
              Illustrative product preview using sample workspace values. A real report only shows
              topics that passed the evidence minimum; everything else is marked not assessed.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#eaecf0] bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            {
              icon: Quote,
              title: "Chunk-level citations",
              body: "Every answer points back to a page and heading.",
            },
            {
              icon: Gauge,
              title: "Rule-based mastery",
              body: "Marks, not vibes. The formula is documented.",
            },
            {
              icon: Timer,
              title: "Time-aware plans",
              body: "Capped at 14 days and your daily minutes.",
            },
            {
              icon: Lock,
              title: "Read-only demo",
              body: "Explore the whole loop without changing sample data.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f3ff] text-[#7a5af8]">
                <item.icon size={16} aria-hidden />
              </span>
              <div>
                <p className="text-[0.83rem] font-semibold text-[#1d2939]">{item.title}</p>
                <p className="mt-0.5 text-[0.73rem] leading-relaxed text-[#667085]">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="method" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow">The method</p>
              <h2 className="display-lg mt-3 max-w-[16ch] text-[#171f2e]">
                One loop. Every step leaves a trace.
              </h2>
              <p className="mt-4 max-w-md text-[0.94rem] leading-relaxed text-[#475467]">
                The product is deliberately sequenced: no diagnosis before retrieval, no plan before
                evidence, and no claim without a source you can open. Each turn around the loop
                should leave you with fewer unknowns than the last.
              </p>
              <div className="mt-6 rounded-xl border border-[#eaecf0] bg-[#fcfcfd] p-4">
                <p className="inline-flex items-center gap-2 text-[0.69rem] font-semibold uppercase tracking-[0.12em] text-[#5925dc]">
                  <ScanSearch size={13} aria-hidden />
                  The rule that shapes everything
                </p>
                <p className="mt-2 text-[0.82rem] leading-relaxed text-[#475467]">
                  If retrieval cannot support the question or the explanation, GapFinder abstains.
                  Abstaining is a feature, not a failure state.
                </p>
              </div>
            </div>

            <ol className="relative space-y-3">
              <span
                className="absolute bottom-8 left-[22px] top-8 hidden w-px bg-gradient-to-b from-[#d9d6fe] via-[#bdb4fe] to-transparent sm:block"
                aria-hidden
              />
              {workflow.map((step) => (
                <li key={step.number} className="card relative flex gap-4 p-4 sm:p-5">
                  <span className="z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d9d6fe] bg-white font-mono text-[0.7rem] font-semibold text-[#6938ef] shadow-sm">
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[0.98rem]">{step.title}</h3>
                    <p className="mt-1 text-[0.81rem] leading-relaxed text-[#667085]">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="buddy" className="scroll-mt-24 border-y border-[#eaecf0] bg-[#fcfcfd]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.92fr]">
            <div>
              <p className="eyebrow inline-flex items-center gap-2">
                <AudioLines size={14} aria-hidden />
                BUDDY has a voice
              </p>
              <h2 className="display-lg mt-3 max-w-[17ch] text-[#171f2e]">
                Speak your question. Watch it become evidence.
              </h2>
              <p className="mt-4 max-w-lg text-[0.94rem] leading-relaxed text-[#475467]">
                BUDDY shows what it hears while you speak, answers only from your indexed material,
                and reads the reply back with live word highlighting. Captions stay in sync where
                your browser reports speech boundaries.
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: Mic,
                    title: "Live dictation",
                    body: "Interim words appear in violet while you speak; final words settle into the transcript.",
                  },
                  {
                    icon: Volume2,
                    title: "Read-aloud captions",
                    body: "Toggle auto-read, or press Listen on any answer. Stop at any time.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Browser-only audio",
                    body: "GapFinder stores no recordings. Unsupported browsers fall back to text.",
                  },
                  {
                    icon: Quote,
                    title: "Sources on screen",
                    body: "Each reply carries the document, page and excerpt it used.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-[#eaecf0] bg-white p-4">
                    <item.icon size={16} className="text-[#7a5af8]" aria-hidden />
                    <p className="mt-2 text-[0.84rem] font-semibold text-[#1d2939]">{item.title}</p>
                    <p className="mt-1 text-[0.76rem] leading-relaxed text-[#667085]">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div
                className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-[#7a5af8]/18 via-transparent to-[#ff58d5]/12 blur-xl"
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-[22px] border border-[#eaecf0] bg-white shadow-[0_20px_60px_-24px_rgba(16,24,40,0.28)]">
                <div className="flex items-center justify-between gap-2 border-b border-[#eaecf0] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ebe9fe] text-[#5925dc]">
                      <Waves size={13} aria-hidden />
                    </span>
                    <span className="text-[0.78rem] font-semibold text-[#1d2939]">
                      Voice session
                    </span>
                  </div>
                  <span className="badge badge-outline">Illustrative</span>
                </div>

                <div className="space-y-4 p-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#667085]">
                        You · live transcript
                      </p>
                      <span className="inline-flex items-center gap-1 text-[0.62rem] font-medium text-[#5925dc]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7a5af8]" aria-hidden />
                        Listening
                      </span>
                    </div>
                    <div className="mt-2 rounded-xl border border-[#d9d6fe] bg-[#f4f3ff] px-3.5 py-3">
                      <p className="text-[0.8rem] leading-relaxed text-[#344054]">
                        Explain the difference between{" "}
                        <span className="font-medium text-[#5925dc]">the light reactions</span>{" "}
                        <span className="text-[#98a2b3]">and the Calvin cycle…</span>
                      </p>
                      <div className="mt-2 flex items-end gap-[3px]" aria-hidden>
                        {[7, 12, 18, 10, 22, 15, 8, 19, 11, 16, 9, 20, 13].map((height, index) => (
                          <span
                            key={`${height}-${index}`}
                            className="voice-bar w-[3px] rounded-full bg-[#7a5af8]/70"
                            style={{ height, animationDelay: `${index * 80}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#667085]">
                      BUDDY · speaking with captions
                    </p>
                    <div className="mt-2 rounded-xl border border-[#eaecf0] bg-[#fcfcfd] px-3.5 py-3">
                      <p className="text-[0.78rem] leading-relaxed text-[#475467]">
                        <span className="text-[#344054]">The light reactions</span>{" "}
                        <span className="rounded bg-[#ded9ff] px-0.5 font-medium text-[#5925dc]">
                          convert light energy into ATP and NADPH
                        </span>{" "}
                        <span className="text-[#667085]">
                          , while the Calvin cycle uses them to fix carbon dioxide into glucose…
                        </span>
                      </p>
                      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#eaecf0]">
                        <span className="block h-full w-[46%] rounded-full bg-[#7a5af8]" />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[0.63rem] text-[#667085]">demo-notes.txt · page 2</span>
                        <span className="text-[0.63rem] font-medium text-[#5925dc]">Stop</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[0.68rem] leading-relaxed text-[#98a2b3]">
                    Microphone access is requested only after you press Speak. Voice behaviour varies
                    by browser; captions fall back to the full reply when boundary events are not
                    available.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#171f2e] text-[#f2f4f7]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="eyebrow text-[#bdb4fe]">The evidence contract</p>
              <h2 className="display-lg mt-3 text-white">Trust has to be engineered.</h2>
              <p className="mt-4 max-w-xl text-[0.92rem] leading-relaxed text-[#bdb4fe]">
                These are product constraints, not marketing copy. When one of them cannot be met,
                the interface says so instead of filling the gap with a guess.
              </p>
            </div>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1 text-[0.8rem] font-medium text-[#d9d6fe] hover:underline"
            >
              Read the privacy notice
              <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {guarantees.map((guarantee, index) => (
              <article
                key={guarantee.title}
                className="rounded-xl border border-[#344054] bg-[#1a2231]/70 p-5"
              >
                <div className="flex items-center justify-between">
                  <guarantee.icon size={18} className="text-[#bdb4fe]" aria-hidden />
                  <span className="font-mono text-[0.62rem] text-[#98a2b3]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-3 text-[0.98rem] text-white">{guarantee.title}</h3>
                <p className="mt-2 text-[0.81rem] leading-relaxed text-[#bdb4fe]">{guarantee.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[#344054] bg-[#0c111d]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1d2939] px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                <ShieldCheck size={12} aria-hidden />
                Answer gate
              </span>
              <span className="font-mono text-[0.62rem] text-[#667085]">
                top 6 · threshold 0.15 · 240-char minimum
              </span>
            </div>
            <div className="grid gap-2 p-4 font-mono text-[0.72rem] leading-relaxed text-[#d0d5dd] sm:grid-cols-3">
              <p>
                <span className="text-[#bdb4fe]">retrieve</span> authorized chunks
              </p>
              <p>
                <span className="text-[#bdb4fe]">verify</span> every source label
              </p>
              <p>
                <span className="text-[#bdb4fe]">render</span> or abstain
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="eyebrow">What the bands mean</p>
            <h2 className="display-lg mt-3 max-w-[15ch] text-[#171f2e]">
              Simple labels. Documented arithmetic.
            </h2>
            <p className="mt-4 max-w-md text-[0.92rem] leading-relaxed text-[#475467]">
              Mastery is a difficulty-weighted marks ratio, not a completion counter. The bands are
              provisional heuristics, and the evidence floor is applied before any score appears.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="badge badge-neutral">2 answers</span>
              <span className="badge badge-neutral">3 marks</span>
              <span className="badge badge-neutral">2 distinct questions</span>
            </div>
            <p className="mt-3 text-[0.76rem] leading-relaxed text-[#667085]">
              Below all three: not assessed. Not zero, not guessed.
            </p>
          </div>

          <div className="grid gap-3">
            {bands.map((band) => (
              <article key={band.label} className={`band-card ${band.className}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[1rem]">{band.label}</h3>
                  <span className="font-mono text-[0.78rem]">{band.range}</span>
                </div>
                <p className="mt-1.5 text-[0.81rem] leading-relaxed">{band.body}</p>
              </article>
            ))}
            <article className="band-card border-[#eaecf0] bg-[#fcfcfd] text-[#475467]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[1rem] text-[#1d2939]">Not assessed</h3>
                <span className="font-mono text-[0.78rem] text-[#667085]">thin evidence</span>
              </div>
              <p className="mt-1.5 text-[0.81rem] leading-relaxed text-[#667085]">
                Shown when the evidence floor is not met. Excluded from weak-topic counts so the plan
                never overreacts to a single wrong answer.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-[#eaecf0] bg-[#fcfcfd]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:py-20">
          <div>
            <p className="eyebrow">A plan that fits the week you have</p>
            <h2 className="display-lg mt-3 max-w-[16ch] text-[#171f2e]">
              No guilt pile. No plan that ignores your calendar.
            </h2>
            <p className="mt-4 max-w-lg text-[0.92rem] leading-relaxed text-[#475467]">
              The planner ranks topics by measured weakness, syllabus importance and exam urgency,
              then fits tasks into your declared daily minutes. After a retest, it versions the plan
              and preserves what you already finished.
            </p>
            <Link href="/signup" className="btn btn-primary mt-6">
              Build your first loop
              <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          <div className="rounded-2xl border border-[#eaecf0] bg-white p-5 shadow-[0_16px_40px_-24px_rgba(16,24,40,0.22)]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#667085]">
                <Layers size={12} aria-hidden />
                Plan v3 · 14-day horizon
              </span>
              <span className="badge badge-demo">Sample</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Today", "Photosynthesis · 25 min", "Priority 1 · weak", true],
                ["Tomorrow", "Cellular respiration · 20 min", "Priority 2 · weak", false],
                ["Day 3", "Cell organelles · 15 min", "Retrieval check", false],
              ].map(([day, title, meta, active]) => (
                <div
                  key={String(title)}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                    active
                      ? "border-[#d9d6fe] bg-[#f4f3ff]"
                      : "border-[#eaecf0] bg-[#fcfcfd]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-[#7a5af8] bg-[#7a5af8] text-white"
                        : "border-[#d0d5dd] bg-white text-transparent"
                    }`}
                  >
                    <CheckCircle2 size={10} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.62rem] uppercase tracking-[0.1em] text-[#667085]">{day}</p>
                    <p className="mt-0.5 text-[0.8rem] font-medium text-[#344054]">{title}</p>
                    <p className="text-[0.7rem] text-[#667085]">{meta}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.68rem] leading-relaxed text-[#667085]">
              Illustrative plan. A real plan is generated from your own locked diagnostic evidence.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.6fr_1fr] lg:items-start">
          <div>
            <p className="eyebrow">Straight answers</p>
            <h2 className="display-lg mt-3 max-w-[12ch] text-[#171f2e]">Ask the awkward questions.</h2>
            <p className="mt-4 max-w-sm text-[0.9rem] leading-relaxed text-[#475467]">
              The limits are part of the product. If something is not configured or not supported,
              the interface says that too.
            </p>
            <Link
              href="/privacy"
              className="mt-5 inline-flex items-center gap-1 text-[0.8rem] font-medium text-[#7a5af8] hover:underline"
            >
              Read the privacy notice
              <ArrowUpRight size={13} aria-hidden />
            </Link>
          </div>
          <div className="divide-y divide-[#eaecf0] overflow-hidden rounded-2xl border border-[#eaecf0] bg-white">
            {faqs.map((faq) => (
              <details key={faq.question} className="faq-item group px-4 py-3.5 sm:px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.86rem] font-medium text-[#1d2939]">
                  {faq.question}
                  <span className="faq-plus shrink-0 text-[#7a5af8]" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-2xl text-[0.8rem] leading-relaxed text-[#475467]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-20">
        <div className="landing-cta relative overflow-hidden rounded-[24px] px-6 py-10 sm:px-10 sm:py-12">
          <div className="landing-dots pointer-events-none absolute inset-0 opacity-30" aria-hidden />
          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-xl">
              <p className="eyebrow text-[#bdb4fe]">Try the loop</p>
              <h2 className="display-lg mt-3 text-white">
                Explore a sample workspace before you upload anything.
              </h2>
              <p className="mt-4 text-[0.9rem] leading-relaxed text-[#d0d5dd]">
                The demo holds a coherent Biology workspace: three indexed sources, a topic map,
                baseline and follow-up attempts, mastery history and a versioned revision plan. One
                click, no password.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-[0.72rem] text-[#bdb4fe]">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpenCheck size={13} aria-hidden />
                  Seeded sources
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardCheck size={13} aria-hidden />
                  Practice safely
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Headphones size={13} aria-hidden />
                  Voice-ready BUDDY
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <DemoLaunchButton label="Enter demo workspace" className="btn btn-primary btn-lg" />
              <Link
                href="/demo-access"
                className="btn btn-ghost btn-sm text-[#d9d6fe] hover:bg-white/10"
              >
                How the demo works
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[0.72rem] text-[#667085]">
          <span className="inline-flex items-center gap-1.5">
            <FileSearch size={13} aria-hidden />
            PDF, TXT and Markdown
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={13} aria-hidden />
            Deterministic scoring
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock size={13} aria-hidden />
            Owner-scoped reads
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={13} aria-hidden />
            Works without an AI key
          </span>
        </div>
      </section>
    </>
  );
}
