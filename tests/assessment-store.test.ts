import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  getQuizView,
  saveAttemptDraft,
  submitAttempt,
} from "@/lib/services/assessment";
import { createAttemptFixture, insertAttempt } from "./fixtures";

async function asyncErrorCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
  throw new Error("Expected the call to throw an AppError");
}

beforeEach(() => {
  resetDatabase();
});

describe("saveAttemptDraft", () => {
  it("stores valid answers and restores them through the quiz view", async () => {
    const fixture = await createAttemptFixture({ suffix: "draft" });
    await saveAttemptDraft(fixture.userId, fixture.attemptId, {
      answers: [
        { questionId: fixture.questionIds[0]!, selectedIndex: 2 },
        { questionId: fixture.questionIds[1]!, selectedIndex: null, answerText: "  working  " },
      ],
    });

    const view = await getQuizView(fixture.userId, fixture.attemptId);
    expect(view.status).toBe("in_progress");
    expect(view.draft).toEqual([
      { questionId: fixture.questionIds[0], selectedIndex: 2, answerText: "" },
      { questionId: fixture.questionIds[1], selectedIndex: null, answerText: "  working  " },
    ]);
  });

  it("drops questions that are not part of the attempt", async () => {
    const fixture = await createAttemptFixture({ suffix: "foreign-answer" });
    await saveAttemptDraft(fixture.userId, fixture.attemptId, {
      answers: [
        { questionId: fixture.questionIds[0]!, selectedIndex: 1 },
        { questionId: "not-in-this-attempt", selectedIndex: 0 },
      ],
    });
    const view = await getQuizView(fixture.userId, fixture.attemptId);
    expect(view.draft).toHaveLength(1);
    expect(view.draft[0]?.questionId).toBe(fixture.questionIds[0]);
  });

  it("keeps only the first entry when a question is submitted twice", async () => {
    const fixture = await createAttemptFixture({ suffix: "duplicate-draft" });
    await saveAttemptDraft(fixture.userId, fixture.attemptId, {
      answers: [
        { questionId: fixture.questionIds[0]!, selectedIndex: 0 },
        { questionId: fixture.questionIds[0]!, selectedIndex: 3 },
      ],
    });
    const view = await getQuizView(fixture.userId, fixture.attemptId);
    expect(view.draft).toHaveLength(1);
    expect(view.draft[0]?.selectedIndex).toBe(0);
  });

  it("truncates an over-long answer at the storage limit", async () => {
    const fixture = await createAttemptFixture({ suffix: "long-draft" });
    await saveAttemptDraft(fixture.userId, fixture.attemptId, {
      answers: [
        {
          questionId: fixture.questionIds[0]!,
          selectedIndex: null,
          answerText: "x".repeat(5000),
        },
      ],
    });
    const view = await getQuizView(fixture.userId, fixture.attemptId);
    expect(view.draft[0]?.answerText).toHaveLength(4000);
  });

  it("rejects a draft after the attempt was submitted", async () => {
    const fixture = await createAttemptFixture({ suffix: "draft-locked" });
    await db.run(
      "UPDATE quiz_attempts SET status = 'submitted', submitted_at = ? WHERE id = ?",
      new Date().toISOString(),
      fixture.attemptId,
    );
    const code = await asyncErrorCode(() =>
      saveAttemptDraft(fixture.userId, fixture.attemptId, {
        answers: [{ questionId: fixture.questionIds[0]!, selectedIndex: 1 }],
      }),
    );
    expect(code).toBe("CONFLICT");
  });
});

describe("submitAttempt", () => {
  it("scores multiple-choice answers deterministically", async () => {
    const fixture = await createAttemptFixture({ suffix: "score", correctIndex: 1 });
    const result = await submitAttempt(fixture.userId, fixture.attemptId, {
      answers: [
        { questionId: fixture.questionIds[0]!, selectedIndex: 1 },
        { questionId: fixture.questionIds[1]!, selectedIndex: 3 },
      ],
    });

    expect(result.score).toBe(1);
    expect(result.totalMarks).toBe(2);
    expect(result.topicsUpdated).toBe(1);

    const view = await getQuizView(fixture.userId, fixture.attemptId);
    expect(view.status).toBe("submitted");
    expect(view.score).toBe(1);
    expect(view.draft).toEqual([]);
    expect(view.questions[0]?.answer).toMatchObject({
      score: 1,
      maxMarks: 1,
      correctness: "correct",
      evaluationMethod: "deterministic-mcq-v1",
    });
    expect(view.questions[1]?.answer).toMatchObject({
      score: 0,
      correctness: "incorrect",
    });
  });

  it("rejects a submission that omits a question", async () => {
    const fixture = await createAttemptFixture({ suffix: "missing" });
    const code = await asyncErrorCode(() =>
      submitAttempt(fixture.userId, fixture.attemptId, {
        answers: [{ questionId: fixture.questionIds[0]!, selectedIndex: 1 }],
      }),
    );
    expect(code).toBe("VALIDATION_ERROR");
  });

  it("rejects a question that does not belong to the attempt", async () => {
    const fixture = await createAttemptFixture({ suffix: "foreign-question" });
    const code = await asyncErrorCode(() =>
      submitAttempt(fixture.userId, fixture.attemptId, {
        answers: [
          ...fixture.questionIds.map((questionId) => ({ questionId, selectedIndex: 1 })),
          { questionId: "someone-elses-question", selectedIndex: 1 },
        ],
      }),
    );
    expect(code).toBe("VALIDATION_ERROR");
  });

  it("rejects duplicate answers for one question", async () => {
    const fixture = await createAttemptFixture({ suffix: "duplicate-submit" });
    const code = await asyncErrorCode(() =>
      submitAttempt(fixture.userId, fixture.attemptId, {
        answers: [
          { questionId: fixture.questionIds[0]!, selectedIndex: 1 },
          { questionId: fixture.questionIds[0]!, selectedIndex: 1 },
          { questionId: fixture.questionIds[1]!, selectedIndex: 1 },
        ],
      }),
    );
    expect(code).toBe("VALIDATION_ERROR");
  });

  it("refuses a second submission of the same attempt", async () => {
    const fixture = await createAttemptFixture({ suffix: "double" });
    const answers = fixture.questionIds.map((questionId) => ({
      questionId,
      selectedIndex: 1,
    }));
    const first = await submitAttempt(fixture.userId, fixture.attemptId, { answers });
    expect(first.score).toBe(first.totalMarks);

    const code = await asyncErrorCode(() =>
      submitAttempt(fixture.userId, fixture.attemptId, { answers }),
    );
    expect(code).toBe("CONFLICT");
  });

  it("stores exactly one answer row per question after a double submit attempt", async () => {
    const fixture = await createAttemptFixture({ suffix: "rows" });
    const answers = fixture.questionIds.map((questionId) => ({
      questionId,
      selectedIndex: 1,
    }));
    await submitAttempt(fixture.userId, fixture.attemptId, { answers });
    await asyncErrorCode(() =>
      submitAttempt(fixture.userId, fixture.attemptId, { answers }),
    );
    const row = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM answers WHERE attempt_id = ?",
      fixture.attemptId,
    );
    expect(row?.count).toBe(fixture.questionIds.length);
  });

  it("does not mutate shared mastery history for a demo practice submission", async () => {
    const fixture = await createAttemptFixture({ suffix: "demo-practice", isDemo: true });
    await submitAttempt(fixture.userId, fixture.attemptId, {
      answers: fixture.questionIds.map((questionId) => ({
        questionId,
        selectedIndex: 1,
      })),
    });
    const row = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM mastery_snapshots WHERE owner_id = ?",
      fixture.userId,
    );
    expect(row?.count).toBe(0);
  });

  it("writes mastery snapshots when the seed routine opts in", async () => {
    const fixture = await createAttemptFixture({ suffix: "demo-seed", isDemo: true });
    await submitAttempt(
      fixture.userId,
      fixture.attemptId,
      {
        answers: fixture.questionIds.map((questionId) => ({
          questionId,
          selectedIndex: 1,
        })),
      },
      { allowDemo: true },
    );
    const row = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM mastery_snapshots WHERE owner_id = ?",
      fixture.userId,
    );
    expect(row?.count).toBeGreaterThan(0);
  });

  it("only grades questions owned by the attempt owner", async () => {
    const fixture = await createAttemptFixture({ suffix: "scoped", questionCount: 1 });
    await insertAttempt({
      id: "attempt-mixed",
      ownerId: fixture.userId,
      subjectId: fixture.subjectId,
      questionIds: [fixture.questionIds[0]!, "question-other-owner"],
    });
    const view = await getQuizView(fixture.userId, "attempt-mixed");
    expect(view.questions.map((question) => question.id)).toEqual([fixture.questionIds[0]]);
  });
});
