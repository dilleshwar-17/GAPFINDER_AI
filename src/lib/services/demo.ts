import { randomBytes } from "node:crypto";
import { db, newId, nowIso, transaction } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/session";
import { conflict } from "@/lib/errors";
import { isDemoEnabled } from "@/lib/env";
import { createSession } from "@/lib/auth/session";
import { createUser } from "@/lib/services/auth";
import { createSubject } from "@/lib/services/subjects";
import { ingestDocument, listDocuments, retryDocument } from "@/lib/services/documents";
import { extractTopics, listLeafTopics } from "@/lib/services/topics";
import { getQuestionOwned, type QuestionRow } from "@/lib/services/questions";
import {
  getQuizView,
  listAttempts,
  startDiagnostic,
  submitAttempt,
} from "@/lib/services/assessment";
import { createRevisionPlan, getActivePlan } from "@/lib/services/plans";
import { isInteractiveDemoEmail } from "@/lib/services/guards";

export const DEMO_SUBJECT_NAME = "Biology: Cells and Energy";
export const DEMO_DISPLAY_NAME = "Demo Learner";
export const DEMO_SESSION_TTL_SECONDS = 4 * 60 * 60;

export function demoEmail(): string {
  return process.env.DEMO_EMAIL?.trim().toLowerCase() || "demo@gapfinder.local";
}

function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

interface DemoDocumentSeed {
  filename: string;
  kind: "syllabus" | "notes" | "past_paper" | "other";
  content: string;
}

interface DemoSubjectSeed {
  name: string;
  description: string;
  documents: DemoDocumentSeed[];
}

const DEMO_SUBJECTS: DemoSubjectSeed[] = [
  {
    name: DEMO_SUBJECT_NAME,
    description: "Original sample content covering cell structure, photosynthesis and energy transfer.",
    documents: [
      {
        filename: "biology-syllabus.txt",
        kind: "syllabus",
        content: `UNIT 1: Cell Structure and Function
1.1 Cell membrane
1.2 Organelles
UNIT 2: Energy Transfer
2.1 Photosynthesis
2.2 Cellular respiration

Course outcomes: Explain how cell structures support their functions, compare ways substances cross the cell membrane, and describe how photosynthesis and cellular respiration transfer energy. Use evidence from observations and diagrams to connect each process to the needs of living cells.`,
      },
      {
        filename: "biology-notes.txt",
        kind: "notes",
        content: `CELL MEMBRANE
The cell membrane is a selectively permeable barrier that controls which substances enter and leave the cell. It consists of a phospholipid bilayer with proteins embedded in it. Small nonpolar molecules diffuse across the bilayer, while charged ions use channel proteins.
\f
ORGANELLES
Mitochondria carry out aerobic respiration and release energy as ATP. Ribosomes assemble proteins from amino acids. The nucleus stores genetic material and coordinates cellular activities. The Golgi apparatus modifies and packages proteins for transport.
\f
PHOTOSYNTHESIS
Photosynthesis converts light energy into chemical energy stored in glucose. Chlorophyll in chloroplasts absorbs light. The light-dependent reactions produce ATP and NADPH, which the Calvin cycle uses to fix carbon dioxide. Oxygen is released when water is split.
\f
CELLULAR RESPIRATION
Cellular respiration releases usable energy from glucose as ATP. Glycolysis breaks glucose into pyruvate in the cytoplasm. The Krebs cycle occurs in mitochondria and releases carbon dioxide. Oxidative phosphorylation uses a proton gradient to drive ATP synthesis.`,
      },
      {
        filename: "biology-practice-paper.txt",
        kind: "past_paper",
        content: `PRACTICE PAPER: CELLS AND ENERGY
Question 1. Explain how the phospholipid bilayer and membrane proteins control transport across a cell membrane.
Question 2. Describe how light energy is converted into chemical energy during photosynthesis.
Question 3. Compare glycolysis with the Krebs cycle, including where each occurs and one product.`,
      },
      {
        filename: "biology-worked-examples.txt",
        kind: "other",
        content: `WORKED EXAMPLE: MEMBRANE TRANSPORT
A small nonpolar molecule can diffuse through the hydrophobic centre of the phospholipid bilayer. A charged ion cannot cross that centre easily and instead moves through a channel protein.
\f
WORKED EXAMPLE: ENERGY TRANSFER
During the light-dependent reactions, absorbed light energy supports production of ATP and NADPH. The Calvin cycle uses these molecules to build sugars from carbon dioxide.`,
      },
      {
        filename: "biology-glossary.txt",
        kind: "other",
        content: `GLOSSARY: CELL BIOLOGY
Selective permeability means allowing some substances through a membrane more readily than others.
An organelle is a specialised structure inside a cell.
Chlorophyll is a pigment that absorbs light energy.
ATP is a molecule that transfers usable energy in cells.
Glycolysis is the first stage of cellular respiration and occurs in the cytoplasm.`,
      },
    ],
  },
  {
    name: "Algebra: Functions and Equations",
    description: "Original sample content for linear and quadratic functions and equation solving.",
    documents: [
      {
        filename: "algebra-syllabus.txt",
        kind: "syllabus",
        content: `UNIT 1: Functions and Graphs
1.1 Linear functions
1.2 Quadratic functions
UNIT 2: Equations and Models
2.1 Solving equations
2.2 Systems of equations

Course outcomes: Interpret linear and quadratic functions from equations, tables, and graphs. Solve equations using equivalent operations, check results by substitution, and explain how a solution to a system represents a value shared by all equations.`,
      },
      {
        filename: "algebra-notes.txt",
        kind: "notes",
        content: `LINEAR FUNCTIONS
A linear function has the form y = mx + b, where m is the gradient and b is the vertical intercept. Equal changes in x produce proportional changes in y. Its graph is a straight line.
\f
QUADRATIC FUNCTIONS
A quadratic function has the form y = ax squared + bx + c, with a not equal to zero. Its graph is a parabola. The sign of a determines whether the parabola opens upward or downward. Roots are the x-values where the graph crosses the x-axis.
\f
SOLVING EQUATIONS
An equation remains equivalent when the same operation is applied to both sides. To solve 3x + 5 = 20, subtract 5 from both sides and divide by 3, giving x = 5. Check a solution by substitution.
\f
SYSTEMS OF EQUATIONS
A solution to a system satisfies every equation simultaneously. Substitution replaces one variable using an equivalent expression. Elimination adds or subtracts equations to remove a variable. On a graph, the solution is an intersection point.`,
      },
      {
        filename: "algebra-practice-paper.txt",
        kind: "past_paper",
        content: `PRACTICE PAPER: FUNCTIONS
Question 1. Identify the gradient and vertical intercept in y = 4x - 3.
Question 2. Explain how the coefficient of x squared affects the shape of a quadratic graph.
Question 3. Solve 3x + 5 = 20 and verify the result.
Question 4. Explain what an intersection point represents in a system of two linear equations.`,
      },
      {
        filename: "algebra-worked-examples.txt",
        kind: "other",
        content: `WORKED EXAMPLE: LINEAR FUNCTION
For y = 2x + 1, the gradient is 2 and the vertical intercept is 1. Increasing x by 1 increases y by 2.
\f
WORKED EXAMPLE: EQUATION
To solve 3x + 5 = 20, subtract 5 to obtain 3x = 15, then divide by 3 to obtain x = 5. Substitution gives 3(5) + 5 = 20.`,
      },
      {
        filename: "algebra-glossary.txt",
        kind: "other",
        content: `GLOSSARY: ALGEBRA
Gradient measures the change in y for a unit change in x.
A function maps each permitted input to exactly one output.
A root is an input where a function has output zero.
A solution satisfies an equation.
A system is a set of equations whose solution must satisfy all of them.`,
      },
    ],
  },
  {
    name: "Climate Science: Earth Systems",
    description: "Original sample content about climate processes, evidence and ecosystems.",
    documents: [
      {
        filename: "climate-syllabus.txt",
        kind: "syllabus",
        content: `UNIT 1: Climate Processes
1.1 Earth's energy balance
1.2 The water cycle
UNIT 2: Climate Evidence and Impacts
2.1 Climate evidence
2.2 Ecosystems and biodiversity

Course outcomes: Describe how energy and water move through Earth systems, distinguish direct observations from climate proxy evidence, and explain how changes in temperature or rainfall can affect species, habitats, and biodiversity.`,
      },
      {
        filename: "climate-notes.txt",
        kind: "notes",
        content: `EARTH'S ENERGY BALANCE
Earth receives shortwave energy from the Sun and emits longwave energy to space. Greenhouse gases absorb and re-emit some outgoing infrared radiation. A change in the balance between incoming and outgoing energy changes the climate system's stored heat.
\f
THE WATER CYCLE
Solar energy drives evaporation from water and soil. Water vapour cools and condenses into clouds, then returns as precipitation. Runoff and infiltration move water across and through land. Temperature affects the rate of evaporation and the amount of water air can hold.
\f
CLIMATE EVIDENCE
Thermometers provide direct temperature observations. Ice cores contain trapped air bubbles that preserve samples of past atmospheric composition. Tree rings can record patterns of growth. Multiple independent records help researchers compare recent conditions with earlier periods.
\f
ECOSYSTEMS AND BIODIVERSITY
Species respond to changing temperature and rainfall by shifting ranges, changing seasonal timing or adapting. A rapid change can disrupt food webs and habitats. Biodiversity can support ecosystem resilience because different species may perform overlapping ecological roles.`,
      },
      {
        filename: "climate-practice-paper.txt",
        kind: "past_paper",
        content: `PRACTICE PAPER: CLIMATE SYSTEMS
Question 1. Explain how greenhouse gases affect the movement of energy through Earth's atmosphere.
Question 2. Describe two stages that move water between the surface and atmosphere.
Question 3. Compare one direct climate observation with one proxy record.
Question 4. Explain one way a rapid climate shift can affect ecosystem biodiversity.`,
      },
      {
        filename: "climate-worked-examples.txt",
        kind: "other",
        content: `WORKED EXAMPLE: ENERGY BALANCE
If incoming solar energy exceeds outgoing energy for a period, the system stores additional heat. The result is a change in energy balance, not a direct measurement of a particular local weather event.
\f
WORKED EXAMPLE: CLIMATE EVIDENCE
A thermometer is a direct measurement of temperature. An ice core is a proxy record: trapped air bubbles provide evidence about past atmospheric composition. Using both records gives different kinds of evidence.`,
      },
      {
        filename: "climate-glossary.txt",
        kind: "other",
        content: `GLOSSARY: CLIMATE SCIENCE
Shortwave radiation is the incoming solar energy reaching Earth.
Longwave radiation is infrared energy emitted by Earth.
Condensation is the change from water vapour to liquid water.
A proxy record provides indirect evidence about past climate conditions.
Biodiversity is the variety of life in an ecosystem or region.`,
      },
    ],
  },
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

async function seedDemoSubject(userId: string, seed: DemoSubjectSeed): Promise<string> {
  let subject = await db.get<{ id: string }>(
    "SELECT id FROM subjects WHERE owner_id = ? AND name = ?",
    userId,
    seed.name,
  );
  if (!subject) {
    subject = await createSubject({
      ownerId: userId,
      name: seed.name,
      description: seed.description,
      examDate: futureDate(21),
      isDemo: true,
      allowDemo: true,
    });
  }
  const subjectId = subject.id;

  const existingDocs = await listDocuments(userId, subjectId);
  for (const definition of seed.documents) {
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
    } else if (match.status === "failed") {
      await retryDocument(userId, match.id, { allowDemo: true });
    }
  }

  if ((await listLeafTopics(userId, subjectId)).length === 0) {
    await extractTopics(userId, subjectId, { allowDemo: true });
  }
  const leaves = await listLeafTopics(userId, subjectId);
  if (leaves.length === 0) {
    throw conflict(`The sample topic map for "${seed.name}" could not be created.`);
  }

  const attempts = await listAttempts(userId, subjectId);
  let baselineId = attempts.find(
    (attempt) => attempt.status === "submitted" && attempt.generator === "demo-seed",
  )?.id;

  if (!baselineId) {
    const existing = attempts.find(
      (attempt) => attempt.status === "in_progress" && attempt.generator === "demo-seed",
    );
    let attemptId = existing?.id;
    if (!attemptId) {
      const preferred = seed.name === DEMO_SUBJECT_NAME
        ? ["cell membrane", "photosynthesis", "cellular respiration"]
        : [];
      const selected = preferred
        .map((name) => leaves.find((topic) => topic.name.toLowerCase().includes(name)))
        .filter((topic): topic is (typeof leaves)[number] => Boolean(topic));
      const topicIds = (selected.length > 0 ? selected : leaves.slice(0, 3)).map(
        (topic) => topic.id,
      );
      attemptId = (await startDiagnostic(userId, subjectId, topicIds)).attemptId;
    }
    await db.run(
      "UPDATE quiz_attempts SET generator = 'demo-seed' WHERE id = ? AND owner_id = ?",
      attemptId,
      userId,
    );
    await submitDemoAttempt(userId, subjectId, attemptId, "baseline");
    baselineId = attemptId;
  }

  if (seed.name === DEMO_SUBJECT_NAME && baselineId) {
    const followUpId = await seedFollowUpAttempt(userId, subjectId, baselineId);
    if (followUpId) await submitDemoAttempt(userId, subjectId, followUpId, "followup");
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

const seedInFlight = new Map<string, Promise<string[]>>();

export async function ensureDemoWorkspace(userId: string): Promise<string[]> {
  const current = seedInFlight.get(userId);
  if (current) return current;
  const pending = (async () => {
    const subjectIds: string[] = [];
    for (const seed of DEMO_SUBJECTS) {
      subjectIds.push(await seedDemoSubject(userId, seed));
    }
    return subjectIds;
  })().finally(() => seedInFlight.delete(userId));
  seedInFlight.set(userId, pending);
  return pending;
}

export async function pruneExpiredDemoWorkspaces(): Promise<void> {
  const olderThan = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const now = nowIso();
  await db.run(
    `DELETE FROM users
      WHERE is_demo = 1
        AND email LIKE 'demo-session-%@demo.gapfinder.local'
        AND created_at < ?
        AND NOT EXISTS (
          SELECT 1 FROM sessions s
           WHERE s.user_id = users.id AND s.expires_at > ?
        )`,
    olderThan,
    now,
  );
}

export async function deleteInteractiveDemoWorkspace(userId: string): Promise<void> {
  const user = await db.get<{ is_demo: number; email: string }>(
    "SELECT is_demo, email FROM users WHERE id = ?",
    userId,
  );
  if (!user || user.is_demo !== 1 || !isInteractiveDemoEmail(user.email)) return;
  await transaction(async () => {
    await db.run("DELETE FROM users WHERE id = ? AND is_demo = 1", userId);
  });
}

export async function createInteractiveDemoSession(): Promise<{
  user: AuthUser;
  session: { token: string; expiresAt: string };
}> {
  if (!isDemoEnabled()) {
    throw conflict("The demo workspace is disabled for this deployment.");
  }
  await pruneExpiredDemoWorkspaces();
  const user = await createUser({
    displayName: DEMO_DISPLAY_NAME,
    email: `demo-session-${newId()}@demo.gapfinder.local`,
    password: randomBytes(32).toString("base64url"),
    isDemo: true,
  });
  try {
    await ensureDemoWorkspace(user.id);
    const session = await createSession(user.id, DEMO_SESSION_TTL_SECONDS);
    return { user, session };
  } catch (error) {
    await deleteInteractiveDemoWorkspace(user.id);
    throw error;
  }
}

export function demoStatus() {
  return {
    email: demoEmail(),
    enabled: isDemoEnabled(),
    subjectName: DEMO_SUBJECT_NAME,
    subjectCount: DEMO_SUBJECTS.length,
    materialsPerSubject: DEMO_SUBJECTS[0]?.documents.length ?? 0,
  };
}
