# Scoring and Gap Analysis

Everything in this document is computed by application code in
`src/lib/domain` and `src/lib/services`. No language model decides marks,
mastery, evidence sufficiency, or plan priority.

The method is intentionally simple and inspectable. It is a study aid, not a
psychometric instrument; see the caveats at the end.

---

## 1. Marks

Marks are assigned by `marksFor(type, difficulty)`:

| Type | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Multiple choice | 1 | 1 | 2 |
| Short answer | 2 | 3 | 4 |

A model may propose question content, but the application assigns the marks. The
value is stored with the question (`questions.marks`) and copied into the answer
(`answers.max_marks`) at submission time, so a later question edit cannot rewrite
history.

## 2. Multiple-choice scoring

`scoreMultipleChoice` is exact and deterministic:

1. If the stored correct index is missing or out of range, the question is scored
   `0` and labelled unattemptable.
2. If no option was selected, the answer is `0`, incorrect, with feedback asking
   the learner to review the source.
3. If the selected index is not an integer in `[0, optionCount)`, the answer is
   `0`, incorrect.
4. Exactly matching the correct index earns full marks.
5. Otherwise `0`.

There is no partial credit for a multiple-choice question.

## 3. Short-answer scoring

### 3.1 Deterministic rubric coverage (baseline)

`evaluateConceptCoverage` normalises both the answer and each rubric concept
(lowercase, NFKD, punctuation to spaces, whitespace collapsed) and tests:

- direct substring containment, or
- at least 75% of the concept's content tokens (length ≥ 3) appear, allowing a
  prefix match for tokens of length ≥ 4.

```
fraction = matched concepts / total concepts
```

Score conversion (`scoreFromFraction`):

```
clamped  = clamp(fraction, 0, 1)
raw      = clamped × marks
score    = min(marks, round(raw × 2) / 2)     // nearest half mark
```

Correctness labels (`correctnessFromFraction`):

| Fraction | Label |
| --- | --- |
| ≥ 0.85 | correct |
| ≥ 0.40 | partial |
| < 0.40 | incorrect |

Feedback lists covered and missing concepts. This is **concept coverage**, not a
semantic judgement of correctness; an answer can mention all concepts and still
be logically wrong. The limitation is documented and visible to the learner.

### 3.2 Optional model grading

When a Gemini key is configured, the short answer may also be graded against the
rubric and source passages. The model returns `scoreFraction` plus matched and
missing concepts. The result is:

- validated by `llmEvaluationSchema`,
- clamped to `[0, 1]`,
- converted with the same `scoreFromFraction`,
- labelled `gemini` in `answers.evaluation_method`.

If the model fails, returns invalid output, or no key exists, the deterministic
score is used and labelled `deterministic-*`. A model score never exceeds the
mark ceiling and never changes the stored maximum.

### 3.3 Attempt total

The attempt score is the sum of answer scores; `total_marks` is the sum of
maxima. Percentages are derived for display only and are not used for mastery.

## 4. Mastery

Defined in `src/lib/domain/mastery.ts`, method version `weighted-marks-v1`.

### 4.1 Evidence gathered

For a topic, mastery aggregates **all submitted answers** across the learner's
attempts in that subject, ordered chronologically. Each answer carries:
`score`, `maxMarks`, `difficulty`, and its question ID.

### 4.2 Difficulty weighting

```
weight(easy)   = 1.00
weight(medium) = 1.25
weight(hard)   = 1.50

weightedEarned   = Σ min(score, maxMarks)   × weight
weightedPossible = Σ maxMarks               × weight

mastery = round(100 × weightedEarned / weightedPossible)
```

If `weightedPossible` is zero, mastery is `null`.

### 4.3 Sufficiency gate

A mastery figure is only reported when **all** of these hold:

- at least **2** submitted answers,
- at least **3** total marks available,
- at least **2** distinct questions.

Otherwise the topic is **Not assessed**, regardless of any computed percentage.
This prevents a single lucky or unlucky question from being presented as a
measured weakness.

### 4.4 Bands

| Mastery | Classification |
| --- | --- |
| 0–49 | Weak |
| 50–79 | Developing |
| 80–100 | Strong |
| insufficient evidence | Not assessed |

Bands are provisional reporting thresholds, not validated educational cut
scores.

### 4.5 Snapshots

After each submission, `refreshMasteryForAttempt` recomputes mastery for every
topic touched by that attempt and appends a `mastery_snapshots` row. Snapshots
are append-only:

- previous assessments are never rewritten,
- a duplicate snapshot for the same `(owner, topic, attempt)` is skipped,
- topic trends and mastery changes are derived from the two most recent
  snapshots.

A change is only shown when both snapshots have a numeric mastery; otherwise the
change is `null`, not zero.

## 5. Gap report

`getGapReport(ownerId, subjectId)` produces a report over **leaf topics** only
(topics with no children), because a parent grouping is not itself an assessable
unit.

### 5.1 Summary

```
leaves, assessed, weak, developing, strong, notAssessed, attemptsConsidered
```

`assessed = weak + developing + strong`. `notAssessed` is explicit and is never
merged into `weak`.

### 5.2 Per-topic fields

- classification and numeric mastery (or `null`),
- sufficiency plus evidence counts (answers and marks),
- question count and linked source count,
- last assessed timestamp,
- mastery change vs the previous snapshot,
- confidence label,
- recommended action,
- measured-weakness flag,
- recent evidence (up to 6 submitted answers with a citation snapshot),
- top missing concepts from incorrect/partial answers,
- prerequisite hypotheses.

### 5.3 Confidence

| Condition | Confidence |
| --- | --- |
| Not sufficient | `insufficient` |
| ≥ 4 answers and ≥ 8 marks | `moderate` |
| sufficient but below that | `limited` |

Confidence describes the amount of evidence, not the learner's ability.

### 5.4 Missing concepts

`answers.missing_concepts_json` is aggregated for non-correct answers on the
topic, counted, sorted descending, and truncated to 6. These are the rubric
concepts the deterministic or model grader did not find, not a claim about what
the learner does not understand.

### 5.5 Recommended action

| Classification | Recommendation |
| --- | --- |
| weak | Revisit the cited passages, then retake a short diagnostic |
| developing | Review missing concepts, compare with passages, attempt a mixed set |
| strong | Keep warm with a short practice set before the exam |
| not assessed | Take a short diagnostic before allocating revision time |

### 5.6 Prerequisite hypotheses

An explicit dependency between topics is stored in `topic_dependencies`. A
hypothesis is marked **supported** only when:

- the prerequisite is measured **weak**, **and**
- the dependent topic is measured **weak or not assessed**.

Even then it is labelled `supported_hypothesis` with a message stating it is
inferred, not measured. If the prerequisite is not assessed, or is developing
or strong, the hypothesis is explicitly **not supported**. The report never
asserts causation.

## 6. Revision planning

Defined in `src/lib/domain/planner.ts`.

### 6.1 Priority

```
weakness   = not_assessed ? 0.5 : clamp((100 - mastery) / 100, 0, 1)
importance = clamp(syllabusImportance / 100, 0, 1)
urgency    = clamp(1 - daysRemaining / 30, 0.15, 1)

priority = (0.50 × weakness + 0.30 × importance + 0.20 × urgency) × 100
           + (prerequisiteWeak ? 4 : 0)
```

Notes:

- An **unassessed** topic uses a neutral `0.5` weakness component. It is never
  treated as if it had been measured at 0%.
- The prerequisite boost is a fixed +4 points, applied only when an explicit
  prerequisite is measured weak.
- Priority is rounded to one decimal and clamped to `[0, 100]`.

### 6.2 Time budget and horizon

```
daysUntilExam = ceil((examDateUTC − todayUTC) / 1 day)
horizonDays   = clamp(daysUntilExam, 1, 14)
capacity      = minutesPerDay × horizonDays
session       = clamp(roundToFive(sessionMinutes), 20, 90)
```

The horizon is capped at **14 days**. A plan never allocates more than capacity:

- a task is only added when the remaining budget is at least 20 minutes,
- each task duration is `min(session, remainingBudget)`,
- allocation stops at **12 tasks**.

Tasks are ranked by priority (importance, then name as tiebreaks). Each topic
gets one task; weak and unassessed topics may get a second, lower-priority
practice task if budget remains. Objectives are chosen by classification
(rebuild foundations / close gaps / maintain / establish a baseline).

### 6.3 Rationale

Every task stores its priority and a human-readable reason: measured mastery (or
"no sufficient assessment evidence yet"), importance, urgency, and any
prerequisite boost. The plan page shows the same breakdown per topic.

### 6.4 Versioning and completed work

`createRevisionPlan`:

1. loads the previous active plan (if any),
2. computes the new plan,
3. inserts the new plan as `version = previous.version + 1`, `status = active`,
4. marks the previous plan `superseded`,
5. marks previous completed tasks as carried history (the old plan row and its
   completed tasks remain queryable),
6. writes new pending tasks.

Completed task history is therefore preserved in the superseded plan and shown
in the plan history section. A new plan does not silently erase what was done.

### 6.5 Adaptation after an assessment

After a successful submission, `refreshActivePlanAfterAssessment` runs when an
active plan exists and the exam date is still in the future. It rebuilds the
plan from the latest mastery using the same declared budget and exam date,
records `trigger = new_assessment`, and writes a change summary such as:

- topics newly entering the focused set,
- topics dropped for lack of capacity,
- a change of top priority,
- mastery movements between snapshots.

If no active plan exists, nothing is created automatically; the learner can build
one from `/revision-plan`.

## 7. What these numbers mean — and do not mean

- **Mastery is demonstrated performance on generated questions**, not ability,
  intelligence, or syllabus coverage.
- **Not assessed is not zero.** It means there is not enough evidence yet.
- **Weak is not a diagnosis.** It means the learner scored below 50% on the
  available evidence for that topic.
- **Confidence is evidence volume**, not statistical confidence.
- **Prerequisite hypotheses are inferences**, clearly labelled, and never
  presented as measured findings.
- **Plan priority is a scheduling heuristic**, not a prediction of exam marks.
- The deterministic grader measures concept coverage, not argument quality.
- Bands and weights are provisional and should be validated with real learners
  before any high-stakes use.

## 8. Tested behaviour

The Vitest suite asserts, among other things:

- exact full-mark scoring for correct MCQ/short answers,
- `Not assessed` below the evidence minimum even when an attempt exists,
- unassessed topics never reported as weak,
- plan task count ≤ 12 and allocated minutes ≤ capacity,
- completed tasks preserved after a retake creates a new plan version,
- plan version increments with `trigger = new_assessment`,
- mastery and topic trends appear only after submitted evidence.
