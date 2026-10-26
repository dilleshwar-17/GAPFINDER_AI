import { describe, expect, it } from "vitest";
import {
  PLANNER_LIMITS,
  buildChangeSummary,
  buildRevisionPlan,
  computePriority,
  daysUntil,
  planHorizonDays,
  roundToFive,
  type PlannerTopic,
} from "@/lib/domain/planner";

const TODAY = new Date("2026-01-01T00:00:00.000Z");

function topic(overrides: Partial<PlannerTopic> = {}): PlannerTopic {
  return {
    topicId: "topic-1",
    name: "Photosynthesis",
    mastery: 40,
    classification: "weak",
    importance: 80,
    ...overrides,
  };
}

describe("daysUntil", () => {
  it("counts whole days to an exam date", () => {
    expect(daysUntil("2026-01-10", TODAY)).toBe(9);
    expect(daysUntil("2026-01-01", TODAY)).toBe(0);
  });

  it("returns a negative count for a past exam", () => {
    expect(daysUntil("2025-12-25", TODAY)).toBe(-7);
  });

  it("returns zero for an invalid date", () => {
    expect(daysUntil("not-a-date", TODAY)).toBe(0);
  });
});

describe("planHorizonDays", () => {
  it("is zero for an exam today or in the past", () => {
    expect(planHorizonDays("2026-01-01", TODAY)).toBe(0);
    expect(planHorizonDays("2025-12-01", TODAY)).toBe(0);
  });

  it("uses the remaining days inside the 14-day window", () => {
    expect(planHorizonDays("2026-01-06", TODAY)).toBe(5);
  });

  it("caps the horizon at the planner maximum", () => {
    expect(planHorizonDays("2026-06-01", TODAY)).toBe(PLANNER_LIMITS.maxHorizonDays);
    expect(PLANNER_LIMITS.maxHorizonDays).toBe(14);
  });
});

describe("roundToFive", () => {
  it("rounds to the nearest five minutes with a floor of five", () => {
    expect(roundToFive(22)).toBe(20);
    expect(roundToFive(23)).toBe(25);
    expect(roundToFive(1)).toBe(5);
  });
});

describe("computePriority", () => {
  it("treats an unassessed topic with neutral weakness, not as a zero", () => {
    const result = computePriority({
      mastery: null,
      classification: "not_assessed",
      importance: 50,
      daysRemaining: 10,
    });
    expect(result.weaknessComponent).toBe(50);
  });

  it("maps measured mastery inversely into the weakness component", () => {
    const weak = computePriority({
      mastery: 10,
      classification: "weak",
      importance: 50,
      daysRemaining: 10,
    });
    const strong = computePriority({
      mastery: 90,
      classification: "strong",
      importance: 50,
      daysRemaining: 10,
    });
    expect(weak.weaknessComponent).toBe(90);
    expect(strong.weaknessComponent).toBe(10);
    expect(weak.priority).toBeGreaterThan(strong.priority);
  });

  it("raises urgency as the exam approaches", () => {
    const soon = computePriority({
      mastery: 50,
      classification: "developing",
      importance: 50,
      daysRemaining: 1,
    });
    const later = computePriority({
      mastery: 50,
      classification: "developing",
      importance: 50,
      daysRemaining: 29,
    });
    expect(soon.urgencyComponent).toBeGreaterThan(later.urgencyComponent);
  });

  it("keeps urgency inside its floor and ceiling", () => {
    const past = computePriority({
      mastery: 50,
      classification: "developing",
      importance: 50,
      daysRemaining: -20,
    });
    const far = computePriority({
      mastery: 50,
      classification: "developing",
      importance: 50,
      daysRemaining: 400,
    });
    expect(past.urgencyComponent).toBe(100);
    expect(far.urgencyComponent).toBe(15);
  });

  it("adds the documented prerequisite boost", () => {
    const base = computePriority({
      mastery: 40,
      classification: "weak",
      importance: 50,
      daysRemaining: 10,
    });
    const boosted = computePriority({
      mastery: 40,
      classification: "weak",
      importance: 50,
      daysRemaining: 10,
      prerequisiteWeak: true,
    });
    expect(boosted.prerequisiteBoost).toBe(PLANNER_LIMITS.prerequisiteBoost);
    expect(boosted.priority).toBeGreaterThan(base.priority);
  });

  it("never returns a priority above 100", () => {
    const result = computePriority({
      mastery: 0,
      classification: "weak",
      importance: 100,
      daysRemaining: 0,
      prerequisiteWeak: true,
    });
    expect(result.priority).toBeLessThanOrEqual(100);
  });
});

describe("buildRevisionPlan", () => {
  it("caps the horizon at 14 days even for a distant exam", () => {
    const plan = buildRevisionPlan({
      examDate: "2026-09-01",
      minutesPerDay: 60,
      sessionMinutes: 45,
      topics: [topic()],
      today: TODAY,
    });
    expect(plan.horizonDays).toBe(14);
    expect(plan.capacityMinutes).toBe(60 * 14);
  });

  it("never allocates more time than the capacity ceiling", () => {
    const topics = Array.from({ length: 20 }, (_, index) =>
      topic({ topicId: `topic-${index}`, name: `Topic ${index}` }),
    );
    const plan = buildRevisionPlan({
      examDate: "2026-01-10",
      minutesPerDay: 30,
      sessionMinutes: 90,
      topics,
      today: TODAY,
    });
    expect(plan.allocatedMinutes).toBeLessThanOrEqual(plan.capacityMinutes);
    const summed = plan.tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
    expect(summed).toBe(plan.allocatedMinutes);
  });

  it("allocates nothing when the exam has already passed", () => {
    const plan = buildRevisionPlan({
      examDate: "2025-12-01",
      minutesPerDay: 60,
      sessionMinutes: 45,
      topics: [topic()],
      today: TODAY,
    });
    expect(plan.horizonDays).toBe(0);
    expect(plan.capacityMinutes).toBe(0);
    expect(plan.tasks).toEqual([]);
  });

  it("never schedules more than the task maximum", () => {
    const topics = Array.from({ length: 30 }, (_, index) =>
      topic({ topicId: `topic-${index}`, name: `Topic ${index}` }),
    );
    const plan = buildRevisionPlan({
      examDate: "2026-03-01",
      minutesPerDay: 480,
      sessionMinutes: 90,
      topics,
      today: TODAY,
    });
    expect(plan.tasks.length).toBeLessThanOrEqual(PLANNER_LIMITS.maxTasks);
    expect(plan.tasks.length).toBe(PLANNER_LIMITS.maxTasks);
  });

  it("clamps a requested session below the minimum", () => {
    const plan = buildRevisionPlan({
      examDate: "2026-01-10",
      minutesPerDay: 60,
      sessionMinutes: 5,
      topics: [topic()],
      today: TODAY,
    });
    expect(plan.tasks[0]?.durationMinutes).toBe(PLANNER_LIMITS.minSessionMinutes);
  });

  it("clamps a requested session above the maximum", () => {
    const plan = buildRevisionPlan({
      examDate: "2026-01-10",
      minutesPerDay: 480,
      sessionMinutes: 500,
      topics: [topic()],
      today: TODAY,
    });
    expect(plan.tasks[0]?.durationMinutes).toBe(PLANNER_LIMITS.maxSessionMinutes);
  });

  it("orders tasks by priority and records a rationale for each topic", () => {
    const plan = buildRevisionPlan({
      examDate: "2026-01-10",
      minutesPerDay: 60,
      sessionMinutes: 45,
      topics: [
        topic({ topicId: "strong", name: "Strong topic", mastery: 95, classification: "strong" }),
        topic({ topicId: "weak", name: "Weak topic", mastery: 10, classification: "weak" }),
        topic({ topicId: "unassessed", name: "Unassessed topic", mastery: null, classification: "not_assessed" }),
      ],
      today: TODAY,
    });
    const firstPass = plan.tasks.slice(0, 3).map((task) => task.priority);
    expect(firstPass).toEqual([...firstPass].sort((a, b) => b - a));
    expect(plan.rationale).toHaveLength(3);
    expect(plan.tasks[0]?.topicId).toBe("weak");
    expect(plan.rationale[0]?.topicId).toBe("weak");
  });

  it("appends repeat sessions after the first pass", () => {
    const plan = buildRevisionPlan({
      examDate: "2026-01-10",
      minutesPerDay: 240,
      sessionMinutes: 30,
      topics: [
        topic({ topicId: "weak", name: "A", mastery: 10, classification: "weak" }),
        topic({ topicId: "strong", name: "B", mastery: 95, classification: "strong" }),
      ],
      today: TODAY,
    });
    expect(plan.tasks.map((task) => task.topicId)).toEqual(["weak", "strong", "weak"]);
  });

  it("adds a second pass for weak and unassessed topics only", () => {
    const plan = buildRevisionPlan({
      examDate: "2026-01-10",
      minutesPerDay: 240,
      sessionMinutes: 30,
      topics: [
        topic({ topicId: "weak", name: "A", mastery: 10, classification: "weak" }),
        topic({ topicId: "strong", name: "B", mastery: 95, classification: "strong" }),
      ],
      today: TODAY,
    });
    const passes = plan.tasks.reduce<Record<string, number>>((counts, task) => {
      counts[task.topicId] = (counts[task.topicId] ?? 0) + 1;
      return counts;
    }, {});
    expect(passes.weak).toBe(2);
    expect(passes.strong).toBe(1);
  });

  it("stops adding tasks when fewer than one session remains", () => {
    const plan = buildRevisionPlan({
      examDate: "2026-01-02",
      minutesPerDay: 30,
      sessionMinutes: 30,
      topics: [topic(), topic({ topicId: "topic-2", name: "Second" })],
      today: TODAY,
    });
    expect(plan.allocatedMinutes).toBe(30);
    expect(plan.tasks).toHaveLength(1);
  });

  it("records the prerequisite reason when a boost is applied", () => {
    const plan = buildRevisionPlan({
      examDate: "2026-01-10",
      minutesPerDay: 60,
      sessionMinutes: 30,
      topics: [
        topic({
          prerequisiteWeak: true,
          prerequisiteNames: ["Cell structure"],
        }),
      ],
      today: TODAY,
    });
    expect(plan.tasks[0]?.priorityReason).toMatch(/Cell structure/);
  });
});

describe("buildChangeSummary", () => {
  it("explains an initial plan", () => {
    const summary = buildChangeSummary({
      previous: null,
      nextOrdered: [{ topicId: "a", name: "A" }],
      masteryChanges: [],
      trigger: "initial",
    });
    expect(summary[0]).toMatch(/Initial plan created/);
  });

  it("reports added and dropped topics and a changed top priority", () => {
    const summary = buildChangeSummary({
      previous: { version: 1, orderedTopicIds: ["a", "b"] },
      nextOrdered: [
        { topicId: "c", name: "C" },
        { topicId: "a", name: "A" },
      ],
      masteryChanges: [],
      trigger: "new_assessment",
    });
    expect(summary.join(" ")).toMatch(/Plan v2/);
    expect(summary.join(" ")).toMatch(/New focus: C/);
    expect(summary.join(" ")).toMatch(/Dropped .* 1 topic/);
    expect(summary.join(" ")).toMatch(/Top priority changed to C/);
  });

  it("describes mastery movement and skips unchanged values", () => {
    const summary = buildChangeSummary({
      previous: { version: 2, orderedTopicIds: ["a"] },
      nextOrdered: [{ topicId: "a", name: "A" }],
      masteryChanges: [
        { name: "A", previous: 40, next: 62 },
        { name: "B", previous: 70, next: 70 },
        { name: "C", previous: null, next: 30 },
      ],
      trigger: "new_assessment",
    });
    const text = summary.join(" ");
    expect(text).toMatch(/A: mastery up from 40% to 62%/);
    expect(text).not.toMatch(/B:/);
    expect(text).not.toMatch(/C:/);
  });

  it("caps the summary at eight lines", () => {
    const summary = buildChangeSummary({
      previous: { version: 1, orderedTopicIds: ["a"] },
      nextOrdered: Array.from({ length: 20 }, (_, index) => ({
        topicId: `topic-${index}`,
        name: `Topic ${index}`,
      })),
      masteryChanges: [],
      trigger: "new_assessment",
    });
    expect(summary.length).toBeLessThanOrEqual(8);
  });
});
