import { z } from "zod";
import { db, newId, nowIso, transaction } from "@/lib/db";
import { conflict, notFound, validationError } from "@/lib/errors";
import { getSubjectOwned } from "@/lib/services/subjects";
import { listLeafTopics, getPrerequisites } from "@/lib/services/topics";
import { getGapReport } from "@/lib/services/gaps";
import {
  buildChangeSummary,
  buildRevisionPlan,
  daysUntil,
  PLANNER_LIMITS,
  PLANNER_WEIGHTS,
  type PlanRationale,
  type PlannerTopic,
} from "@/lib/domain/planner";
import type { TopicClassification } from "@/lib/domain/types";
import { assertWritableAccount, isDemoUser } from "@/lib/services/guards";

export const planRequestSchema = z.object({
  examDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD."),
  minutesPerDay: z.coerce
    .number()
    .int()
    .min(10, "Choose at least 10 minutes per day.")
    .max(480, "Choose 480 minutes per day or fewer."),
  sessionMinutes: z.coerce.number().int().min(20).max(90).default(45),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;

export interface PlanRow {
  id: string;
  owner_id: string;
  subject_id: string;
  version: number;
  exam_date: string;
  minutes_per_day: number;
  session_minutes: number;
  horizon_days: number;
  capacity_minutes: number;
  allocated_minutes: number;
  status: "active" | "superseded";
  rationale_json: string;
  change_summary_json: string;
  trigger: string;
  created_at: string;
}

interface TaskRow {
  id: string;
  plan_id: string;
  owner_id: string;
  subject_id: string;
  topic_id: string;
  objective: string;
  duration_minutes: number;
  priority: number;
  priority_reason: string;
  status: "pending" | "completed";
  carried_from_task_id: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
}

export interface RevisionTaskView {
  id: string;
  topicId: string;
  topicName: string;
  objective: string;
  durationMinutes: number;
  priority: number;
  priorityReason: string;
  status: "pending" | "completed";
  completedAt: string | null;
  position: number;
}

export interface RevisionPlanView {
  id: string;
  version: number;
  examDate: string;
  minutesPerDay: number;
  sessionMinutes: number;
  horizonDays: number;
  capacityMinutes: number;
  allocatedMinutes: number;
  daysUntilExam: number;
  status: "active" | "superseded";
  trigger: string;
  createdAt: string;
  changeSummary: string[];
  rationale: PlanRationale[];
  tasks: RevisionTaskView[];
  pendingMinutes: number;
  completedMinutes: number;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function getActivePlanRow(ownerId: string, subjectId: string): Promise<PlanRow | undefined> {
  return await db.get<PlanRow>(
    `SELECT * FROM revision_plans
      WHERE owner_id = ? AND subject_id = ? AND status = 'active'
      ORDER BY version DESC LIMIT 1`,
    ownerId,
    subjectId,
  );
}

async function tasksForPlan(ownerId: string, planId: string): Promise<RevisionTaskView[]> {
  const rows = await db.all<TaskRow & { topic_name: string }>(
    `SELECT rt.*, t.name AS topic_name
       FROM revision_tasks rt
       JOIN topics t ON t.id = rt.topic_id
      WHERE rt.owner_id = ? AND rt.plan_id = ?
      ORDER BY rt.position ASC, rt.created_at ASC`,
    ownerId,
    planId,
  );
  return rows.map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    topicName: row.topic_name,
    objective: row.objective,
    durationMinutes: row.duration_minutes,
    priority: row.priority,
    priorityReason: row.priority_reason,
    status: row.status,
    completedAt: row.completed_at,
    position: row.position,
  }));
}

async function toPlanView(row: PlanRow, ownerId: string): Promise<RevisionPlanView> {
  const tasks = await tasksForPlan(ownerId, row.id);
  const pendingMinutes = tasks
    .filter((task) => task.status === "pending")
    .reduce((sum, task) => sum + task.durationMinutes, 0);
  const completedMinutes = tasks
    .filter((task) => task.status === "completed")
    .reduce((sum, task) => sum + task.durationMinutes, 0);

  return {
    id: row.id,
    version: row.version,
    examDate: row.exam_date,
    minutesPerDay: row.minutes_per_day,
    sessionMinutes: row.session_minutes,
    horizonDays: row.horizon_days,
    capacityMinutes: row.capacity_minutes,
    allocatedMinutes: row.allocated_minutes,
    daysUntilExam: Math.max(0, daysUntil(row.exam_date)),
    status: row.status,
    trigger: row.trigger,
    createdAt: row.created_at,
    changeSummary: parseJson<string[]>(row.change_summary_json, []),
    rationale: parseJson<PlanRationale[]>(row.rationale_json, []),
    tasks,
    pendingMinutes,
    completedMinutes,
  };
}

export async function getActivePlan(ownerId: string, subjectId: string): Promise<RevisionPlanView | null> {
  await getSubjectOwned(ownerId, subjectId);
  const row = await getActivePlanRow(ownerId, subjectId);
  return row ? toPlanView(row, ownerId) : null;
}

export async function listPlanHistory(ownerId: string, subjectId: string): Promise<RevisionPlanView[]> {
  await getSubjectOwned(ownerId, subjectId);
  const rows = await db.all<PlanRow>(
    `SELECT * FROM revision_plans
      WHERE owner_id = ? AND subject_id = ?
      ORDER BY version DESC LIMIT 12`,
    ownerId,
    subjectId,
  );
  return Promise.all(rows.map((row) => toPlanView(row, ownerId)));
}

interface PlanTopicSource {
  topicId: string;
  name: string;
  mastery: number | null;
  classification: TopicClassification;
  importance: number;
  prerequisiteWeak: boolean;
  prerequisiteNames: string[];
}

async function plannerTopics(ownerId: string, subjectId: string): Promise<PlanTopicSource[]> {
  const report = await getGapReport(ownerId, subjectId);
  const mastery = new Map(report.topics.map((topic) => [topic.topicId, topic]));
  const topics = await listLeafTopics(ownerId, subjectId);
  return Promise.all(topics.map(async (topic) => {
    const gap = mastery.get(topic.id);
    const prerequisites = await getPrerequisites(ownerId, topic.id);
    const weakPrerequisites = prerequisites.filter(
      (prerequisite) =>
        prerequisite.status === "explicit" && prerequisite.prerequisiteClassification === "weak",
    );
    return {
      topicId: topic.id,
      name: topic.name,
      mastery: gap?.mastery ?? null,
      classification: gap?.classification ?? "not_assessed",
      importance: topic.importance,
      prerequisiteWeak: weakPrerequisites.length > 0,
      prerequisiteNames: weakPrerequisites.map((prerequisite) => prerequisite.prerequisiteName),
    };
  }));
}

export async function createRevisionPlan(input: {
  ownerId: string;
  subjectId: string;
  request: PlanRequest;
  trigger: "initial" | "new_assessment" | "manual";
  allowDemo?: boolean;
}): Promise<RevisionPlanView> {
  if (!input.allowDemo) {
    await assertWritableAccount(input.ownerId, "revision plan changes");
  }
  const subject = await getSubjectOwned(input.ownerId, input.subjectId);
  const remaining = daysUntil(input.request.examDate);
  if (remaining <= 0) {
    throw validationError("Choose an exam date at least one day in the future.");
  }

  const topics = await plannerTopics(input.ownerId, input.subjectId);
  if (topics.length === 0) {
    throw validationError(
      "There are no assessable topics yet. Upload a syllabus, build the topic map, then create a plan.",
    );
  }

  const previous = await getActivePlanRow(input.ownerId, input.subjectId);
  const previousView = previous ? await toPlanView(previous, input.ownerId) : null;

  const plannerInput = {
    examDate: input.request.examDate,
    minutesPerDay: input.request.minutesPerDay,
    sessionMinutes: input.request.sessionMinutes,
    topics: topics as PlannerTopic[],
  };
  const result = buildRevisionPlan(plannerInput);
  if (result.horizonDays <= 0 || result.capacityMinutes <= 0) {
    throw validationError(
      "The remaining time or available minutes are too small to build a revision plan. Increase the daily study time or choose a later exam date.",
    );
  }

  const previousRationale = previousView?.rationale ?? [];
  const previousOrder = (previousView?.tasks ?? [])
    .filter((task) => task.status === "pending")
    .map((task) => task.topicId)
    .filter((topicId, index, list) => list.indexOf(topicId) === index);

  const masteryChanges = result.rationale
    .map((entry) => {
      const before = previousRationale.find((item) => item.topicId === entry.topicId);
      return {
        name: entry.name,
        previous: before?.mastery ?? null,
        next: entry.mastery,
      };
    })
    .filter((change) => change.previous !== null || change.next !== null);

  const changeSummary = buildChangeSummary({
    previous: previousView
      ? { version: previousView.version, orderedTopicIds: previousOrder }
      : null,
    nextOrdered: result.tasks
      .filter((task) => task.priority > 0)
      .map((task) => task.topicId)
      .filter((topicId, index, list) => list.indexOf(topicId) === index)
      .map((topicId) => ({
        topicId,
        name: result.rationale.find((entry) => entry.topicId === topicId)?.name ?? "Topic",
      })),
    masteryChanges,
    trigger: input.trigger,
  });

  const versionRow = await db.get<{ version: number | null }>(
    "SELECT MAX(version) AS version FROM revision_plans WHERE owner_id = ? AND subject_id = ?",
    input.ownerId,
    input.subjectId,
  );
  const version = (versionRow?.version ?? 0) + 1;
  const planId = newId();

  await transaction(async () => {
    await db.run(
      `UPDATE revision_plans SET status = 'superseded'
        WHERE owner_id = ? AND subject_id = ? AND status = 'active'`,
      input.ownerId,
      input.subjectId,
    );

    await db.run(
      `INSERT INTO revision_plans
        (id, owner_id, subject_id, version, exam_date, minutes_per_day, session_minutes,
         horizon_days, capacity_minutes, allocated_minutes, status, rationale_json,
         change_summary_json, trigger, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      planId,
      input.ownerId,
      subject.id,
      version,
      input.request.examDate,
      input.request.minutesPerDay,
      Math.max(
        PLANNER_LIMITS.minSessionMinutes,
        Math.min(PLANNER_LIMITS.maxSessionMinutes, input.request.sessionMinutes),
      ),
      result.horizonDays,
      result.capacityMinutes,
      result.allocatedMinutes,
      JSON.stringify(result.rationale),
      JSON.stringify(changeSummary),
      input.trigger,
      nowIso(),
    );

    for (const task of result.tasks) {
      await db.run(
        `INSERT INTO revision_tasks
          (id, plan_id, owner_id, subject_id, topic_id, objective, duration_minutes, priority,
           priority_reason, status, carried_from_task_id, completed_at, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)`,
        newId(),
        planId,
        input.ownerId,
        subject.id,
        task.topicId,
        task.objective,
        task.durationMinutes,
        task.priority,
        task.priorityReason,
        task.position,
        nowIso(),
      );
    }
  });

  const created = (await db.get<PlanRow>("SELECT * FROM revision_plans WHERE id = ?", planId))!;
  return toPlanView(created, input.ownerId);
}

/**
 * Called after a submitted assessment. It versions the plan forward using the
 * same declared time budget and preserves the previous plan (including any
 * completed tasks) as superseded history.
 */
export async function refreshActivePlanAfterAssessment(
  ownerId: string,
  subjectId: string,
): Promise<boolean> {
  const previous = await getActivePlanRow(ownerId, subjectId);
  if (!previous) return false;
  if (daysUntil(previous.exam_date) <= 0) return false;

  const view = await createRevisionPlan({
    ownerId,
    subjectId,
    request: {
      examDate: previous.exam_date,
      minutesPerDay: previous.minutes_per_day,
      sessionMinutes: previous.session_minutes,
    },
    trigger: "new_assessment",
    allowDemo: await isDemoUser(ownerId),
  });
  return view.version > previous.version;
}

export async function toggleRevisionTask(ownerId: string, taskId: string): Promise<RevisionTaskView> {
  await assertWritableAccount(ownerId, "revision task changes");
  const task = await db.get<TaskRow & { plan_status: string; topic_name: string }>(
    `SELECT rt.*, rp.status AS plan_status, t.name AS topic_name
       FROM revision_tasks rt
       JOIN revision_plans rp ON rp.id = rt.plan_id
       JOIN topics t ON t.id = rt.topic_id
      WHERE rt.id = ? AND rt.owner_id = ?`,
    taskId,
    ownerId,
  );
  if (!task) throw notFound("That revision task was not found.");
  if (task.plan_status !== "active") {
    throw conflict("This task belongs to an earlier plan version and is preserved as history.");
  }

  const nextStatus = task.status === "completed" ? "pending" : "completed";
  await db.run(
    "UPDATE revision_tasks SET status = ?, completed_at = ? WHERE id = ? AND owner_id = ?",
    nextStatus,
    nextStatus === "completed" ? nowIso() : null,
    taskId,
    ownerId,
  );

  return {
    id: task.id,
    topicId: task.topic_id,
    topicName: task.topic_name,
    objective: task.objective,
    durationMinutes: task.duration_minutes,
    priority: task.priority,
    priorityReason: task.priority_reason,
    status: nextStatus,
    completedAt: nextStatus === "completed" ? nowIso() : null,
    position: task.position,
  };
}

export const plannerMethod = {
  weights: PLANNER_WEIGHTS,
  limits: PLANNER_LIMITS,
};
