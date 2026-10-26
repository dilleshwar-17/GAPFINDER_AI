import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getAttemptOwned, getQuizView, saveAttemptDraft, submitAttempt } from "@/lib/services/assessment";
import { createAttemptFixture, type AttemptFixture } from "./fixtures";

async function expectNotFoundAsync(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("NOT_FOUND");
    expect((error as AppError).status).toBe(404);
    return;
  }
  throw new Error("Expected a not-found AppError");
}

let owner: AttemptFixture;
let other: AttemptFixture;

beforeEach(async () => {
  resetDatabase();
  owner = await createAttemptFixture({ suffix: "owner" });
  other = await createAttemptFixture({ suffix: "other" });
});

describe("attempt ownership", () => {
  it("hides another account's attempt from the raw attempt lookup", async () => {
    await expectNotFoundAsync(() => getAttemptOwned(other.userId, owner.attemptId));
  });

  it("hides another account's attempt from the quiz view", async () => {
    await expectNotFoundAsync(() => getQuizView(other.userId, owner.attemptId));
  });

  it("refuses to save a draft onto another account's attempt", async () => {
    await expectNotFoundAsync(() =>
      saveAttemptDraft(other.userId, owner.attemptId, {
        answers: [{ questionId: owner.questionIds[0]!, selectedIndex: 1 }],
      }),
    );
    const draft = await db.get<{ draft_json: string | null }>(
      "SELECT draft_json FROM quiz_attempts WHERE id = ?",
      owner.attemptId,
    );
    expect(draft?.draft_json).toBeNull();
  });

  it("refuses to submit another account's attempt", async () => {
    await expectNotFoundAsync(() =>
      submitAttempt(other.userId, owner.attemptId, {
        answers: owner.questionIds.map((questionId) => ({
          questionId,
          selectedIndex: 1,
        })),
      }),
    );
    const status = await db.get<{ status: string }>(
      "SELECT status FROM quiz_attempts WHERE id = ?",
      owner.attemptId,
    );
    expect(status?.status).toBe("in_progress");
    const answers = await db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM answers WHERE attempt_id = ?",
      owner.attemptId,
    );
    expect(answers?.count).toBe(0);
  });

  it("keeps each account's own attempt readable", async () => {
    expect((await getQuizView(owner.userId, owner.attemptId)).attemptId).toBe(owner.attemptId);
    expect((await getQuizView(other.userId, other.attemptId)).attemptId).toBe(other.attemptId);
  });

  it("does not reveal one account's questions inside another account's attempt", async () => {
    const view = await getQuizView(other.userId, other.attemptId);
    expect(view.questions.every((question) => owner.questionIds.includes(question.id))).toBe(false);
  });

  it("returns 404 rather than 403 so ownership cannot be probed", async () => {
    try {
      await getAttemptOwned(other.userId, owner.attemptId);
    } catch (error) {
      expect((error as AppError).status).toBe(404);
      expect((error as AppError).message).not.toMatch(/permission|owner|another account/i);
    }
  });
});
