import { db } from "@/lib/db";
import { getSubjectOwned, listSubjects, type SubjectSummary } from "@/lib/services/subjects";
import { listTopics } from "@/lib/services/topics";
import { listAttempts, type AttemptSummary } from "@/lib/services/assessment";
import { getActivePlan } from "@/lib/services/plans";
import type { TopicClassification } from "@/lib/domain/types";

export interface MasteryPoint {
  mastery: number;
  classification: TopicClassification;
  createdAt: string;
  attemptId: string | null;
}

export interface TopicTrend {
  topicId: string;
  topicName: string;
  points: MasteryPoint[];
  change: number | null;
}

export interface ProgressOverview {
  attempts: AttemptSummary[];
  scoreSeries: {
    attemptId: string;
    submittedAt: string;
    percentage: number | null;
    score: number | null;
    totalMarks: number;
    isSeededDemo: boolean;
  }[];
  topicTrends: TopicTrend[];
  taskStats: {
    total: number;
    completed: number;
    pending: number;
    pendingMinutes: number;
    planVersion: number | null;
  };
  masteryChanges: {
    topicId: string;
    topicName: string;
    previous: number;
    next: number;
    change: number;
    classification: TopicClassification;
  }[];
  notAssessedCount: number;
}

export async function getProgressOverview(ownerId: string, subjectId: string): Promise<ProgressOverview> {
  await getSubjectOwned(ownerId, subjectId);
  const attempts = await listAttempts(ownerId, subjectId);
  const submitted = attempts.filter((attempt) => attempt.status === "submitted");
  const plan = await getActivePlan(ownerId, subjectId);
  const topics = (await listTopics(ownerId, subjectId)).filter((topic) => topic.childCount === 0);

  const rows = await db.all<{
    topic_id: string;
    topic_name: string;
    mastery: number;
    classification: TopicClassification;
    created_at: string;
    attempt_id: string | null;
  }>(
    `SELECT ms.topic_id, t.name AS topic_name, ms.mastery, ms.classification, ms.created_at, ms.attempt_id
       FROM mastery_snapshots ms
       JOIN topics t ON t.id = ms.topic_id
      WHERE ms.owner_id = ? AND ms.subject_id = ? AND ms.mastery IS NOT NULL
      ORDER BY ms.created_at ASC, ms.id ASC`,
    ownerId,
    subjectId,
  );

  const trendMap = new Map<string, TopicTrend>();
  for (const row of rows) {
    const existing = trendMap.get(row.topic_id) ?? {
      topicId: row.topic_id,
      topicName: row.topic_name,
      points: [],
      change: null,
    };
    existing.points.push({
      mastery: row.mastery,
      classification: row.classification,
      createdAt: row.created_at,
      attemptId: row.attempt_id,
    });
    trendMap.set(row.topic_id, existing);
  }

  const topicTrends = [...trendMap.values()]
    .map((trend) => {
      const points = trend.points.slice(-10);
      const change =
        points.length >= 2
          ? points[points.length - 1].mastery - points[0].mastery
          : null;
      return { ...trend, points, change };
    })
    .sort((a, b) => a.topicName.localeCompare(b.topicName));

  const masteryChanges = topicTrends
    .filter((trend) => trend.points.length >= 2)
    .map((trend) => {
      const previous = trend.points[trend.points.length - 2].mastery;
      const next = trend.points[trend.points.length - 1].mastery;
      return {
        topicId: trend.topicId,
        topicName: trend.topicName,
        previous,
        next,
        change: next - previous,
        classification: trend.points[trend.points.length - 1].classification,
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 8);

  const taskStats = plan
    ? {
        total: plan.tasks.length,
        completed: plan.tasks.filter((task) => task.status === "completed").length,
        pending: plan.tasks.filter((task) => task.status === "pending").length,
        pendingMinutes: plan.pendingMinutes,
        planVersion: plan.version,
      }
    : { total: 0, completed: 0, pending: 0, pendingMinutes: 0, planVersion: null };

  return {
    attempts,
    scoreSeries: submitted
      .slice()
      .reverse()
      .map((attempt) => ({
        attemptId: attempt.id,
        submittedAt: attempt.submittedAt ?? attempt.startedAt,
        percentage:
          attempt.score === null || attempt.totalMarks === 0
            ? null
            : Math.round((attempt.score / attempt.totalMarks) * 100),
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        isSeededDemo: attempt.isSeededDemo,
      })),
    topicTrends,
    taskStats,
    masteryChanges,
    notAssessedCount: topics.filter((topic) => topic.classification === "not_assessed").length,
  };
}

export interface DashboardData {
  subjects: SubjectSummary[];
  recentAttempts: {
    id: string;
    subjectId: string;
    subjectName: string;
    score: number | null;
    totalMarks: number;
    submittedAt: string | null;
    isSeededDemo: boolean;
  }[];
  weakTopics: {
    topicId: string;
    subjectId: string;
    subjectName: string;
    name: string;
    mastery: number | null;
    classification: TopicClassification;
    evidenceAnswers: number;
    lastAssessedAt: string;
  }[];
  pendingTasks: {
    id: string;
    subjectId: string;
    subjectName: string;
    topicName: string;
    objective: string;
    durationMinutes: number;
    priority: number;
  }[];
  totals: {
    subjects: number;
    readyDocuments: number;
    assessedTopics: number;
    weakTopics: number;
    pendingTasks: number;
    submittedAttempts: number;
  };
  nextAction: { label: string; href: string; detail: string };
}

export async function getDashboard(ownerId: string): Promise<DashboardData> {
  const subjects = await listSubjects(ownerId);

  const recentAttempts = await db.all<{
    id: string;
    subject_id: string;
    subject_name: string;
    score: number | null;
    total_marks: number;
    submitted_at: string | null;
    generator: string;
  }>(
    `SELECT at.id, at.subject_id, s.name AS subject_name, at.score, at.total_marks,
            at.submitted_at, at.generator
       FROM quiz_attempts at
       JOIN subjects s ON s.id = at.subject_id
      WHERE at.owner_id = ? AND at.status = 'submitted'
      ORDER BY at.submitted_at DESC LIMIT 6`,
    ownerId,
  );

  const weakTopics = await db.all<{
    topic_id: string;
    subject_id: string;
    subject_name: string;
    name: string;
    mastery: number | null;
    classification: TopicClassification;
    evidence_answers: number;
    created_at: string;
  }>(
    `SELECT topic_id, subject_id, subject_name, name, mastery, classification,
            evidence_answers, created_at
       FROM (
         SELECT t.id AS topic_id, t.subject_id, s.name AS subject_name, t.name,
                ms.mastery, ms.classification, ms.evidence_answers, ms.created_at,
                ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY ms.created_at DESC, ms.id DESC) AS row_number
           FROM mastery_snapshots ms
           JOIN topics t ON t.id = ms.topic_id
           JOIN subjects s ON s.id = t.subject_id
          WHERE ms.owner_id = ? AND ms.classification = 'weak'
       )
      WHERE row_number = 1
      ORDER BY mastery ASC, name ASC
      LIMIT 6`,
    ownerId,
  );

  const pendingTasks = await db.all<{
    id: string;
    subject_id: string;
    subject_name: string;
    topic_name: string;
    objective: string;
    duration_minutes: number;
    priority: number;
  }>(
    `SELECT rt.id, rp.subject_id, s.name AS subject_name, t.name AS topic_name,
            rt.objective, rt.duration_minutes, rt.priority
       FROM revision_tasks rt
       JOIN revision_plans rp ON rp.id = rt.plan_id
       JOIN subjects s ON s.id = rp.subject_id
       JOIN topics t ON t.id = rt.topic_id
      WHERE rt.owner_id = ? AND rt.status = 'pending' AND rp.status = 'active'
      ORDER BY rt.priority DESC, rt.position ASC
      LIMIT 6`,
    ownerId,
  );

  const totals = {
    subjects: subjects.length,
    readyDocuments: subjects.reduce((sum, subject) => sum + subject.readyDocuments, 0),
    assessedTopics: subjects.reduce((sum, subject) => sum + subject.assessedTopics, 0),
    weakTopics: subjects.reduce((sum, subject) => sum + subject.weakTopics, 0),
    pendingTasks: pendingTasks.length,
    submittedAttempts: subjects.reduce((sum, subject) => sum + subject.submittedAttempts, 0),
  };

  let nextAction = {
    label: "Create your first subject",
    href: "/subjects?intent=create",
    detail: "Name the subject you are preparing for, then upload a syllabus and notes.",
  };

  if (subjects.length > 0) {
    const primary = subjects[0];
    if (primary.readyDocuments === 0) {
      nextAction = {
        label: "Upload study material",
        href: `/materials/upload?subject=${primary.id}`,
        detail: "Add a syllabus and notes so questions can be grounded in your own sources.",
      };
    } else if (primary.topicCount === 0) {
      nextAction = {
        label: "Build the topic map",
        href: `/subjects/${primary.id}/topics`,
        detail: "Extract units and topics from your syllabus headings.",
      };
    } else if (primary.submittedAttempts === 0) {
      nextAction = {
        label: "Take a diagnostic",
        href: `/diagnostics?subject=${primary.id}`,
        detail: "Choose topics and answer source-grounded questions to establish evidence.",
      };
    } else if (primary.weakTopics > 0) {
      nextAction = {
        label: "Review your revision plan",
        href: `/revision-plan?subject=${primary.id}`,
        detail: "Turn measured weak topics into time-bounded revision tasks.",
      };
    } else {
      nextAction = {
        label: "Open the gap report",
        href: `/reports/${primary.id}`,
        detail: "Inspect the evidence behind each topic diagnosis and plan the next check.",
      };
    }
  }

  return {
    subjects,
    recentAttempts: recentAttempts.map((attempt) => ({
      id: attempt.id,
      subjectId: attempt.subject_id,
      subjectName: attempt.subject_name,
      score: attempt.score,
      totalMarks: attempt.total_marks,
      submittedAt: attempt.submitted_at,
      isSeededDemo: attempt.generator.startsWith("demo-seed"),
    })),
    weakTopics: weakTopics.map((topic) => ({
      topicId: topic.topic_id,
      subjectId: topic.subject_id,
      subjectName: topic.subject_name,
      name: topic.name,
      mastery: topic.mastery,
      classification: topic.classification,
      evidenceAnswers: topic.evidence_answers,
      lastAssessedAt: topic.created_at,
    })),
    pendingTasks: pendingTasks.map((task) => ({
      id: task.id,
      subjectId: task.subject_id,
      subjectName: task.subject_name,
      topicName: task.topic_name,
      objective: task.objective,
      durationMinutes: task.duration_minutes,
      priority: task.priority,
    })),
    totals,
    nextAction,
  };
}
