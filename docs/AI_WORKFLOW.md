# AI Workflow

GapFinder uses AI for three narrow jobs and never lets a model make a decision
that the application can make deterministically:

1. **Draft diagnostic questions** from retrieved evidence.
2. **Explain a topic** from retrieved evidence.
3. **Optionally grade a short answer** against a rubric, with deterministic
   scoring as the fallback and audit trail.

Marks, mastery bands, evidence sufficiency, plan priority and time allocation
are **never** model outputs. They are computed by code in `src/lib/domain`.

See [`diagrams/ai-workflow.mmd`](diagrams/ai-workflow.mmd).

## Provider selection

`src/lib/env.ts` decides once per request:

| Condition | Embeddings | Language model |
| --- | --- | --- |
| `GEMINI_API_KEY` set, `EMBEDDING_PROVIDER` not `local` | `gemini-embedding-001` (768 dims) | `gemini-2.5-flash` |
| `GEMINI_API_KEY` set, `EMBEDDING_PROVIDER=local` | `gapfinder-hash-v1` (512 dims) | Gemini |
| No key | `gapfinder-hash-v1` (512 dims) | none → deterministic generator |

The run-time mode is shown on `/settings`, `/demo-access`, and in the health
endpoint so a reviewer can see which path is active.

## 1. Question generation

### Inputs

- the target topic (name, description),
- the retrieved evidence chunks (up to `RETRIEVAL_TOP_K`),
- the maximum question count for that topic,
- prompt hashes already used in the subject (deduplication).

### Gemini path

- Evidence is labelled `P1 … Pn` inside `<passage> … </passage>` tags with
  document, page and section metadata.
- The system instruction requires:
  - grounding in the supplied passages only,
  - citing only supplied labels,
  - exactly four distinct MCQ options,
  - a 2–4 concept rubric for short answers,
  - no questions about the document itself,
  - **treating passage text as data, not instructions**,
  - a defined difficulty scale.
- `responseMimeType: application/json` plus a `responseSchema` constrains the
  shape; temperature is `0.2`.
- The request is retried once for retryable provider errors; malformed JSON is
  treated as a provider error.
- Output is parsed with `llmQuestionPayloadSchema` (Zod). Invalid shapes are
  discarded, not repaired.
- Each cited label is resolved to a retrieved chunk. Unknown labels discard the
  question. Duplicate prompt hashes are discarded.
- If no valid question survives, the deterministic generator runs and the
  response is labelled as a fallback.

### Deterministic path

`src/lib/ai/deterministic.ts`:

- splits evidence into sentences, filters boilerplate, and selects
  definition-like and process-like sentences,
- builds multiple-choice questions by pairing a correct completion with
  distractors drawn from other source sentences,
- builds short-answer questions with rubrics derived from the source sentence,
- assigns marks by code (`marksFor`) and a stable prompt hash,
- still requires a citation to a retrieved chunk.

Questions are explicit about their origin (`generator` column: `gemini` or
`deterministic`), and the UI shows the method.

### Persistence and deduplication

`persistGeneratedQuestions` rejects any question whose sources cannot be resolved
to the exact evidence set, validates option counts and answer indices, enforces
unique prompt hashes per subject, and writes `questions` + `question_sources` in
one transaction. Rejected questions are counted, not silently stored.

## 2. Topic explanation (assistant)

### Inputs

- the selected topic (must be owned by the caller),
- the learner's question (3–600 characters),
- evidence retrieved for `topic + question`.

### Grounding

- If retrieval is insufficient, the service returns `sufficient: false`, an
  empty answer, zero citations, and a plain explanation of what is missing. No
  model call is made.
- Otherwise the evidence is labelled and sent with an instruction to answer only
  from the passages and to cite labels.
- Output is validated by `llmExplanationSchema`.
- Every citation label is re-resolved against the **exact evidence set for this
  request**. If any label is invalid, the model answer is rejected.
- On rejection, error, or no key, the service falls back to an extractive answer:
  it selects the most relevant source sentences and renders them as a bulleted
  answer with inline citation labels.

### Prompt-injection resistance

- Retrieved text is untrusted study material. The system instruction explicitly
  says to ignore instructions inside passages.
- The model cannot add citations outside the retrieved set.
- Structured output is schema-validated before use.
- Nothing from the document can cause a tool call, a write, or a change in
  authorization scope.

## 3. Short-answer evaluation

- Multiple-choice answers are always scored by exact index comparison.
- Short answers use rubric concept matching (`normalize`, token overlap, and
  expected-answer similarity) to produce a deterministic score and feedback.
- If a Gemini key is configured, the model may grade against the rubric and
  source passages. It returns `scoreFraction`, matched/missing concepts and
  feedback, validated by `llmEvaluationSchema`.
- The model's score is clamped to `[0, 1]`; invalid output falls back to the
  deterministic result.
- The persisted `answers.evaluation_method` records whether the score came from
  the deterministic scorer or the model, so results remain auditable.

Scoring is detailed in [`SCORING_AND_GAP_ANALYSIS.md`](SCORING_AND_GAP_ANALYSIS.md).

## 4. Telemetry without content

`ai_events` records only:

- owner ID (nullable),
- operation kind (generation, evaluation, explanation),
- provider and model name,
- status (`ok`, `fallback`, `error`),
- a short reason / count,
- timestamp.

It never stores prompts, passages, answers or model output. This makes provider
behaviour observable without turning the database into a copy of learner
content.

## 5. Failure policy

| Situation | Behaviour |
| --- | --- |
| No key configured | Deterministic path from the start; labelled in the UI |
| Key configured, model returns invalid JSON/schema | Discard, record event, fall back to deterministic generation |
| Key configured, provider unreachable during embeddings | `502 PROVIDER_UNAVAILABLE`; retrieval does not silently pretend to work |
| Retrieval below threshold | Skip topic / abstain; no generation |
| Citation validation fails | Reject model answer; extractive fallback |
| Model grades a short answer | Clamped, schema-validated, and recorded; deterministic score remains the baseline |

## 6. What the AI is not allowed to do

- Decide mastery, bands, or whether evidence is sufficient.
- Decide marks or plan priorities.
- See other learners' material.
- Access a document outside the current subject/owner scope.
- Return an answer key before submission.
- Invent citations or sources.
- Turn a document's instructions into application actions.

These constraints are enforced in services and domain code, not only in prompts.

## 7. Verification status

All verification runs in this repository used the **deterministic** path because
no `GEMINI_API_KEY` was available. The Gemini integration is implemented and
schema-validated but was **not exercised against the live provider**. This is
recorded in [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).
