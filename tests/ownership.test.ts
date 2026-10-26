import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getAttemptOwned, getQuizView, saveAttemptDraft, submitAttempt } from "@/lib/services/assessment";
import { createAttemptFixture, type AttemptFixture } from "./fixtures";

function expectNotFound(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("NOT_FOUND");
    expect((error as AppError).status).toBe(404);
    return;
  }
  throw new Error("Expected a not-found AppError");
}

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

beforeEach(() => {
  resetDatabase();
  owner = createAttemptFixture({ suffix: "owner" });
  other = createAttemptFixture({ suffix: "other" });
});

describe("attempt ownership", () => {
  it("hides another account's attempt from the raw attempt lookup", () => {
    expectNotFound(() => getAttemptOwned(other.userId, owner.attemptId));
  });

  it("hides another account's attempt from the quiz view", () => {
    expectNotFound(() => getQuizView(other.userId, owner.attemptId));
  });

  it("refuses to save a draft onto another account's attempt", () => {
    expectNotFound(() =>
      saveAttemptDraft(other.userId, owner.attemptId, {
        answers: [{ questionId: owner.questionIds[0]!, selectedIndex: 1 }],
      }),
    );
    const draft = db.get<{ draft_json: string | null }>(
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
    const status = db.get<{ status: string }>(
      "SELECT status FROM quiz_attempts WHERE id = ?",
      owner.attemptId,
    );
    expect(status?.status).toBe("in_progress");
    const answers = db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM answers WHERE attempt_id = ?",
      owner.attemptId,
    );
    expect(answers?.count).toBe(0);
  });

  it("keeps each account's own attempt readable", () => {
    expect(getQuizView(owner.userId, owner.attemptId).attemptId).toBe(owner.attemptId);
    expect(getQuizView(other.userId, other.attemptId).attemptId).toBe(other.attemptId);
  });

  it("does not reveal one account's questions inside another account's attempt", () => {
    const view = getQuizView(other.userId, other.attemptId);
    expect(view.questions.every((question) => owner.questionIds.includes(question.id))).toBe(false);
  });

  it("returns 404 rather than 403 so ownership cannot be probed", () => {
    try {
      getAttemptOwned(other.userId, owner.attemptId);
    } catch (error) {
      expect((error as AppError).status).toBe(404);
      expect((error as AppError).message).not.toMatch(/permission|owner|another account/i);
    }
  });
});
