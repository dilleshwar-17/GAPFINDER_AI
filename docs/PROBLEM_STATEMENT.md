# Problem Statement

## The problem

Learners preparing for an exam usually have two kinds of material: a syllabus
that says what is examinable, and notes, slides and past papers that contain the
detail. What they rarely have is an honest answer to three questions:

1. **What do I actually not know?** A completed chapter or a highlighted page is
   not evidence of understanding. Guessing at weak areas wastes the limited
   revision time a learner has.
2. **Can I trust the explanation I am given?** A generic chatbot answer may be
   plausible and wrong, may not match the learner's syllabus, and may cite
   nothing. A learner cannot check it without re-reading everything.
3. **What should I do next, given the time I actually have?** A list of every
   topic is not a plan. A plan has to fit a daily budget, respect an exam date,
   and change when new evidence appears.

Most study tools optimise for content volume. GapFinder AI optimises for
**evidence**: what was asked, what was answered, what source supports it, and how
confident the conclusion is.

## Who it is for

- A student revising for a school or university exam with their own material.
- A self-directed learner working through a technical syllabus.
- A reviewer or judge evaluating whether an AI study tool can be grounded,
  auditable, and honest about uncertainty.

## Goals

1. **Ground everything in the learner's own sources.** Questions and
   explanations must be traceable to a specific uploaded chunk, page and
   document.
2. **Refuse when evidence is thin.** If retrieval cannot find enough relevant
   text, the system must say so rather than invent content.
3. **Score deterministically.** Marks, mastery bands and plan priorities are
   computed by application rules, not by a language model.
4. **Never fabricate mastery.** A topic with insufficient evidence is labelled
   **Not assessed**, not given a low or invented score.
5. **Produce an actionable, time-bounded plan.** The plan must fit the declared
   daily budget, preserve completed work, and adapt after new assessments.
6. **Protect the learner's material.** Ownership checks, session security,
   upload limits, and isolated temporary demo sessions are part of the product, not
   afterthoughts.
7. **Show the state of every AI dependency.** The UI must be clear about whether
   neural models or deterministic fallbacks are running, and what that means.

## Non-goals

- Replacing a teacher, examiner, or accredited assessment.
- Claiming diagnostic accuracy that the evidence does not support.
- Generating answer keys and returning them before submission.
- Ingesting arbitrary web content or other learners' material.
- Providing a production multi-tenant hosted service in this build (see
  [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md)).

## Required behaviour (acceptance criteria)

### Accounts and access

- Public sign-up, sign-in, sign-out, and a demo entry point.
- Sessions issued by the server, stored hashed, revocable, and expired.
- Password reset pages must not pretend an email was sent when no mail provider
  is configured.
- Every subject, document, topic, attempt, answer and plan is scoped to its
  owner; cross-user access returns **not found**, not another user's data.

### Materials

- Accept PDF, plain text and Markdown; reject unsupported, empty, corrupt,
  duplicate and oversized files with clear errors.
- Persist the file, extracted text, chunk metadata and embeddings.
- Show processing status and per-chunk provenance.
- Never silently index a corrupt document.

### Diagnostics

- Generate only source-grounded questions.
- Do not expose the answer key before submission.
- Validate submitted answers, prevent duplicate submissions, and reject
  questions that do not belong to the attempt.
- Score multiple-choice and short-answer responses deterministically.
- Link every question to its sources, including after submission.

### Gap analysis and reporting

- Mastery: **Weak 0–49**, **Developing 50–79**, **Strong 80–100**.
- **Not assessed** when evidence is below the minimum (2 answers, 3 marks,
  2 distinct questions).
- Report measured weaknesses, missing concepts, and — clearly labelled as
  hypotheses — possible prerequisite gaps.
- Do not present unmeasured topics as weak.

### Revision planning

- Respect daily minutes, session length, and the exam horizon (capped at 14
  days).
- Cap the number of tasks and never allocate more minutes than capacity.
- Preserve completed task history when a plan is superseded.
- Adapt the active plan after a new submitted assessment.

### Assistant

- Answer only from retrieved evidence for the selected topic.
- Validate every citation against passages retrieved for that request.
- Abstain when evidence is insufficient.
- Treat retrieved text as data, not instructions (prompt-injection resistance).

### Demo

- Visible banner identifying the shared workspace.
- Coherent seeded data: subject, sources, topics, attempts, results, plan.
- A real server-issued session; no published password.
- Read-only except interactive diagnostics/practice.
- Sample citations resolve to the seeded sources.

### Quality

- Responsive, accessible UI with visible focus states and semantic landmarks.
- Custom 404 and error boundaries.
- Lint, typecheck, tests and production build all pass.
- Documentation states what was actually verified and what was not.

## Success criteria for this build

The build succeeds when the app runs end-to-end on real persisted data, the
automated suite passes, the production build compiles, the HTTP smoke suite
passes against a fresh database, and every claim in the documentation can be
traced to a command that was actually run. Where a dependency (hosted database,
live model, deployment platform, browser automation) was unavailable, it is
reported as unavailable rather than simulated.
