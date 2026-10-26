import type { TopicClassification } from "@/lib/domain/types";

export const PLANNER_WEIGHTS = {
  weakness: 0.5,
  importance: 0.3,
  urgency: 0.2,
} as const;

export const PLANNER_LIMITS = {
  maxHorizonDays: 14,
  minSessionMinutes: 20,
  maxSessionMinutes: 90,
  maxTasks: 12,
  prerequisiteBoost: 4,
} as const;

export interface PlannerTopic {
  topicId: string;
  name: string;
  mastery: number | null;
  classification: TopicClassification;
  importance: number;
  prerequisiteWeak?: boolean;
  prerequisiteNames?: string[];
}

export interface PlannerRequest {
  examDate: string;
  minutesPerDay: number;
  sessionMinutes: number;
  topics: PlannerTopic[];
  today?: Date;
}

export interface PlannedTask {
  topicId: string;
  objective: string;
  durationMinutes: number;
  priority: number;
  priorityReason: string;
  position: number;
}

export interface PlanRationale {
  topicId: string;
  name: string;
  priority: number;
  mastery: number | null;
  weaknessComponent: number;
  importanceComponent: number;
  urgencyComponent: number;
  prerequisiteBoost: number;
  classification: TopicClassification;
}

export interface PlanResult {
  horizonDays: number;
  daysUntilExam: number;
  capacityMinutes: number;
  allocatedMinutes: number;
  tasks: PlannedTask[];
  rationale: PlanRationale[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function daysUntil(examDate: string, today: Date = new Date()): number {
  const exam = new Date(`${examDate}T00:00:00.000Z`);
  if (Number.isNaN(exam.getTime())) return 0;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.ceil((exam.getTime() - todayUtc) / 86_400_000);
}

export function planHorizonDays(examDate: string, today: Date = new Date()): number {
  const remaining = daysUntil(examDate, today);
  if (remaining <= 0) return 0;
  return clamp(remaining, 1, PLANNER_LIMITS.maxHorizonDays);
}

export function roundToFive(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function computePriority(input: {
  mastery: number | null;
  classification: TopicClassification;
  importance: number;
  daysRemaining: number;
  prerequisiteWeak?: boolean;
}): Omit<PlanRationale, "topicId" | "name" | "classification" | "mastery"> {
  // A topic without sufficient evidence is prioritised neutrally (0.5), not as
  // if it had been measured at zero. This avoids labelling untested topics weak.
  const weaknessComponent =
    input.classification === "not_assessed" || input.mastery === null
      ? 0.5
      : clamp((100 - input.mastery) / 100, 0, 1);
  const importanceComponent = clamp(input.importance / 100, 0, 1);
  const urgencyComponent = clamp(1 - input.daysRemaining / 30, 0.15, 1);
  const prerequisiteBoost = input.prerequisiteWeak ? PLANNER_LIMITS.prerequisiteBoost : 0;

  const priority =
    (PLANNER_WEIGHTS.weakness * weaknessComponent +
      PLANNER_WEIGHTS.importance * importanceComponent +
      PLANNER_WEIGHTS.urgency * urgencyComponent) *
      100 +
    prerequisiteBoost;

  return {
    priority: Math.round(clamp(priority, 0, 100) * 10) / 10,
    weaknessComponent: Math.round(weaknessComponent * 100),
    importanceComponent: Math.round(importanceComponent * 100),
    urgencyComponent: Math.round(urgencyComponent * 100),
    prerequisiteBoost,
  };
}

function objectiveFor(topic: PlannerTopic, pass: number): string {
  if (pass > 0) {
    return `Practise recall for ${topic.name}: answer a short mixed question set and recheck every cited passage you used.`;
  }
  switch (topic.classification) {
    case "weak":
      return `Rebuild the foundations of ${topic.name}: review the cited passages, then re-attempt the questions you missed.`;
    case "developing":
      return `Close the remaining gaps in ${topic.name}: compare your answers with the rubric and practise the missing concepts.`;
    case "strong":
      return `Maintain retention in ${topic.name} with a short mixed practice set.`;
    default:
      return `Establish a baseline for ${topic.name}: take a short diagnostic before investing revision time.`;
  }
}

function reasonFor(topic: PlannerTopic, rationale: PlanRationale): string {
  const parts = [
    topic.classification === "not_assessed"
      ? "no sufficient assessment evidence yet (neutral weakness weighting)"
      : `measured mastery ${topic.mastery ?? 0}%`,
    `syllabus importance ${rationale.importanceComponent}/100`,
    `exam urgency ${rationale.urgencyComponent}/100`,
  ];
  const base = `Priority ${rationale.priority.toFixed(1)}: ${parts.join(", ")}.`;
  if (rationale.prerequisiteBoost > 0 && topic.prerequisiteNames?.length) {
    return `${base} Boosted because the prerequisite ${topic.prerequisiteNames.join(", ")} is measured weak.`;
  }
  return base;
}

/**
 * Deterministic planner. The application, not the language model, enforces the
 * study-time ceiling: pending task durations can never exceed capacity.
 */
export function buildRevisionPlan(request: PlannerRequest): PlanResult {
  const today = request.today ?? new Date();
  const remaining = daysUntil(request.examDate, today);
  const horizonDays = planHorizonDays(request.examDate, today);
  const capacityMinutes = Math.max(
    0,
    Math.floor(request.minutesPerDay * horizonDays),
  );
  const sessionMinutes = clamp(
    roundToFive(request.sessionMinutes),
    PLANNER_LIMITS.minSessionMinutes,
    PLANNER_LIMITS.maxSessionMinutes,
  );

  const rationale: PlanRationale[] = request.topics.map((topic) => {
    const computed = computePriority({
      mastery: topic.mastery,
      classification: topic.classification,
      importance: topic.importance,
      daysRemaining: remaining,
      prerequisiteWeak: topic.prerequisiteWeak,
    });
    return {
      topicId: topic.topicId,
      name: topic.name,
      classification: topic.classification,
      mastery: topic.mastery,
      ...computed,
    };
  });

  const rationaleByTopic = new Map(rationale.map((entry) => [entry.topicId, entry]));
  const ranked = [...request.topics].sort((a, b) => {
    const priorityA = rationaleByTopic.get(a.topicId)?.priority ?? 0;
    const priorityB = rationaleByTopic.get(b.topicId)?.priority ?? 0;
    if (priorityB !== priorityA) return priorityB - priorityA;
    if (b.importance !== a.importance) return b.importance - a.importance;
    return a.name.localeCompare(b.name);
  });

  const tasks: PlannedTask[] = [];
  let allocated = 0;

  const addTask = (topic: PlannerTopic, pass: number) => {
    if (tasks.length >= PLANNER_LIMITS.maxTasks) return;
    const remainingBudget = capacityMinutes - allocated;
    if (remainingBudget < PLANNER_LIMITS.minSessionMinutes) return;
    const duration = Math.min(sessionMinutes, remainingBudget);
    const entry = rationaleByTopic.get(topic.topicId);
    if (!entry) return;

    tasks.push({
      topicId: topic.topicId,
      objective: objectiveFor(topic, pass),
      durationMinutes: duration,
      priority: pass === 0 ? entry.priority : Math.max(0, Math.round((entry.priority - 3) * 10) / 10),
      priorityReason: reasonFor(topic, entry),
      position: tasks.length,
    });
    allocated += duration;
  };

  for (const topic of ranked) addTask(topic, 0);
  for (const topic of ranked) {
    if (topic.classification === "weak" || topic.classification === "not_assessed") {
      addTask(topic, 1);
    }
  }

  return {
    horizonDays,
    daysUntilExam: Math.max(0, remaining),
    capacityMinutes,
    allocatedMinutes: allocated,
    tasks,
    rationale: rationale.sort((a, b) => b.priority - a.priority),
  };
}

export interface PlanChangeInput {
  previous: {
    version: number;
    orderedTopicIds: string[];
  } | null;
  nextOrdered: Array<{ topicId: string; name: string }>;
  masteryChanges: Array<{ name: string; previous: number | null; next: number | null }>;
  trigger: "initial" | "new_assessment" | "manual";
}

export function buildChangeSummary(input: PlanChangeInput): string[] {
  const summary: string[] = [];

  if (!input.previous) {
    summary.push(
      input.trigger === "new_assessment"
        ? "Plan created from your first recorded assessment."
        : "Initial plan created from current topic diagnostics.",
    );
  } else {
    summary.push(`Plan v${input.previous.version + 1} recalculated from the latest evidence.`);
    const previousSet = new Set(input.previous.orderedTopicIds);
    const nextSet = new Set(input.nextOrdered.map((topic) => topic.topicId));
    const added = input.nextOrdered.filter((topic) => !previousSet.has(topic.topicId));
    const removed = input.previous.orderedTopicIds.filter((id) => !nextSet.has(id));
    if (added.length > 0) {
      summary.push(`New focus: ${added.slice(0, 3).map((topic) => topic.name).join(", ")}.`);
    }
    if (removed.length > 0) {
      summary.push(`Dropped from the time budget: ${removed.length} topic${removed.length === 1 ? "" : "s"} (no remaining capacity or no eligible task).`);
    }
    const previousFirst = input.previous.orderedTopicIds[0];
    const nextFirst = input.nextOrdered[0]?.topicId;
    if (previousFirst && nextFirst && previousFirst !== nextFirst) {
      summary.push(`Top priority changed to ${input.nextOrdered[0]?.name ?? "a new topic"}.`);
    }
  }

  for (const change of input.masteryChanges) {
    if (change.previous !== null && change.next !== null && change.previous !== change.next) {
      const direction = change.next > change.previous ? "up" : "down";
      summary.push(`${change.name}: mastery ${direction} from ${change.previous}% to ${change.next}%.`);
    }
  }

  return summary.slice(0, 8);
}
