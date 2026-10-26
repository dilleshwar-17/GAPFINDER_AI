import { z } from "zod";
import { db, nowIso } from "@/lib/db";
import { isDemoUser } from "@/lib/services/guards";
import { conflict } from "@/lib/errors";

export const preferencesSchema = z.object({
  minutesPerDay: z.coerce
    .number()
    .int()
    .min(10, "Choose at least 10 minutes per day.")
    .max(480, "Choose 480 minutes per day or fewer."),
  sessionMinutes: z.coerce.number().int().min(20).max(90),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

export interface Preferences {
  minutesPerDay: number;
  sessionMinutes: number;
  onboardingCompleted: boolean;
  lastSubjectId: string | null;
  updatedAt: string | null;
}

interface PreferencesRow {
  user_id: string;
  minutes_per_day: number;
  session_minutes: number;
  onboarding_completed: number;
  last_subject_id: string | null;
  updated_at: string;
}

const DEFAULTS: Preferences = {
  minutesPerDay: 60,
  sessionMinutes: 45,
  onboardingCompleted: false,
  lastSubjectId: null,
  updatedAt: null,
};

export function getPreferences(userId: string): Preferences {
  const row = db.get<PreferencesRow>(
    "SELECT * FROM user_preferences WHERE user_id = ?",
    userId,
  );
  if (!row) return { ...DEFAULTS };
  return {
    minutesPerDay: row.minutes_per_day,
    sessionMinutes: row.session_minutes,
    onboardingCompleted: row.onboarding_completed === 1,
    lastSubjectId: row.last_subject_id,
    updatedAt: row.updated_at,
  };
}

export function savePreferences(
  userId: string,
  input: PreferencesInput,
  options: { completeOnboarding?: boolean; lastSubjectId?: string | null } = {},
): Preferences {
  if (isDemoUser(userId)) {
    throw conflict("The shared demo workspace cannot change study preferences.");
  }
  const existing = getPreferences(userId);
  const onboardingCompleted =
    options.completeOnboarding === true ? 1 : existing.onboardingCompleted ? 1 : 0;
  db.run(
    `INSERT INTO user_preferences
      (user_id, minutes_per_day, session_minutes, onboarding_completed, last_subject_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       minutes_per_day = excluded.minutes_per_day,
       session_minutes = excluded.session_minutes,
       onboarding_completed = excluded.onboarding_completed,
       last_subject_id = COALESCE(excluded.last_subject_id, user_preferences.last_subject_id),
       updated_at = excluded.updated_at`,
    userId,
    input.minutesPerDay,
    input.sessionMinutes,
    onboardingCompleted,
    options.lastSubjectId ?? null,
    nowIso(),
  );
  return getPreferences(userId);
}

export function markOnboardingComplete(userId: string, lastSubjectId: string | null): void {
  const existing = getPreferences(userId);
  savePreferences(
    userId,
    { minutesPerDay: existing.minutesPerDay, sessionMinutes: existing.sessionMinutes },
    { completeOnboarding: true, lastSubjectId },
  );
}
