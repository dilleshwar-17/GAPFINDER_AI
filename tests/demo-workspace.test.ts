import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, db } from "@/lib/db";
import {
  createInteractiveDemoSession,
  deleteInteractiveDemoWorkspace,
  pruneExpiredDemoWorkspaces,
} from "@/lib/services/demo";
import { getSubjectOwned, listSubjects } from "@/lib/services/subjects";
import { deleteDocument, listDocuments, ingestDocument } from "@/lib/services/documents";
import { listLeafTopics } from "@/lib/services/topics";
import { getActivePlan } from "@/lib/services/plans";
import { assertWritableAccount } from "@/lib/services/guards";
import { createSession } from "@/lib/auth/session";
import { createUser } from "@/lib/services/auth";
import { AppError } from "@/lib/errors";

beforeEach(() => {
  resetDatabase();
  process.env.DISABLE_DEMO = "false";
});

describe("interactive demo workspace", () => {
  it("provisions three usable subjects with five indexed materials each", async () => {
    const { user } = await createInteractiveDemoSession();
    const subjects = await listSubjects(user.id);

    expect(user.isDemo).toBe(true);
    expect(user.isReadOnlyDemo).toBe(false);
    expect(subjects).toHaveLength(3);

    for (const subject of subjects) {
      const documents = await listDocuments(user.id, subject.id);
      expect(documents).toHaveLength(5);
      expect(documents.every((document) => document.status === "ready")).toBe(true);
      expect(documents.every((document) => document.chunkCount > 0)).toBe(true);
      expect(await listLeafTopics(user.id, subject.id)).not.toHaveLength(0);
      expect(await getActivePlan(user.id, subject.id)).toBeTruthy();
    }

    await expect(assertWritableAccount(user.id, "subject creation")).resolves.toBeUndefined();
    const other = await createUser({
      displayName: "Another demo",
      email: `demo-session-33333333-3333-4333-8333-333333333333@demo.gapfinder.local`,
      password: "temporary-password",
      isDemo: true,
    });
    const otherSubject = await db.run(
      "INSERT INTO subjects (id, owner_id, name, is_demo, created_at) VALUES (?, ?, ?, 0, ?)",
      "other-demo-subject",
      other.id,
      "Private subject",
      new Date().toISOString(),
    );
    expect(otherSubject.changes).toBe(1);
    await expect(getSubjectOwned(user.id, "other-demo-subject")).rejects.toMatchObject({
      status: 404,
    });

    const firstSubject = subjects[0];
    await expect(
      ingestDocument({
        ownerId: user.id,
        subjectId: firstSubject.id,
        filename: "sixth-material.txt",
        mimeType: "text/plain",
        kind: "notes",
        bytes: new TextEncoder().encode("An extra demo material."),
      }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<AppError>);

    const removable = await db.get<{ id: string }>(
      `SELECT d.id
         FROM documents d
        WHERE d.owner_id = ? AND d.subject_id = ?
          AND NOT EXISTS (
            SELECT 1
              FROM question_sources qs
              JOIN answers a ON a.question_id = qs.question_id
             WHERE qs.document_id = d.id AND qs.owner_id = d.owner_id
          )
        LIMIT 1`,
      user.id,
      firstSubject.id,
    );
    expect(removable).toBeTruthy();
    await deleteDocument(user.id, removable!.id);
    const uploaded = await ingestDocument({
      ownerId: user.id,
      subjectId: firstSubject.id,
      filename: "replacement-material.txt",
      mimeType: "text/plain",
      kind: "notes",
      bytes: new TextEncoder().encode(
        "Energy transfer in cells depends on linked chemical reactions. " +
          "Photosynthesis stores energy in glucose, while cellular respiration releases usable energy as ATP. " +
          "The light reactions produce ATP and NADPH, and the Calvin cycle uses them to build sugars. " +
          "Respiration breaks glucose down through glycolysis, the Krebs cycle, and oxidative phosphorylation. " +
          "These processes help explain how organisms obtain and use energy.",
      ),
    });
    expect(uploaded.status).toBe("ready");
  });

  it("deletes all data owned by a temporary demo session", async () => {
    const { user } = await createInteractiveDemoSession();
    expect(
      await db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM subjects WHERE owner_id = ?",
        user.id,
      ),
    ).toEqual({ count: 3 });

    await deleteInteractiveDemoWorkspace(user.id);

    expect(await db.get("SELECT id FROM users WHERE id = ?", user.id)).toBeUndefined();
    for (const table of [
      "subjects",
      "documents",
      "document_chunks",
      "topics",
      "questions",
      "question_sources",
      "quiz_attempts",
      "answers",
      "mastery_snapshots",
      "revision_plans",
      "revision_tasks",
      "ai_events",
    ]) {
      expect(
        await db.get(`SELECT 1 FROM ${table} WHERE owner_id = ?`, user.id),
        `${table} should be removed with the temporary account`,
      ).toBeUndefined();
    }
    expect(
      await db.get("SELECT id FROM sessions WHERE user_id = ?", user.id),
    ).toBeUndefined();
    expect(
      await db.get("SELECT user_id FROM user_preferences WHERE user_id = ?", user.id),
    ).toBeUndefined();
  });

  it("removes expired demo workspaces while preserving active sessions", async () => {
    const expired = await createUser({
      displayName: "Expired demo",
      email: `demo-session-11111111-1111-4111-8111-111111111111@demo.gapfinder.local`,
      password: "temporary-password",
      isDemo: true,
    });
    const active = await createUser({
      displayName: "Active demo",
      email: `demo-session-22222222-2222-4222-8222-222222222222@demo.gapfinder.local`,
      password: "temporary-password",
      isDemo: true,
    });
    await db.run(
      "UPDATE users SET created_at = ? WHERE id = ?",
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      expired.id,
    );
    await createSession(active.id);

    await pruneExpiredDemoWorkspaces();

    expect(await db.get("SELECT id FROM users WHERE id = ?", expired.id)).toBeUndefined();
    expect(await db.get("SELECT id FROM users WHERE id = ?", active.id)).toBeTruthy();
  });
});
