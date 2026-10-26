import { randomBytes } from "node:crypto";
import { db, newId, nowIso } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/session";
import { conflict } from "@/lib/errors";
import { daysUntil } from "@/lib/domain/planner";
import { isDemoEnabled } from "@/lib/env";
import { createUser, findUserByEmail } from "@/lib/services/auth";
import {
  createSubject,
  getSubjectOwned,
  updateSubjectExamDate,
} from "@/lib/services/subjects";
import {
  ingestDocument,
  listDocuments,
  retryDocument,
} from "@/lib/services/documents";
import { extractTopics, listLeafTopics } from "@/lib/services/topics";
import { getQuestionOwned, type QuestionRow } from "@/lib/services/questions";
import {
  getQuizView,
  listAttempts,
  startDiagnostic,
  submitAttempt,
} from "@/lib/services/assessment";
import { createRevisionPlan, getActivePlan } from "@/lib/services/plans";

export const DEMO_SUBJECT_NAME = "Biology: Cells and Energy";
export const DEMO_DISPLAY_NAME = "Demo Learner";

export function demoEmail(): string {
  return process.env.DEMO_EMAIL?.trim().toLowerCase() || "demo@gapfinder.local";
}

function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const SYLLABUS = `UNIT 1: Cell Structure and Function

1.1 Cell membrane
The cell membrane controls which substances enter and leave the cell and therefore defines the boundary of the cell.

1.2 Organelles
Organelles are specialised structures inside a cell that carry out particular functions.

UNIT 2: Energy Transfer

2.1 Photosynthesis
Photosynthesis captures light energy and stores it in glucose.

2.2 Cellular respiration
Cellular respiration releases usable energy from glucose in the form of ATP.
`;

const NOTES = `CELL MEMBRANE

The cell membrane is a selectively permeable barrier that controls which substances enter and leave the cell. It consists of a phospholipid bilayer with proteins embedded in it. The fluid mosaic model describes the membrane as a flexible structure in which proteins and lipids move within the bilayer. Small nonpolar molecules can diffuse directly across the membrane, while charged ions require channel proteins. Osmosis is the movement of water across a selectively permeable membrane from a region of low solute concentration to a region of high solute concentration.
\f
CELL ORGANELLES

The mitochondrion is the organelle that carries out aerobic respiration and releases energy as ATP. The ribosome is a small structure that assembles proteins from amino acids. The nucleus is the organelle that stores genetic material and coordinates cellular activities. The Golgi apparatus is a stack of flattened membranes that modifies and packages proteins for transport. Lysosomes are membrane-bound compartments that contain digestive enzymes for breaking down waste.
\f
PHOTOSYNTHESIS

Photosynthesis is the process by which green plants convert light energy into chemical energy stored in glucose. It takes place mainly in the chloroplast, where the pigment chlorophyll absorbs light energy. The light-dependent reactions occur in the thylakoid membranes and produce ATP and NADPH for the next stage. The Calvin cycle is a sequence of enzyme-controlled reactions that use ATP and NADPH to fix carbon dioxide into glucose. Oxygen is released as a by-product when water is split during the light-dependent reactions.
\f
CELLULAR RESPIRATION

Cellular respiration is the controlled release of energy from glucose in the form of ATP. Glycolysis is the first stage of respiration and breaks one glucose molecule into two pyruvate molecules in the cytoplasm. The Krebs cycle is a sequence of reactions in the mitochondria that releases carbon dioxide and produces reduced coenzymes. Oxidative phosphorylation is the process in which an electron transport chain creates a proton gradient that drives ATP synthesis. Anaerobic respiration is the breakdown of glucose without oxygen and produces lactate in animal cells.
`;

const PAST_PAPER = `PAST PAPER: CELL BIOLOGY AND ENERGY

Question 1. Explain how the structure of the cell membrane relates to its function as a selective barrier. A strong answer should refer to the phospholipid bilayer and membrane proteins.

Question 2. Describe the role of chlorophyll in photosynthesis. A strong answer should explain that chlorophyll absorbs light energy in the chloroplast.

Question 3. Compare glycolysis with the Krebs cycle. A strong answer should mention the cytoplasm, pyruvate, the mitochondria, carbon dioxide and reduced coenzymes.
`;

const DEMO_DOCUMENTS = [
  { filename: "demo-syllabus.txt", kind: "syllabus" as const, content: SYLLABUS },
  { filename: "demo-notes.txt", kind: "notes" as const, content: NOTES },
  { filename: "demo-past-paper.txt", kind: "past_paper" as const, content: PAST_PAPER },
];

function textBytes(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

type DemoStrategy = "correct" | "partial" | "wrong";

function strategyForTopic(
  topicName: string,
  index: number,
  profile: "baseline" | "followup",
): DemoStrategy {
  const key = topicName.toLowerCase();
  if (profile === "followup") {
    if (key.includes("photosynthesis")) return "correct";
    if (key.includes("cellular respiration")) return "wrong";
    return "correct";
  }
  if (key.includes("photosynthesis")) return "wrong";
  if (key.includes("cell membrane")) return "correct";
  if (key.includes("cellular respiration")) return index % 2 === 0 ? "correct" : "partial";
  return "partial";
}

async function submitDemoAttempt(
  userId: string,
  subjectId: string,
  attemptId: string,
  profile: "baseline" | "followup",
): Promise<void> {
  const view = await getQuizView(userId, attemptId);
  const topicCounters = new Map<string, number>();
  const answers = await Promise.all(view.questions.map(async (question) => {
    const topicKey = question.topicName.toLowerCase();
    const index = topicCounters.get(topicKey) ?? 0;
    topicCounters.set(topicKey, index + 1);
    const row: QuestionRow = await getQuestionOwned(userId, question.id);
    const strategy = strategyForTopic(question.topicName, index, profile);

    if (question.type === "mcq") {
      const options = parseStringArray(row.options_json);
      const correct = row.correct_index;
      if (correct === null || options.length < 2) {
        return { questionId: question.id, selectedIndex: null };
      }
      return {
        questionId: question.id,
        selectedIndex: strategy === "wrong" ? (correct + 1) % options.length : correct,
      };
    }

    if (strategy === "correct") {
      return { questionId: question.id, answerText: row.expected_answer };
    }
    if (strategy === "partial") {
      const rubric = parseStringArray(row.rubric_json);
      return {
        questionId: question.id,
        answerText: rubric[0] ?? "I remember part of the idea but not the full explanation.",
      };
    }
    return { questionId: question.id, answerText: "I do not know." };
  }));

  await submitAttempt(userId, attemptId, { answers }, { allowDemo: true });
}

async function seedFollowUpAttempt(
  userId: string,
  subjectId: string,
  firstAttemptId: string,
): Promise<string | null> {
  const already = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM quiz_attempts WHERE owner_id = ? AND subject_id = ? AND generator = 'demo-seed-followup'",
    userId,
    subjectId,
  );
  if ((already?.count ?? 0) > 0) return null;

  const idsRaw = await db.get<{ question_ids_json: string }>(
    "SELECT question_ids_json FROM quiz_attempts WHERE id = ? AND owner_id = ?",
    firstAttemptId,
    userId,
  );
  if (!idsRaw) return null;
  const questionIds = parseStringArray(idsRaw.question_ids_json);
  if (questionIds.length === 0) return null;

  const rows = await db.all<QuestionRow & { topic_name: string }>(
    `SELECT q.*, t.name AS topic_name
       FROM questions q JOIN topics t ON t.id = q.topic_id
      WHERE q.owner_id = ? AND q.id IN (${questionIds.map(() => "?").join(",")})`,
    userId,
    ...questionIds,
  );
  const selected = rows.filter((row) => {
    const name = row.topic_name.toLowerCase();
    return name.includes("photosynthesis") || name.includes("cellular respiration");
  });
  if (selected.length < 2) return null;

  const attemptId = newId();
  const totalMarks = selected.reduce((sum, row) => sum + row.marks, 0);
  await db.run(
    `INSERT INTO quiz_attempts
      (id, owner_id, subject_id, status, question_ids_json, total_marks, score, started_at,
       submitted_at, generator)
     VALUES (?, ?, ?, 'in_progress', ?, ?, NULL, ?, NULL, 'demo-seed-followup')`,
    attemptId,
    userId,
    subjectId,
    JSON.stringify(selected.map((row) => row.id)),
    totalMarks,
    nowIso(),
  );
  return attemptId;
}

async function runDemoSeed(userId: string): Promise<string> {
  const existingSubjects = await db.all<{ id: string; name: string }>(
    "SELECT id, name FROM subjects WHERE owner_id = ? AND name = ?",
    userId,
    DEMO_SUBJECT_NAME,
  );
  let subjectId = existingSubjects[0]?.id;
  if (!subjectId) {
    const subject = await createSubject({
      ownerId: userId,
      name: DEMO_SUBJECT_NAME,
      description:
        "Seeded demonstration subject: a short biology syllabus, original notes, and a past paper used to demonstrate the diagnostic loop.",
      examDate: futureDate(21),
      isDemo: true,
      allowDemo: true,
    });
    subjectId = subject.id;
  }

  const subject = await getSubjectOwned(userId, subjectId);
  if (!subject.exam_date || daysUntil(subject.exam_date) < 1) {
    await updateSubjectExamDate(userId, subjectId, futureDate(21), { allowDemo: true });
  }

  const existingDocs = await listDocuments(userId, subjectId);
  for (const definition of DEMO_DOCUMENTS) {
    const match = existingDocs.find((document) => document.filename === definition.filename);
    if (!match) {
      await ingestDocument({
        ownerId: userId,
        subjectId,
        filename: definition.filename,
        mimeType: "text/plain",
        kind: definition.kind,
        bytes: textBytes(definition.content),
        allowDemo: true,
      });
      continue;
    }
    if (match.status === "failed") {
      await retryDocument(userId, match.id, { allowDemo: true });
    }
  }

  if ((await listLeafTopics(userId, subjectId)).length === 0) {
    await extractTopics(userId, subjectId, { allowDemo: true });
  }

  const leaves = await listLeafTopics(userId, subjectId);
  if (leaves.length === 0) {
    throw conflict(
      "The demo subject exists but its topic map could not be created. Reset the demo database and retry.",
    );
  }

  const attempts = await listAttempts(userId, subjectId);
  const submitted = attempts.filter((attempt) => attempt.status === "submitted");
  const baseline = submitted.find((attempt) => attempt.generator === "demo-seed");
  let baselineId = baseline?.id ?? null;

  if (!baselineId) {
    const inProgress = attempts.find(
      (attempt) => attempt.status === "in_progress" && attempt.generator === "demo-seed",
    );
    let attemptId = inProgress?.id;
    if (!attemptId) {
      const preferredNames = ["cell membrane", "photosynthesis", "cellular respiration"];
      const selected = preferredNames
        .map((name) => leaves.find((topic) => topic.name.toLowerCase().includes(name)))
        .filter((topic): topic is (typeof leaves)[number] => Boolean(topic));
      const topicIds = (selected.length > 0 ? selected : leaves.slice(0, 3)).map(
        (topic) => topic.id,
      );
      const result = await startDiagnostic(userId, subjectId, topicIds);
      attemptId = result.attemptId;
    }

    await db.run(
      "UPDATE quiz_attempts SET generator = 'demo-seed' WHERE id = ? AND owner_id = ?",
      attemptId,
      userId,
    );
    try {
      await submitDemoAttempt(userId, subjectId, attemptId, "baseline");
    } catch (error) {
      const stillSubmitted = await db.get<{ status: string }>(
        "SELECT status FROM quiz_attempts WHERE id = ? AND owner_id = ?",
        attemptId,
        userId,
      );
      if (stillSubmitted?.status !== "submitted") throw error;
    }
    baselineId = attemptId;
  }

  if (baselineId) {
    const followUpId = await seedFollowUpAttempt(userId, subjectId, baselineId);
    if (followUpId) {
      try {
        await submitDemoAttempt(userId, subjectId, followUpId, "followup");
      } catch {
        // A partially seeded follow-up is harmless; the baseline remains valid.
      }
    }
  }

  if (!(await getActivePlan(userId, subjectId))) {
    await createRevisionPlan({
      ownerId: userId,
      subjectId,
      request: {
        examDate: futureDate(21),
        minutesPerDay: 60,
        sessionMinutes: 45,
      },
      trigger: "manual",
      allowDemo: true,
    });
  }

  return subjectId;
}

let seedInFlight: Promise<string> | null = null;

export async function ensureDemoWorkspace(userId: string): Promise<string> {
  if (!seedInFlight) {
    seedInFlight = runDemoSeed(userId).finally(() => {
      seedInFlight = null;
    });
  }
  return seedInFlight;
}

/**
 * Provisions (or reuses) the dedicated demo account and seeds its workspace.
 * The account has no published password: the demo route authenticates it with a
 * server-issued session after a rate-limited request. A random password is
 * stored so the account cannot be entered through the regular password form.
 */
export async function ensureDemoAccount(): Promise<AuthUser> {
  if (!isDemoEnabled()) {
    throw conflict("The demo workspace is disabled for this deployment.");
  }
  const email = demoEmail();
  let record = await findUserByEmail(email);

  if (record && record.is_demo !== 1) {
    throw conflict(
      "The configured demo email is already used by a non-demo account. Set DEMO_EMAIL to a different address.",
    );
  }

  if (!record) {
    await createUser({
      displayName: DEMO_DISPLAY_NAME,
      email,
      password: randomBytes(32).toString("base64url"),
      isDemo: true,
    });
    record = await findUserByEmail(email);
  }
  if (!record) throw conflict("The demo account could not be created.");

  await ensureDemoWorkspace(record.id);

  return {
    id: record.id,
    email: record.email,
    displayName: record.display_name,
    isDemo: true,
  };
}

export function demoStatus() {
  return {
    email: demoEmail(),
    enabled: isDemoEnabled(),
    subjectName: DEMO_SUBJECT_NAME,
  };
}
